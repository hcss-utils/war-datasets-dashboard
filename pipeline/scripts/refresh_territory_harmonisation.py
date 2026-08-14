#!/usr/bin/env python3
"""Supervise refreshes of the territorial harmonisation materializations.

The job is stage-resumable: each materialized view commits independently, the
atomic state records completed stages for the measured source high-water, and a
restart skips already-completed stages. It validates row/date high-waters before
declaring the product healthy.
"""
from __future__ import annotations

import fcntl
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


ROOT = Path(os.environ.get("TERRITORY_HARMONISATION_RUNTIME", "/var/lib/war-datasets-dashboard/territory-harmonisation"))
STATE = ROOT / "state.json"
HEARTBEAT = ROOT / "heartbeat.json"
LOCK = ROOT / "refresh.lock"
STAGES = [
    "deepstate_russian_control_daily",
    "isw_russian_control_daily",
    "daily_geometry_comparison",
    "deepstate_liberated_theatre_daily",
]

THEATRE_UPSERT = """
WITH boundaries AS (
  SELECT
    ST_UnaryUnion(ST_Collect(geom) FILTER (WHERE country='Ukraine')) AS ukraine_geom,
    ST_UnaryUnion(ST_Collect(geom) FILTER (WHERE country='Russia')) AS kursk_geom
  FROM deepstate_v2.oblasts
), liberated AS (
  SELECT ST_UnaryUnion(ST_Collect(ST_Force2D(ST_MakeValid(geom)))) AS geom,
         count(*) AS source_feature_count
  FROM deepstate_v2.features
  WHERE control_status='liberated' AND snapshot_date=:day
)
INSERT INTO territory_harmonisation.deepstate_liberated_theatre_daily (
  observation_date, liberated_inside_ukraine_km2,
  ukrainian_held_inside_kursk_km2, outside_partition_km2,
  source_feature_count, separation_method, boundary_confidence
)
SELECT :day,
  ST_Area(ST_Intersection(l.geom,b.ukraine_geom)::geography)/1000000.0,
  ST_Area(ST_Intersection(l.geom,b.kursk_geom)::geography)/1000000.0,
  ST_Area(ST_Difference(l.geom,ST_Union(b.ukraine_geom,b.kursk_geom))::geography)/1000000.0,
  l.source_feature_count, 'exact_daily_union_border_intersection', 'high'
FROM liberated l CROSS JOIN boundaries b
ON CONFLICT (observation_date) DO UPDATE SET
  liberated_inside_ukraine_km2=excluded.liberated_inside_ukraine_km2,
  ukrainian_held_inside_kursk_km2=excluded.ukrainian_held_inside_kursk_km2,
  outside_partition_km2=excluded.outside_partition_km2,
  source_feature_count=excluded.source_feature_count,
  separation_method=excluded.separation_method,
  boundary_confidence=excluded.boundary_confidence,
  computed_at=now()
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def read_state() -> dict:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def beat(phase: str, **extra) -> None:
    atomic_json(HEARTBEAT, {"updated_at": now(), "phase": phase, **extra})


@contextmanager
def exclusive_lock():
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w", encoding="utf-8") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        handle.write(f"pid={os.getpid()} started_at={now()}\n")
        handle.flush()
        yield


def source_highwater(conn) -> dict:
    row = conn.execute(text("""
      SELECT
        (SELECT max(snapshot_date)::text FROM deepstate_v2.snapshots) AS deepstate,
        (SELECT max(layer_date)::text FROM isw.shapefile_metadata
         WHERE conflict='ukraine' AND layer_type='ukraine_control_map'
           AND date_provenance='filename_explicit') AS isw_control
    """)).mappings().one()
    return dict(row)


def validation(conn) -> dict:
    row = conn.execute(text("""
      SELECT
        (SELECT count(*) FROM territory_harmonisation.deepstate_russian_control_daily) AS deepstate_days,
        (SELECT max(observation_date)::text FROM territory_harmonisation.deepstate_russian_control_daily) AS deepstate_latest,
        (SELECT count(*) FROM territory_harmonisation.isw_russian_control_daily) AS isw_days,
        (SELECT max(observation_date)::text FROM territory_harmonisation.isw_russian_control_daily) AS isw_latest,
        (SELECT count(*) FROM territory_harmonisation.daily_geometry_comparison) AS comparison_days,
        (SELECT max(observation_date)::text FROM territory_harmonisation.daily_geometry_comparison) AS comparison_latest,
        (SELECT count(*) FROM territory_harmonisation.deepstate_liberated_theatre_daily) AS theatre_days,
        (SELECT max(observation_date)::text FROM territory_harmonisation.deepstate_liberated_theatre_daily) AS theatre_latest
    """)).mappings().one()
    return dict(row)


def infer_completed_stages(measured: dict, target: dict) -> set[str]:
    """Recognise already-current products after state loss or first deployment."""
    completed: set[str] = set()
    if measured.get("deepstate_latest") == target.get("deepstate"):
        completed.add("deepstate_russian_control_daily")
    if measured.get("isw_latest") == target.get("isw_control"):
        completed.add("isw_russian_control_daily")
    common_target = min(filter(None, (target.get("deepstate"), target.get("isw_control"))), default=None)
    if measured.get("comparison_latest") == common_target:
        completed.add("daily_geometry_comparison")
    if measured.get("theatre_latest") == target.get("deepstate"):
        completed.add("deepstate_liberated_theatre_daily")
    return completed


def refresh_theatre_dates(conn, target: dict) -> int:
    """Append missing dates one transaction at a time; safe to interrupt/resume."""
    days = [r[0] for r in conn.execute(text("""
      SELECT DISTINCT f.snapshot_date
      FROM deepstate_v2.features f
      LEFT JOIN territory_harmonisation.deepstate_liberated_theatre_daily t
        ON t.observation_date=f.snapshot_date
      WHERE f.control_status='liberated' AND t.observation_date IS NULL
      ORDER BY f.snapshot_date
    """))]
    for index, day in enumerate(days, 1):
        beat("refreshing_theatre_dates", day=str(day), completed=index-1,
             total=len(days), target=target)
        conn.execute(text("SET statement_timeout='2min'"))
        conn.execute(text(THEATRE_UPSERT), {"day": day})
        conn.commit()
    return len(days)


def main() -> int:
    load_dotenv(os.environ.get("DASH_ENV_FILE", "/mnt/g/My Drive/SYSTEM_CREDENTIALS.env"))
    engine = create_engine(os.environ["PG_WARDATASETS_URL"], connect_args={"connect_timeout": 30})
    ROOT.mkdir(parents=True, exist_ok=True)
    with exclusive_lock(), engine.connect() as conn:
        target = source_highwater(conn)
        previous = read_state()
        completed = set(previous.get("completed_stages", [])) if previous.get("target") == target else set()
        completed |= infer_completed_stages(validation(conn), target)
        state = {"status": "running", "started_at": now(), "updated_at": now(),
                 "target": target, "completed_stages": sorted(completed)}
        atomic_json(STATE, state)
        for stage in STAGES:
            if stage in completed:
                continue
            beat("refreshing", stage=stage, target=target)
            if stage == "deepstate_liberated_theatre_daily":
                refresh_theatre_dates(conn, target)
            else:
                conn.execute(text("SET statement_timeout='30min'"))
                conn.execute(text(f"REFRESH MATERIALIZED VIEW territory_harmonisation.{stage}"))
                conn.commit()
            completed.add(stage)
            state.update(updated_at=now(), completed_stages=sorted(completed))
            atomic_json(STATE, state)

        measured = validation(conn)
        if measured["deepstate_latest"] != target["deepstate"]:
            raise RuntimeError(f"DeepState high-water mismatch: {measured['deepstate_latest']} != {target['deepstate']}")
        if measured["isw_latest"] != target["isw_control"]:
            raise RuntimeError(f"ISW high-water mismatch: {measured['isw_latest']} != {target['isw_control']}")
        if measured["theatre_latest"] != target["deepstate"]:
            raise RuntimeError(f"theatre high-water mismatch: {measured['theatre_latest']} != {target['deepstate']}")
        state.update(status="healthy", updated_at=now(), completed_at=now(), validation=measured)
        atomic_json(STATE, state)
        beat("complete", status="healthy", validation=measured)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        atomic_json(STATE, {**read_state(), "status": "failed", "updated_at": now(),
                            "error": f"{type(exc).__name__}: {exc}"})
        beat("failed", status="failed", error=f"{type(exc).__name__}: {exc}")
        raise
