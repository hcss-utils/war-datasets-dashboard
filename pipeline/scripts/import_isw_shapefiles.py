#!/usr/bin/env python3
"""
ISW Shapefiles to PostGIS Importer
===================================
Imports all ISW shapefiles into a PostGIS database.

Usage:
    python import_to_postgis.py                    # Import all files
    python import_to_postgis.py --limit 100        # Import first 100 files (test)
    python import_to_postgis.py --conflict ukraine # Import only Ukraine files
"""

import os
import re
import shutil
import sys
import zipfile
import tempfile
import argparse
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Tuple, Dict, List

os.environ.setdefault("SHAPE_RESTORE_SHX", "YES")  # ISW sometimes omits the .shx sidecar

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text
from tqdm.auto import tqdm

def _san_dates(df, cols):
    """Coerce date cols: handle epoch-millis (ISW 2026 bug) + bad values -> NULL."""
    import pandas as _pd
    for col in cols:
        if col not in df.columns:
            continue
        num = _pd.to_numeric(df[col], errors="coerce")
        ms  = _pd.to_datetime(num.where(num > 1e11), unit="ms", errors="coerce")
        dt  = _pd.to_datetime(df[col].where(num.isna()), errors="coerce")
        comb = ms.fillna(dt)
        df[col] = comb.dt.date.astype(object).where(comb.notna(), None)
    return df


def _reset_workspace(root: Path) -> None:
    """Remove every artifact extracted for the preceding archive."""
    for child in root.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def _single_shapefile(root: Path) -> Path:
    """Return the only recursively located shapefile or raise explicitly."""
    shapefiles = list(root.rglob('*.shp'))
    if len(shapefiles) != 1:
        raise ValueError(f"expected_one_shapefile:found_{len(shapefiles)}")
    return shapefiles[0]


def _split_confidence(series):
    """Preserve source confidence and normalize only integral numeric scores."""
    raw = series.where(series.notna(), None)
    numeric = pd.to_numeric(series, errors='coerce')
    numeric = numeric.where(numeric.mod(1).eq(0)).astype('Int64')
    return raw, numeric


def _declared_geometry_type(shapefile: Path) -> str:
    """Map the source layer declaration onto the existing Postgres enum."""
    import pyogrio
    declared = str(pyogrio.read_info(shapefile).get('geometry_type') or '').lower()
    if 'point' in declared:
        return 'point'
    if 'line' in declared:
        return 'line'
    return 'polygon'

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()
# Runtime override keeps unattended jobs independent of the Google Drive mount.
ATTACHMENTS_DIR = Path(os.environ.get("ISW_ATTACHMENTS_DIR", SCRIPT_DIR / "attachments"))

# Database connection (SERVER war_datasets.isw) - loaded from env, NO hardcoded password
from dotenv import load_dotenv
load_dotenv(os.environ.get(
    "ISW_ENV_FILE",
    "/mnt/g/My Drive/SYSTEM_CREDENTIALS.env",
))
DATABASE_URL = os.environ["PG_WARDATASETS_URL"]
TARGET_SCHEMA = "isw"

# =============================================================================
# FILENAME PARSING
# =============================================================================

# Month abbreviation to number
MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
}

# Layer type patterns for classification
CONFLICT_PATTERNS = {
    'kursk': [r'kursk'],
    # Target theatre outranks the actor name in files such as
    # "Confirmed Israeli Strikes against Iran ...".
    'iran': [r'iran', r'protest'],
    'israel_gaza': [
        r'israel(?!.*lebanon)', r'gaza', r'palestin', r'evacuation.*zone',
        r'clearing.*operation', r'mawasi'
    ],
    'lebanon': [r'lebanon'],
    'syria': [r'syria', r'hts', r'sdf', r'sna', r'tanf', r'regime', r'opposition'],
    'yemen': [r'yemen', r'houthi'],
    # Keep generic operational terms last. They occur in other theatres too.
    'ukraine': [
        r'ukraine', r'russian.*advance', r'claimed.*russian',
        r'counteroffensive', r'partisan', r'infiltration'
    ],
}

