#!/usr/bin/env python3
"""Audit and repair deterministic ISW metadata classification defects.

Only evidence encoded in the archive filename is allowed to overwrite a source
date. Unparseable dates remain visible as ``legacy_unverified``; import or file
mtime is never treated as observation time. Every mutation is recorded in
``isw.metadata_correction_audit`` and the default mode is read-only.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("isw_importer", HERE / "import_isw_shapefiles.py")
PARSER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(PARSER)


DDL = """
ALTER TABLE isw.shapefile_metadata
  ADD COLUMN IF NOT EXISTS date_provenance text NOT NULL DEFAULT 'legacy_unverified';

CREATE TABLE IF NOT EXISTS isw.metadata_correction_audit (
  id bigserial PRIMARY KEY,
  metadata_id integer NOT NULL REFERENCES isw.shapefile_metadata(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  reason text NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metadata_id, field_name, new_value)
);
"""


def proposed_changes(rows):
    changes = []
    provenance = []
    for row in rows:
        rid, filename, conflict, layer_type, layer_date = row
        parsed_date = PARSER.parse_date_from_filename(filename)
        provenance.append((rid, "filename_explicit" if parsed_date else "legacy_unverified"))
        if parsed_date and parsed_date != layer_date:
            changes.append((rid, "layer_date", str(layer_date), parsed_date.isoformat(),
                            "deterministic_filename_date_parser"))

        parsed_conflict = PARSER.classify_conflict(filename)
        if parsed_conflict != "other" and parsed_conflict != conflict:
            changes.append((rid, "conflict", conflict, parsed_conflict,
                            "deterministic_filename_theatre_classifier"))

        parsed_layer = PARSER.classify_layer_type(filename)
        replaceable = layer_type.endswith("_other") or "palestinian_infiltration" in layer_type
        if parsed_layer != layer_type and parsed_layer != "unknown" and replaceable:
            changes.append((rid, "layer_type", layer_type, parsed_layer,
                            "deterministic_filename_layer_classifier"))
    return changes, provenance


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="commit the audited corrections")
    args = ap.parse_args()

    load_dotenv(os.environ.get("ISW_ENV_FILE", "/mnt/g/My Drive/SYSTEM_CREDENTIALS.env"))
    engine = create_engine(os.environ["PG_WARDATASETS_URL"])
    with engine.begin() as conn:
        rows = conn.execute(text("""
          SELECT id, filename, conflict::text, layer_type, layer_date
          FROM isw.shapefile_metadata ORDER BY id
        """)).fetchall()
        changes, provenance = proposed_changes(rows)
        counts = {}
        for _, field, *_ in changes:
            counts[field] = counts.get(field, 0) + 1
        print({"rows": len(rows), "proposed": len(changes), "by_field": counts,
               "mode": "apply" if args.apply else "dry_run"})
        if not args.apply:
            return 0

        conn.execute(text(DDL))
        conn.execute(text("""
          UPDATE isw.shapefile_metadata AS sm
          SET date_provenance = v.provenance
          FROM (VALUES (:id, :provenance)) AS v(id, provenance)
          WHERE sm.id = v.id
        """), [{"id": rid, "provenance": value} for rid, value in provenance])

        for rid, field, old, new, reason in changes:
            if field == "layer_date":
                conn.execute(text("UPDATE isw.shapefile_metadata SET layer_date=CAST(:v AS date) WHERE id=:id"),
                             {"id": rid, "v": new})
            elif field == "conflict":
                conn.execute(text("UPDATE isw.shapefile_metadata SET conflict=CAST(:v AS isw.conflict_type) WHERE id=:id"),
                             {"id": rid, "v": new})
            else:
                conn.execute(text("UPDATE isw.shapefile_metadata SET layer_type=:v WHERE id=:id"),
                             {"id": rid, "v": new})
            conn.execute(text("""
              INSERT INTO isw.metadata_correction_audit
                (metadata_id, field_name, old_value, new_value, reason)
              VALUES (:id, :field, :old, :new, :reason)
              ON CONFLICT (metadata_id, field_name, new_value) DO NOTHING
            """), {"id": rid, "field": field, "old": old, "new": new, "reason": reason})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
