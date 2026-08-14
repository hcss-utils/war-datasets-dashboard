#!/usr/bin/env python3
"""Materialise measured territorial-data methodology metadata from PostGIS."""
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

REPO = Path(__file__).resolve().parents[2]
for env_path in (os.environ.get("DASH_ENV_FILE"), REPO / "pipeline" / ".env"):
    if env_path and Path(env_path).exists():
        load_dotenv(env_path)
OUT = Path(os.environ.get("EXPORT_OUTPUT_DIR", REPO / "public" / "data"))


def main() -> None:
    engine = create_engine(os.environ["PG_WARDATASETS_URL"], connect_args={"connect_timeout": 30})
    with engine.connect() as c:
        v2 = c.execute(text("""
            WITH d AS (SELECT DISTINCT snapshot_date AS dt FROM deepstate_v2.snapshots),
                 g AS (SELECT dt, dt-lag(dt) OVER (ORDER BY dt) AS gap FROM d)
            SELECT count(*) distinct_dates, min(dt) first_date, max(dt) latest_date,
                   max(dt)-min(dt)+1 span_days, (max(dt)-min(dt)+1)-count(*) missing_dates,
                   max(gap)::int largest_gap FROM g""")).mappings().one()
        feature_rows = c.execute(text("SELECT count(*) FROM deepstate_v2.features")).scalar_one()
        territory_dates = c.execute(text("SELECT count(DISTINCT date) FROM deepstate_v2.deepstate_territory")).scalar_one()
        daily_rows = c.execute(text("""
            SELECT snapshot_date AS date,
                   ST_Area(ST_Transform(ST_UnaryUnion(ST_Collect(ST_MakeValid(geom))),6933))/1e6 km2
            FROM deepstate_v2.features WHERE control_status='occupied'
            GROUP BY snapshot_date ORDER BY snapshot_date""")).fetchall()
        daily = {str(r.date): float(r.km2) for r in daily_rows}
        areas = {d: daily[d] for d in
            ('2022-04-23','2022-04-24','2022-06-01','2022-07-01','2022-08-01',
             '2022-09-01','2022-09-23','2022-09-25','2022-09-26')}
        legacy_snap = c.execute(text("SELECT count(DISTINCT date),min(date),max(date) FROM territorial_control.deepstate_snapshots")).one()
        legacy_poly = c.execute(text("SELECT count(*),count(DISTINCT date),min(date),max(date) FROM territorial_control.deepstate_polygons")).one()
        legacy_territory = c.execute(text("SELECT count(*),count(DISTINCT date),min(date),max(date) FROM territorial_control.deepstate_territory")).one()
        isw = c.execute(text("SELECT count(*),max(layer_date) FROM isw.shapefile_metadata")).one()
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "deepStateV2": {"firstDate": str(v2.first_date), "latestDate": str(v2.latest_date),
            "distinctDates": v2.distinct_dates, "spanDays": v2.span_days,
            "coveragePct": round(100*v2.distinct_dates/v2.span_days, 2), "missingDates": v2.missing_dates,
            "largestDateGapDays": v2.largest_gap, "featureRows": feature_rows, "territoryDates": territory_dates},
        "blackout": {"start": "2022-04-24", "end": "2022-09-24",
            "durationDays": (date(2022,9,24)-date(2022,4,24)).days+1,
            "beforeKm2": round(areas['2022-04-23'],1), "afterDropKm2": round(areas['2022-04-24'],1),
            "apparentLossKm2": round(areas['2022-04-23']-areas['2022-04-24'],1),
            "beforeRestoreKm2": round(areas['2022-09-23'],1), "restoredKm2": round(areas['2022-09-25'],1),
            "apparentGainKm2": round(areas['2022-09-25']-areas['2022-09-23'],1),
            "nextDayGainKm2": round(areas['2022-09-26']-areas['2022-09-25'],1),
            "summerCheckpoints": [{"date": d, "occupiedKm2": round(areas[d],1)} for d in ('2022-06-01','2022-07-01','2022-08-01','2022-09-01')]},
        "legacy": {"snapshotDates": legacy_snap[0], "snapshotFirstDate": str(legacy_snap[1]), "snapshotLatestDate": str(legacy_snap[2]),
            "polygonRows": legacy_poly[0], "polygonDates": legacy_poly[1], "polygonFirstDate": str(legacy_poly[2]), "polygonLatestDate": str(legacy_poly[3]),
            "territoryRows": legacy_territory[0], "territoryDates": legacy_territory[1], "territoryFirstDate": str(legacy_territory[2]), "territoryLatestDate": str(legacy_territory[3])},
        "isw": {"metadataRows": isw[0], "latestLayerDate": str(isw[1])},
        "rule": "Do not infer territorial trends from DeepState between 2022-04-24 and 2022-09-24. Treat the endpoints as point snapshots only; use independently validated complementary sources for the interval."
    }
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "territory_methodology.json"
    tmp = target.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(payload))
    tmp.replace(target)
    series_target = OUT / "deepstate_daily_areas.json"
    series_tmp = series_target.with_suffix('.json.tmp')
    series_tmp.write_text(json.dumps([{"date": str(r.date), "occupiedKm2": round(float(r.km2), 2)} for r in daily_rows]))
    series_tmp.replace(series_target)
    print(f"wrote {target} and {series_target} ({v2.distinct_dates} dates; {feature_rows} features)")


if __name__ == '__main__':
    main()