LAYER_TYPE_MAP = {
    # Ukraine
    r'ukrainecontrolmap': 'ukraine_control_map',
    r'assessedrussianadvances': 'russian_advances',
    r'claimedrussianterritory': 'russian_claimed',
    r'claimedukrainiancounteroffensive': 'ukrainian_counteroffensives',
    r'assessedrussianinfiltration': 'russian_infiltration',
    r'reportedukrainianpartisan': 'partisan_warfare',
    r'assessedinfiltrationevent': 'infiltration_events',
    # Kursk
    r'kursk.*ukrainianadvance': 'kursk_ukrainian_advances',
    r'kursk.*russianadvance': 'kursk_russian_advances',
    r'kursk.*russianclaim': 'kursk_russian_claims',
    r'kursk.*limit': 'kursk_limit_advance',
    r'kursk.*event': 'kursk_events',
    # Israel/Gaza
    r'israelcrisis|israelicrisis': 'israel_crisis_events',
    r'claimedfurthestisrael': 'israeli_advances_claimed',
    r'assessedfurthest.*clearing': 'israeli_clearing_assessed',
    r'reportedisrael.*clearing': 'israeli_clearing_reported',
    r'evacuation.*zone': 'evacuation_zones',
    r'mawasi': 'humanitarian_zone',
    r'palestinianmilit(?:ia|a)infiltration': 'palestinian_militia_infiltration',
    # Lebanon
    r'lebanoncrisis': 'lebanon_crisis_events',
    r'israel.*lebanon': 'israeli_lebanon_advances',
    r'evacuationwarning.*lebanon': 'lebanon_evacuation_warnings',
    r'firms': 'fire_data',
    # Syria
    r'hts': 'hts_territory',
    r'sdf|syrian.*democratic': 'sdf_territory',
    r'sna|syrian.*national.*army|turkey.*backed': 'sna_territory',
    r'tanf': 'tanf_zone',
    r'regime': 'regime_territory',
    r'israel.*defense.*force': 'idf_syria',
    r'contested': 'contested_territory',
    # Iran
    r'protest': 'protests',
    r'strike.*iran': 'iran_strikes'
}


def _validated_date(year: int, month: int, day: int) -> Optional[date]:
    """Reject truncated or extra-digit source years instead of normalizing them."""
    if not 2020 <= year <= 2100:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_date_from_filename(filename: str) -> Optional[date]:
    """Extract date from various filename formats."""
    name = filename.lower().replace('.zip', '').replace('.shp', '')

    # Pattern 0: strict YYYYMMDD anywhere (new ISW format 2026+, e.g. ...Ukraine20260609, AO20260609)
    m0 = re.search(r'(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])', name)
    if m0:
        try:
            return _validated_date(int(m0.group(1)), int(m0.group(2)), int(m0.group(3)))
        except ValueError:
            pass

    # Pattern 1: YYYYMMDD prefix (e.g., 20250104HTS_led...)
    match = re.match(r'^(\d{4})(\d{2})(\d{2})', name)
    if match:
        try:
            return _validated_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        except ValueError:
            pass

    # Pattern 2: AO{DD}{MMM}{YYYY} (e.g., AO25JAN2026)
    match = re.search(r'ao(\d{1,2})([a-z]{3})(\d{4})', name)
    if match:
        day, month_str, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return _validated_date(int(year), month, int(day))
            except ValueError:
                pass

    # Pattern 2b: AO MMDDYYYY (e.g., AO 10302024)
    match = re.search(r'ao\s*(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(20\d{2})', name)
    if match:
        month, day, year = match.groups()
        try:
            return _validated_date(int(year), int(month), int(day))
        except ValueError:
            pass

    # Pattern 3: {MMM}{DD}{YYYY} (e.g., JAN152024)
    match = re.search(r'([a-z]{3})(\d{1,2})(\d{4})', name)
    if match:
        month_str, day, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return _validated_date(int(year), month, int(day))
            except ValueError:
                pass

    # Pattern 4: Month DD, YYYY (e.g., "January 25, 2026")
    # For date ranges, use the terminal day as the observation's high-water.
    match = re.search(r'([a-z]+)\s+\d{1,2}-(\d{1,2}),?\s*(\d{4})', name)
    if match:
        month_str, day, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return _validated_date(int(year), month, int(day))
            except ValueError:
                pass

    match = re.search(r'([a-z]+)\s+(\d{1,2}),?\s*(\d{4})', name)
    if match:
        month_str, day, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month:
            try:
                return _validated_date(int(year), month, int(day))
            except ValueError:
                pass

    # Pattern 5: MMDDYY (e.g., 010126)
    match = re.match(r'^(\d{2})(\d{2})(\d{2})\s', name)
    if match:
        month, day, year = match.groups()
        try:
            year_full = 2000 + int(year) if int(year) < 50 else 1900 + int(year)
            return _validated_date(year_full, int(month), int(day))
        except ValueError:
            pass

    return None


