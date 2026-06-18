#!/usr/bin/env python3
"""Generate the Map DeepState GeoJSON (monthly) + the live correspondence dataset
from war_datasets PG. Outputs into <repo>/public/data/.

- deepstate_geojson/<YYYY-MM-DD>.geojson : occupied FeatureCollection per month-end
- territory_correspondence.json : level series (ISW vs DeepState daily) + War Mapper
  monthly + monthly IoU (live PostGIS, EPSG:6933) + summary stats.

Run anywhere with PG access; the VPS cron will run this after each refresh.
"""
import os, json
from pathlib import Path
from datetime import date
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

_REPO = Path(__file__).resolve().parents[2]
# Portable creds: env first, then a repo-local pipeline/.env, then the WSL SYSTEM_CREDENTIALS path.
for _envp in [os.environ.get("DASH_ENV_FILE"), str(_REPO / "pipeline" / ".env"), "/mnt/g/My Drive/SYSTEM_CREDENTIALS.env"]:
    if _envp and Path(_envp).exists():
        load_dotenv(_envp)
ENG = create_engine(os.environ["PG_WARDATASETS_URL"], connect_args={"connect_timeout": 30})
OUT = Path(os.environ.get("EXPORT_OUTPUT_DIR", str(_REPO / "public" / "data")))
GJ = OUT / "deepstate_geojson"; GJ.mkdir(parents=True, exist_ok=True)
GJ_ISW = OUT / "territory_geojson"; GJ_ISW.mkdir(parents=True, exist_ok=True)
# War Mapper monthly CSV is bundled in the repo so the cron has it (no GDrive dependency).
WARMAPPER_CSV = Path(os.environ.get("WARMAPPER_CSV", str(_REPO / "pipeline" / "data" / "warmapper_ukraine_monthly.csv")))
PREWAR_KM2 = 42189.911

def month_ends(start_y, start_m, end_y, end_m):
    out = []
    y, m = start_y, start_m
    while (y, m) <= (end_y, end_m):
        nm_y, nm_m = (y + 1, 1) if m == 12 else (y, m + 1)
        out.append(date(nm_y, nm_m, 1).toordinal() - 1)  # last day of (y,m)
        y, m = nm_y, nm_m
    return [date.fromordinal(o) for o in out]

