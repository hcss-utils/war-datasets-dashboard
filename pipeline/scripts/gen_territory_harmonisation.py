#!/usr/bin/env python3
"""Export the PostGIS territory harmonisation layer for dashboard consumers."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


REPO = Path(__file__).resolve().parents[2]
for env_path in (os.environ.get("DASH_ENV_FILE"), REPO / "pipeline" / ".env"):
    if env_path and Path(env_path).exists():
        load_dotenv(env_path)
OUT = Path(os.environ.get("EXPORT_OUTPUT_DIR", REPO / "public" / "data"))


def records(rows):
    return [dict(row) for row in rows]


def availability_summary(rows: list[dict]) -> dict:
    fields = {
        "deepstate": "deepstate_available",
        "iswUkraineControl": "isw_ukraine_control_available",
        "iswUkraineChange": "isw_ukraine_change_available",
        "iswKursk": "isw_kursk_available",
        "likeForLikeComparison": "like_for_like_comparison_available",
    }
    summary = {"calendarDays": len(rows)}
    for label, field in fields.items():
        available = [row["date"] for row in rows if row[field]]
        summary[label] = {
            "days": len(available),
            "firstDate": available[0] if available else None,
            "latestDate": available[-1] if available else None,
        }
    return summary


def main() -> None:
    engine = create_engine(os.environ["PG_WARDATASETS_URL"], connect_args={"connect_timeout": 30})
    with engine.connect() as conn:
        comparison = records(conn.execute(text("""
          SELECT observation_date::text AS date,
                 round(deepstate_km2::numeric, 2)::float8 AS deepstate_km2,
                 round(isw_km2::numeric, 2)::float8 AS isw_km2,
                 round(overlap_km2::numeric, 2)::float8 AS overlap_km2,
                 round(deepstate_only_km2::numeric, 2)::float8 AS deepstate_only_km2,
                 round(isw_only_km2::numeric, 2)::float8 AS isw_only_km2,
                 round(intersection_over_union::numeric, 6)::float8 AS intersection_over_union,
                 round(disagreement_share::numeric, 6)::float8 AS disagreement_share,
                 agreement_class, comparison_confidence,
                 deepstate_feature_count, isw_feature_count,
                 isw_metadata_ids, isw_source_filenames
          FROM territory_harmonisation.daily_geometry_comparison
          ORDER BY observation_date
        """)).mappings())
        availability = records(conn.execute(text("""
          SELECT observation_date::text AS date, deepstate_available,
                 isw_ukraine_control_available, isw_ukraine_change_available,
                 isw_kursk_available, like_for_like_comparison_available
          FROM territory_harmonisation.daily_source_availability
          WHERE observation_date >= date '2022-01-01'
          ORDER BY observation_date
        """)).mappings())
        theatre = records(conn.execute(text("""
          SELECT observation_date::text AS date,
                 round(liberated_inside_ukraine_km2::numeric,2)::float8 AS liberated_inside_ukraine_km2,
                 round(ukrainian_held_inside_kursk_km2::numeric,2)::float8 AS ukrainian_held_inside_kursk_km2,
                 round(outside_partition_km2::numeric,2)::float8 AS outside_partition_km2,
                 source_feature_count, separation_method, boundary_confidence
          FROM territory_harmonisation.deepstate_liberated_theatre_daily
          ORDER BY observation_date
        """)).mappings())
        sources = records(conn.execute(text("""
          SELECT source, theatre, observation_type,
                 count(*) AS observations,
                 min(observation_date)::text AS first_date,
                 max(observation_date)::text AS latest_date,
                 count(*) FILTER (WHERE provenance_confidence='high') AS high_confidence,
                 count(*) FILTER (WHERE provenance_confidence='medium') AS medium_confidence,
                 count(*) FILTER (WHERE provenance_confidence='low') AS low_confidence
          FROM territory_harmonisation.source_observations
          WHERE observation_date >= date '2022-01-01'
          GROUP BY source, theatre, observation_type
          ORDER BY source, theatre, observation_type
        """)).mappings())
        quality = conn.execute(text("""
          SELECT count(*) AS metadata_rows,
                 count(*) FILTER (WHERE date_provenance='filename_explicit') AS explicit_date_rows,
                 count(*) FILTER (WHERE date_provenance='message_subject_explicit') AS message_date_rows,
                 count(*) FILTER (WHERE date_provenance='legacy_unverified') AS unverified_date_rows,
                 (SELECT count(*) FROM isw.metadata_correction_audit) AS audited_corrections
          FROM isw.shapefile_metadata
        """)).mappings().one()

    latest = comparison[-1] if comparison else None
    peak_kursk = max(theatre, key=lambda row: row["ukrainian_held_inside_kursk_km2"], default=None)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contract": {
            "periodizationRelationship": "complements_existing_periodization",
            "likeForLikeComparison": "DeepState occupied + occupied_pre_2022 versus ISW ukraine_control_map on the same observation date",
            "theatreSeparation": "DeepState liberated geometry intersected with authoritative Ukraine and Kursk Oblast boundaries",
            "confidenceMeaning": "provenance and comparability confidence, separate from source agreement",
        },
        "headline": {
            "latestComparison": latest,
            "comparisonDates": len(comparison),
            "availability": availability_summary(availability),
            "peakKursk": peak_kursk,
            "latestTheatreSplit": theatre[-1] if theatre else None,
        },
        "quality": dict(quality),
        "sourceCoverage": sources,
        "dailyAvailability": availability,
        "dailyComparison": comparison,
        "dailyTheatreSplit": theatre,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "territory_harmonisation.json"
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    tmp.replace(target)
    print(f"wrote {target}: {len(comparison)} comparisons, {len(theatre)} theatre splits")


if __name__ == "__main__":
    main()