def classify_conflict(filename) -> str:
    """Determine which conflict a file belongs to."""
    if not isinstance(filename, str):
        return 'other'

    name = filename.lower()

    for conflict, patterns in CONFLICT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, name):
                return conflict

    return 'other'


def classify_layer_type(filename) -> str:
    """Determine the layer type from filename."""
    if not isinstance(filename, str):
        return 'unknown'

    name = filename.lower().replace('_', '').replace(' ', '').replace('-', '')

    for pattern, layer_type in LAYER_TYPE_MAP.items():
        if re.search(pattern, name):
            return layer_type

    # Default based on conflict
    conflict = classify_conflict(filename)
    return f'{conflict}_other'


def detect_geometry_type(gdf: gpd.GeoDataFrame) -> str:
    """Detect the geometry type of a GeoDataFrame."""
    if gdf.empty:
        return 'polygon'

    geom_types = gdf.geometry.geom_type.unique()

    if any('Point' in str(gt) for gt in geom_types):
        return 'point'
    elif any('Line' in str(gt) for gt in geom_types):
        return 'line'
    else:
        return 'polygon'




# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

def get_imported_files(engine) -> set:
    """Get set of already imported filenames."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT filename FROM shapefile_metadata"))
        return {row[0] for row in result}


def insert_empty_metadata(
    engine, filename, conflict, layer_type, layer_date, geometry_type, file_size
) -> None:
    """Record a valid zero-feature source layer without inventing geometry."""
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO shapefile_metadata
            (filename, conflict, layer_type, layer_date, geometry_type, record_count, file_size_bytes)
            VALUES (:filename, :conflict, :layer_type, :layer_date, :geometry_type, 0, :file_size)
        """), {
            'filename': filename,
            'conflict': conflict,
            'layer_type': layer_type,
            'layer_date': layer_date,
            'geometry_type': geometry_type,
            'file_size': file_size,
        })
        conn.commit()