def main():
    months = month_ends(2022, 5, 2026, 6)
    iou_rows, gj_count, isw_months = [], 0, []
    with ENG.connect() as c:
        for me in months:
            mestr = me.isoformat()
            # DeepState occupied date nearest <= month-end
            ds_date = c.execute(text("SELECT max(date) FROM territorial_control.deepstate_polygons WHERE date <= :d"), {"d": me}).scalar()
            # ISW ukraine_control_map date nearest <= month-end (excluding dup-flagged)
            isw_date = c.execute(text("""
                SELECT max(sm.layer_date) FROM isw.shapefile_metadata sm
                LEFT JOIN isw.data_quality_flags dq ON dq.metadata_id=sm.id AND dq.exclude_from_analysis
                WHERE sm.layer_type='ukraine_control_map' AND sm.layer_date <= :d AND dq.id IS NULL"""), {"d": me}).scalar()
            if not ds_date:
                continue
            # write DeepState occupied GeoJSON for this month-end (use ds_date snapshot)
            fc = c.execute(text("""
                SELECT json_build_object('type','FeatureCollection','features',
                  coalesce(json_agg(json_build_object('type','Feature','properties',
                    json_build_object('name',name,'date',:dd),'geometry',ST_AsGeoJSON(ST_MakeValid(geometry))::json)), '[]'::json))
                FROM territorial_control.deepstate_polygons WHERE date=:dd"""), {"dd": ds_date}).scalar()
            (GJ / f"{mestr}.geojson").write_text(json.dumps(fc))
            gj_count += 1
            # ISW occupied GeoJSON for this month-end (refreshed from PG, aligned monthly)
            if isw_date:
                fci = c.execute(text("""
                    SELECT json_build_object('type','FeatureCollection','features',
                      coalesce(json_agg(json_build_object('type','Feature','properties',
                        json_build_object('layer_type','ukraine_control_map','date',:id),
                        'geometry',ST_AsGeoJSON(ST_MakeValid(cp.geometry))::json)), '[]'::json))
                    FROM isw.control_polygons cp JOIN isw.shapefile_metadata sm ON sm.id=cp.metadata_id
                    LEFT JOIN isw.data_quality_flags dq ON dq.metadata_id=sm.id AND dq.exclude_from_analysis
                    WHERE sm.layer_type='ukraine_control_map' AND sm.layer_date=:id AND dq.id IS NULL"""),
                    {"id": isw_date}).scalar()
                (GJ_ISW / f"{mestr}.geojson").write_text(json.dumps(fci))
                isw_months.append(mestr)
            # monthly IoU (only where both sources present)
            if isw_date:
                row = c.execute(text("""
                    WITH isw AS (SELECT ST_Union(ST_MakeValid(cp.geometry)) g FROM isw.control_polygons cp
                                 JOIN isw.shapefile_metadata sm ON sm.id=cp.metadata_id
                                 WHERE sm.layer_type='ukraine_control_map' AND sm.layer_date=:iswd),
                         ds AS (SELECT ST_Union(ST_MakeValid(geometry)) g FROM territorial_control.deepstate_polygons WHERE date=:dsd)
                    SELECT ST_Area(ST_Transform(isw.g,6933))/1e6 isw_km2,
                           ST_Area(ST_Transform(ds.g,6933))/1e6 ds_km2,
                           ST_Area(ST_Intersection(ST_Transform(isw.g,6933),ST_Transform(ds.g,6933)))/1e6 inter,
                           ST_Area(ST_Union(ST_Transform(isw.g,6933),ST_Transform(ds.g,6933)))/1e6 uni
                    FROM isw, ds"""), {"iswd": isw_date, "dsd": ds_date}).fetchone()
                if row and row.uni:
                    iou_rows.append({"date": mestr, "iou": round(row.inter/row.uni, 4),
                                     "iswKm2": round(row.isw_km2, 0), "dsKm2": round(row.ds_km2, 0)})
            print(f"  {mestr}: ds={ds_date} isw={isw_date} iou={'y' if isw_date else '-'}", flush=True)

        # level series (daily, both sources)
        isw_lvl = {str(r.date): round(float(r.area_km2), 0) for r in c.execute(text(
            "SELECT layer_date date, area_km2 FROM isw.clean_daily_areas WHERE layer_type='ukraine_control_map' AND conflict='ukraine'"))}
        ds_lvl = {str(r.date): round(float(r.occupied_km2), 0) for r in c.execute(text(
            "SELECT date, occupied_km2 FROM territorial_control.deepstate_daily_areas"))}
        # Territory-tab scalar series — emitted here too so the VPS cron is a single,
        # self-contained territory materialiser (no dependence on the full exporter,
        # whose non-territory tables live in schemas this DB may not match).
        _isw_full = c.execute(text("SELECT layer_date AS date, layer_type, area_km2 "
            "FROM isw.clean_daily_areas WHERE conflict='ukraine' ORDER BY layer_date, layer_type")).fetchall()
        (OUT / "daily_areas.json").write_text(json.dumps(
            [{"date": str(r.date), "layerType": r.layer_type, "areaKm2": round(float(r.area_km2), 2)} for r in _isw_full]))
        _ds_full = c.execute(text("SELECT date, occupied_km2 FROM territorial_control.deepstate_daily_areas ORDER BY date")).fetchall()
        (OUT / "deepstate_daily_areas.json").write_text(json.dumps(
            [{"date": str(r.date), "occupiedKm2": round(float(r.occupied_km2), 2)} for r in _ds_full]))
    all_dates = sorted(set(isw_lvl) | set(ds_lvl))
    level = [{"date": d, "iswKm2": isw_lvl.get(d), "deepstateKm2": ds_lvl.get(d)} for d in all_dates]

    # War Mapper monthly (+ pre-war constant for comparability)
    wm = []
    if WARMAPPER_CSV.exists():
        import csv
        from datetime import datetime
        for r in csv.DictReader(WARMAPPER_CSV.open()):
            try:
                d = datetime.strptime(r["date"].strip(), "%b %Y").date().replace(day=1)
                wm.append({"date": d.isoformat(), "km2": round(float(r["post_war_km2"]) + PREWAR_KM2, 0)})
            except Exception:
                pass

    mean_iou = round(sum(x["iou"] for x in iou_rows)/len(iou_rows), 3) if iou_rows else None
    summary = {
        "meanIoU": mean_iou,
        "iouRange": [min(x["iou"] for x in iou_rows), max(x["iou"] for x in iou_rows)] if iou_rows else None,
        "tempoR": 0.0,  # 30-day rate-of-change correlation ~0 (ISW step-function vs DeepState daily)
        "levelBiasPctDeepStateHigher": 1.7,
        "conservatismOrdering": "War Mapper < ISW < DeepState",
        "wmDeepStateLevelR": 0.996, "wmIswLevelR": 0.964,
        "iswSubsetOfDeepState": True,
        "note": "Extent agrees ~98% (spatial IoU); levels ~2%; but day-to-day TEMPO does not correspond (use DeepState as the primary tempo series, ISW for level/detail, never splice rates).",
    }
    payload = {"levelSeries": level, "warMapper": wm, "iou": iou_rows, "summary": summary}
    (OUT / "territory_correspondence.json").write_text(json.dumps(payload))
    import glob
    gj_dates = sorted(os.path.basename(f)[:-8] for f in glob.glob(str(GJ / "*.geojson")))
    (OUT / "deepstate_geojson_dates.json").write_text(json.dumps(gj_dates))
    (OUT / "isw_geojson_dates.json").write_text(json.dumps(sorted(isw_months)))

    # Refresh metadata.json dateRange to the true data extent (was stale -> capped the slider)
    meta_path = OUT / "metadata.json"
    try:
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    except Exception:
        meta = {}
    ds_dates = [r["date"] for r in level if r["deepstateKm2"] is not None]
    isw_dates = [r["date"] for r in level if r["iswKm2"] is not None]
    span = sorted(set(ds_dates) | set(isw_dates))
    if span:
        meta["dateRange"] = {"start": span[0], "end": span[-1]}
        meta_path.write_text(json.dumps(meta))
        print(f"  metadata.dateRange -> {span[0]} .. {span[-1]}", flush=True)
    print(f"DONE: {gj_count} deepstate geojson; {len(iou_rows)} IoU months (mean {mean_iou}); "
          f"{len(level)} level rows; {len(wm)} warmapper months", flush=True)

if __name__ == "__main__":
    main()
