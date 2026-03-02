#!/usr/bin/env python3
"""
Incremental Data Change Detection

Connects to the DB, queries MAX(date_column) and COUNT(*) for each tracked
dataset, and compares with the stored _export_meta.json.

Exit codes:
  0 = changes found (sets CHANGED_KEYS GitHub Actions output)
  1 = no changes detected
"""

import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import psycopg2
import psycopg2.extras

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '5433')),
    'dbname': os.environ.get('DB_NAME', 'russian_ukrainian_war'),
    'user': os.environ.get('DB_USER', 'isw'),
    'password': os.environ.get('DB_PASSWORD', 'isw2026'),
}

OUTPUT_DIR = Path(os.environ.get('OUTPUT_DIR', str(Path(__file__).parent.parent / 'public' / 'data')))
META_FILE = OUTPUT_DIR / '_export_meta.json'

# Dataset key -> (schema.table, date_column_expression | None for count-only)
DATASETS = {
    'acled':           ('conflict_events.acled_events',                 'event_date'),
    'ucdp':            ('conflict_events.ucdp_events',                 'date_start::date'),
    'viina':           ('conflict_events.viina_events',                 "TO_DATE(date::text, 'YYYYMMDD')"),
    'bellingcat':      ('conflict_events.bellingcat_harm',              'date'),
    'missiles':        ('aerial_assaults.missile_attacks',              'time_start::date'),
    'equipment':       ('equipment_losses.equipment_daily',             'date'),
    'personnel':       ('equipment_losses.personnel_daily',             'date'),
    'ohchr':           ('casualties.ohchr_casualties',                  None),
    'gdelt_events':    ('global_events.gdelt_events',                  "TO_DATE(sqldate::text, 'YYYYMMDD')"),
    'gdelt_coercive':  ('global_events.gdelt_gkg_coercive_quotations', "TO_DATE((date / 1000000)::text, 'YYYYMMDD')"),
    'gdelt_redlines':  ('global_events.gdelt_gkg_redline_quotations',  "TO_DATE((date / 1000000)::text, 'YYYYMMDD')"),
    'gas_flows':       ('economic_data.bruegel_gas_flows',              'date'),
    'fossil_revenue':  ('economic_data.crea_russia_fossil',             'date'),
    'sanctions':       ('economic_data.opensanctions_eu',               None),
    'cyber':           ('western_sabotage.eurepoc_cyber_incidents',     None),
    'disinfo':         ('western_sabotage.euvsdisinfo_disinfo_cases',   None),
    'baltic':          ('western_sabotage.baltic_cable_incidents',      None),
    'leiden':          ('western_sabotage.leiden_events',               None),
}


class MetaEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def load_meta():
    """Load existing metadata or return empty dict."""
    if META_FILE.exists():
        with open(META_FILE) as f:
            return json.load(f)
    return {}


def save_meta(meta):
    """Write metadata file."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(META_FILE, 'w') as f:
        json.dump(meta, f, cls=MetaEncoder, indent=2)


def query_current_state(conn):
    """Query the current max_date and count for every tracked dataset."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    current = {}

    for key, (table, date_expr) in DATASETS.items():
        try:
            if date_expr:
                sql = f"SELECT MAX({date_expr}) as max_date, COUNT(*) as count FROM {table}"
            else:
                sql = f"SELECT COUNT(*) as count FROM {table}"
            cur.execute(sql)
            row = dict(cur.fetchone())

            entry = {'count': row['count']}
            if date_expr:
                md = row.get('max_date')
                entry['max_date'] = md.isoformat() if isinstance(md, (date, datetime)) else str(md) if md else None
            current[key] = entry
        except Exception as e:
            print(f"  WARNING: Failed to query {key} ({table}): {e}")
            conn.rollback()

    cur.close()
    return current


def diff_meta(old_meta, new_state):
    """Compare old metadata with new DB state. Return list of changed keys."""
    changed = []
    for key, new_val in new_state.items():
        old_val = old_meta.get(key, {})
        if old_val.get('count') != new_val.get('count'):
            changed.append(key)
        elif old_val.get('max_date') != new_val.get('max_date'):
            changed.append(key)
    return changed


def main():
    print("=" * 50)
    print("INCREMENTAL DATA CHECK")
    print("=" * 50)

    conn = psycopg2.connect(**DB_CONFIG)
    print(f"Connected to {DB_CONFIG['dbname']} on {DB_CONFIG['host']}:{DB_CONFIG['port']}")

    try:
        old_meta = load_meta()
        new_state = query_current_state(conn)
        changed = diff_meta(old_meta, new_state)

        if not changed:
            print("\nNo changes detected. Exiting.")
            sys.exit(1)

        print(f"\nChanges detected in {len(changed)} dataset(s):")
        for key in changed:
            old = old_meta.get(key, {})
            new = new_state[key]
            print(f"  {key}: count {old.get('count', '?')} -> {new['count']}, "
                  f"max_date {old.get('max_date', '?')} -> {new.get('max_date', '?')}")

        # Save updated metadata
        save_meta(new_state)

        # Set GitHub Actions output
        github_output = os.environ.get('GITHUB_OUTPUT')
        keys_str = ','.join(changed)
        if github_output:
            with open(github_output, 'a') as f:
                f.write(f"changed_keys={keys_str}\n")
        print(f"\nCHANGED_KEYS={keys_str}")

        sys.exit(0)

    finally:
        conn.close()


if __name__ == '__main__':
    main()