def import_shapefile(engine, zip_path: Path, temp_dir: str) -> bool:
    """Import a single shapefile ZIP into the database."""
    filename = zip_path.name

    # Parse metadata
    layer_date = parse_date_from_filename(filename)
    if not layer_date:
        # Import time is not observation time. Refuse ambiguous dates instead
        # of silently manufacturing a current-looking source date from mtime.
        raise ValueError(f"unparseable_source_date:{filename}")

    conflict = classify_conflict(filename)
    layer_type = classify_layer_type(filename)

    try:
        # Each archive must be read from a clean workspace. Reusing extracted
        # files can make a later metadata row point at an earlier shapefile.
        workspace = Path(temp_dir)
        _reset_workspace(workspace)

        # Extract ZIP
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(temp_dir)

        # ISW sometimes stores the shapefile below one or more directories.
        try:
            shp_path = _single_shapefile(Path(temp_dir))
        except ValueError as exc:
            print(f"Error importing {filename}: {exc}")
            return False

        # Read shapefile
        gdf = gpd.read_file(shp_path)

        if gdf.empty:
            insert_empty_metadata(
                engine, filename, conflict, layer_type, layer_date,
                _declared_geometry_type(shp_path), zip_path.stat().st_size
            )
            return True

        # Ensure WGS84
        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        # Detect geometry type
        geom_type = detect_geometry_type(gdf)

        # Remove rows with null geometry
        gdf = gdf[gdf['geometry'].notna()].copy()

        if gdf.empty:
            insert_empty_metadata(
                engine, filename, conflict, layer_type, layer_date,
                geom_type, zip_path.stat().st_size
            )
            return True

        # Ensure all geometries have Z coordinate (PostGIS table expects GeometryZ)
        from shapely import force_3d
        gdf['geometry'] = gdf['geometry'].apply(lambda g: force_3d(g) if g is not None else None)

        # Insert metadata
        with engine.connect() as conn:
            result = conn.execute(text("""
                INSERT INTO shapefile_metadata
                (filename, conflict, layer_type, layer_date, geometry_type, record_count, file_size_bytes)
                VALUES (:filename, :conflict, :layer_type, :layer_date, :geom_type, :record_count, :file_size)
                RETURNING id
            """), {
                'filename': filename,
                'conflict': conflict,
                'layer_type': layer_type,
                'layer_date': layer_date,
                'geom_type': geom_type,
                'record_count': len(gdf),
                'file_size': zip_path.stat().st_size
            })
            metadata_id = result.fetchone()[0]
            conn.commit()

        # Prepare data for insertion
        gdf['metadata_id'] = metadata_id

        # Map columns based on geometry type
        if geom_type == 'point':
            # Event-type data
            col_map = {
                'globalid': 'global_id', 'global_id': 'global_id',
                'eventtype': 'event_type', 'event_type': 'event_type',
                'eventdate': 'event_date', 'event_date': 'event_date',
                'publicatio': 'publication_date', 'publication': 'publication_date',
                'mapcode': 'map_code', 'map_code': 'map_code',
                'confidence': 'confidence',
                'sources': 'sources',
                'identity_': 'identity', 'identity': 'identity',
                'actor': 'actor'
            }

            # Rename columns, avoiding duplicates by only mapping first occurrence
            new_cols = {}
            seen_targets = set()
            for c in gdf.columns:
                target = col_map.get(c.lower(), c)
                if target in seen_targets:
                    continue  # Skip duplicate mappings
                new_cols[c] = target
                seen_targets.add(target)

            gdf_renamed = gdf.rename(columns=new_cols)

            # Preserve provider-native confidence while retaining the legacy
            # integer column for genuinely integral scores. Values such as
            # "low" and "nominal" are semantics, not parse errors.
            if 'confidence' in gdf_renamed.columns:
                raw_confidence, numeric_confidence = _split_confidence(gdf_renamed['confidence'])
                gdf_renamed['confidence_raw'] = raw_confidence
                gdf_renamed['confidence'] = numeric_confidence

            # Select only needed columns
            keep_cols = ['metadata_id', 'global_id', 'event_type', 'event_date',
                        'publication_date', 'map_code', 'confidence', 'confidence_raw', 'sources',
                        'identity', 'actor', 'geometry']

            for col in keep_cols:
                if col not in gdf_renamed.columns and col != 'geometry':
                    gdf_renamed[col] = None

            gdf_final = gdf_renamed[[c for c in keep_cols if c in gdf_renamed.columns]]
            gdf_final = _san_dates(gdf_final, ['event_date','publication_date'])

            # Insert into events table
            gdf_final.to_postgis('events', engine, if_exists='append', index=False, schema='isw')

        elif geom_type == 'line':
            # Line data
            col_map = {
                'globalid': 'global_id', 'global_id': 'global_id',
                'creationda': 'creation_date', 'creation_date': 'creation_date',
                'editdate': 'edit_date', 'edit_date': 'edit_date',
                'creator': 'creator',
                'editor': 'editor',
                'shape_leng': 'shape_length', 'shape_length': 'shape_length'
            }

            # Rename columns, avoiding duplicates
            new_cols = {}
            seen_targets = set()
            for c in gdf.columns:
                target = col_map.get(c.lower(), c)
                if target in seen_targets:
                    continue
                new_cols[c] = target
                seen_targets.add(target)

            gdf_renamed = gdf.rename(columns=new_cols)

            keep_cols = ['metadata_id', 'global_id', 'creation_date', 'edit_date',
                        'creator', 'editor', 'shape_length', 'geometry']

            for col in keep_cols:
                if col not in gdf_renamed.columns and col != 'geometry':
                    gdf_renamed[col] = None

            gdf_final = gdf_renamed[[c for c in keep_cols if c in gdf_renamed.columns]]
            gdf_final = _san_dates(gdf_final, ['creation_date','edit_date'])

            gdf_final.to_postgis('lines', engine, if_exists='append', index=False, schema='isw')

        else:
            # Polygon data
            col_map = {
                'globalid': 'global_id', 'global_id': 'global_id',
                'creationda': 'creation_date', 'creation_date': 'creation_date',
                'editdate': 'edit_date', 'edit_date': 'edit_date',
                'creator': 'creator',
                'editor': 'editor',
                'shape_leng': 'shape_length', 'shape_length': 'shape_length',
                'shape_area': 'shape_area', 'shape__are': 'shape_area',
                'area': 'area_value'
            }

            # Rename columns, avoiding duplicates
            new_cols = {}
            seen_targets = set()
            for c in gdf.columns:
                target = col_map.get(c.lower(), c)
                if target in seen_targets:
                    continue
                new_cols[c] = target
                seen_targets.add(target)

            gdf_renamed = gdf.rename(columns=new_cols)

            keep_cols = ['metadata_id', 'global_id', 'creation_date', 'edit_date',
                        'creator', 'editor', 'shape_length', 'shape_area',
                        'area_value', 'geometry']

            for col in keep_cols:
                if col not in gdf_renamed.columns and col != 'geometry':
                    gdf_renamed[col] = None

            gdf_final = gdf_renamed[[c for c in keep_cols if c in gdf_renamed.columns]]
            gdf_final = _san_dates(gdf_final, ['creation_date','edit_date'])

            gdf_final.to_postgis('control_polygons', engine, if_exists='append', index=False, schema='isw')

        return True

    except Exception as e:
        print(f"Error importing {filename}: {e}")
        # Rollback metadata if we inserted it
        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM shapefile_metadata WHERE filename = :filename"),
                           {'filename': filename})
                conn.commit()
        except:
            pass
        return False
    finally:
        # Clean temp dir
        for f in Path(temp_dir).glob('*'):
            try:
                f.unlink()
            except:
                pass


# =============================================================================
# SAME-DATE DEDUP (post-import cron step)
# =============================================================================

def dedupe_same_date(engine, layer_type: str = 'ukraine_control_map') -> int:
    """Auto-flag same-date duplicate control-map files in data_quality_flags.

    ISW occasionally ships two files for the same calendar date — naming
    variants (AO04APR2024 vs AOAPR42024), download copies ('...AO04APR2026 (1)'),
    partial-fragment re-exports, or a mis-parsed/truncated filename that collides
    onto a real date. When both land in the DB, `clean_daily_areas` SUMs them and
    the daily occupied-area for that date is inflated/doubled.

    Rule: among the not-already-excluded metadata rows for a given (layer_date,
    layer_type) that carry polygons, KEEP the one with the largest occupied area
    (the most complete map; this also correctly drops tiny fragments) and flag the
    rest as exclude_from_analysis=true / issue_category='duplicate_import'.
    Idempotent: skips dates where only one un-excluded row remains, and never
    re-flags a metadata_id that is already excluded. Returns #rows newly flagged.
    """
    flagged = 0
    with engine.begin() as conn:
        dup_dates = conn.execute(text("""
            SELECT sm.layer_date
            FROM shapefile_metadata sm
            JOIN control_polygons cp ON cp.metadata_id = sm.id
            LEFT JOIN data_quality_flags dq
                   ON dq.metadata_id = sm.id AND dq.exclude_from_analysis = true
            WHERE sm.layer_type = :lt AND dq.id IS NULL
            GROUP BY sm.layer_date
            HAVING COUNT(DISTINCT sm.id) > 1
        """), {"lt": layer_type}).fetchall()

        for (ld,) in dup_dates:
            # rank surviving rows for this date by occupied area (largest = keeper)
            ranked = conn.execute(text("""
                SELECT sm.id, sm.filename,
                       ST_Area(ST_Union(ST_Transform(ST_MakeValid(cp.geometry),6933)))/1e6 AS km2
                FROM shapefile_metadata sm
                JOIN control_polygons cp ON cp.metadata_id = sm.id
                LEFT JOIN data_quality_flags dq
                       ON dq.metadata_id = sm.id AND dq.exclude_from_analysis = true
                WHERE sm.layer_type = :lt AND sm.layer_date = :ld AND dq.id IS NULL
                GROUP BY sm.id, sm.filename
                ORDER BY km2 DESC, sm.id ASC
            """), {"lt": layer_type, "ld": ld}).fetchall()
            keeper = ranked[0]
            for row in ranked[1:]:
                conn.execute(text("""
                    INSERT INTO data_quality_flags
                      (metadata_id, flag_type, severity, issue_category, description,
                       exclude_from_analysis, correction_applied, flagged_at, flagged_by)
                    VALUES (:m,'error','critical','duplicate_import',:d,true,false,now(),
                            'samedate_dedup_cron')
                """), {"m": row.id,
                        "d": (f"Same-date duplicate {layer_type} for {ld}: '{row.filename}' "
                              f"({row.km2:,.0f} km2) duplicates keeper id={keeper.id} "
                              f"'{keeper.filename}' ({keeper.km2:,.0f} km2). Auto-excluded to "
                              f"prevent daily-area double-counting.")})
                print(f"  [dedup] flagged dup id={row.id} ({row.filename}) for {ld}; kept id={keeper.id}")
                flagged += 1
    return flagged


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Import ISW shapefiles to PostGIS')
    parser.add_argument('--limit', type=int, help='Limit number of files to import')
    parser.add_argument('--conflict', type=str, help='Only import files for this conflict')
    parser.add_argument('--skip-existing', action='store_true', default=True,
                       help='Skip already imported files (default: True)')
    args = parser.parse_args()

    print("=" * 60)
    print("ISW SHAPEFILES TO POSTGIS IMPORTER")
    print("=" * 60)

    # Create engine
    engine = create_engine(DATABASE_URL, connect_args={"options": "-csearch_path=isw,public"})

    # Test connection
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT PostGIS_Version()"))
            postgis_ver = result.fetchone()[0]
            print(f"Connected to PostGIS {postgis_ver}")
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        sys.exit(1)

    # Get list of ZIP files
    zip_files = sorted(ATTACHMENTS_DIR.glob('*.zip'))
    print(f"Found {len(zip_files):,} ZIP files")

    # Filter by conflict if specified
    if args.conflict:
        zip_files = [f for f in zip_files if classify_conflict(f.name) == args.conflict]
        print(f"Filtered to {len(zip_files):,} {args.conflict} files")

    # Skip already imported
    if args.skip_existing:
        imported = get_imported_files(engine)
        archive_count = len(zip_files)
        zip_files = [f for f in zip_files if f.name not in imported]
        matched = archive_count - len(zip_files)
        print(
            f"Matched {matched:,} local ZIP filenames already imported "
            f"({len(imported):,} distinct database filenames total); "
            f"{len(zip_files):,} ZIPs remaining"
        )

    # Limit if specified
    if args.limit:
        zip_files = zip_files[:args.limit]
        print(f"Limited to {len(zip_files):,} files")

    if not zip_files:
        print("No files to import!")
        return

    # Import files
    success = 0
    failed = 0

    with tempfile.TemporaryDirectory() as temp_dir:
        for zip_path in tqdm(zip_files, desc="Importing"):
            if import_shapefile(engine, zip_path, temp_dir):
                success += 1
            else:
                failed += 1

    # Summary
    print()
    print("=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"Successfully imported: {success:,}")
    print(f"Failed: {failed:,}")

    # Post-import same-date dedup: auto-flag duplicate control-map files so the
    # daily-area views (clean_daily_areas) never double-count a single date.
    n_dedup = dedupe_same_date(engine)
    print(f"Same-date duplicates auto-flagged: {n_dedup:,}")

    # Show stats
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT conflict, COUNT(*) as files, SUM(record_count) as records
            FROM shapefile_metadata
            GROUP BY conflict
            ORDER BY files DESC
        """))
        print("\nDatabase contents:")
        for row in result:
            print(f"  {row[0]}: {row[1]:,} files, {row[2]:,} records")

    # An unattended orchestrator must be able to distinguish partial import from
    # success. Historically this script logged failures but still exited zero.
    if failed:
        print(f"ERROR: {failed:,} shapefiles failed; refusing healthy exit", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
