#!/usr/bin/env python3
"""
Selective Export Wrapper

Reads CHANGED_KEYS (comma-separated dataset keys) from env or CLI arg,
maps them to the appropriate export functions, and runs only those.
Always re-exports overview_stats if anything changed.
"""

import os
import sys
from pathlib import Path

# Add parent so we can import the export module
sys.path.insert(0, str(Path(__file__).parent))

from export_all_dashboard_data import (
    get_connection, export_overview_stats,
    # Conflict events
    export_daily_events, export_events_by_type, export_events_by_region,
    export_monthly_events, export_viina_events, export_viina_aggregates,
    export_viina_by_event_type, export_bellingcat_incidents,
    export_bellingcat_by_impact, export_ucdp_by_violence_type, export_acled_hdx,
    # Aerial
    export_daily_aerial_threats, export_weapon_types,
    # Equipment & personnel
    export_equipment_daily, export_personnel_daily,
    # Casualties
    export_casualties_ohchr,
    # GDELT
    export_gdelt_events, export_gdelt_coercive, export_gdelt_redlines,
    export_gdelt_varx,
    # Economic
    export_economic_energy, export_economic_aid, export_economic_sanctions,
    export_economic_military,
    # Sabotage
    export_sabotage_cyber, export_sabotage_disinfo,
    export_sabotage_infrastructure, export_sabotage_hybrid,
)

# Map each changed key to the export functions that need to run
GROUP_MAP = {
    'acled': [
        export_daily_events, export_events_by_type,
        export_events_by_region, export_monthly_events, export_acled_hdx,
    ],
    'ucdp': [
        export_daily_events, export_ucdp_by_violence_type,
    ],
    'viina': [
        export_viina_events, export_viina_aggregates,
        export_viina_by_event_type,
    ],
    'bellingcat': [
        export_bellingcat_incidents, export_bellingcat_by_impact,
    ],
    'missiles': [
        export_daily_aerial_threats, export_weapon_types,
    ],
    'equipment': [
        export_equipment_daily,
    ],
    'personnel': [
        export_personnel_daily,
    ],
    'ohchr': [
        export_casualties_ohchr,
    ],
    'gdelt_events': [
        export_gdelt_events, export_gdelt_varx,
    ],
    'gdelt_coercive': [
        export_gdelt_coercive, export_gdelt_varx,
    ],
    'gdelt_redlines': [
        export_gdelt_redlines, export_gdelt_varx,
    ],
    'gas_flows': [
        export_economic_energy,
    ],
    'fossil_revenue': [
        export_economic_energy,
    ],
    'sanctions': [
        export_economic_sanctions,
    ],
    'cyber': [
        export_sabotage_cyber,
    ],
    'disinfo': [
        export_sabotage_disinfo,
    ],
    'baltic': [
        export_sabotage_infrastructure,
    ],
    'leiden': [
        export_sabotage_hybrid,
    ],
}


def main():
    # Get changed keys from env (GitHub Actions) or CLI arg
    keys_str = os.environ.get('CHANGED_KEYS', '')
    if not keys_str and len(sys.argv) > 1:
        keys_str = sys.argv[1]

    if not keys_str:
        print("No CHANGED_KEYS provided. Nothing to export.")
        sys.exit(0)

    changed_keys = [k.strip() for k in keys_str.split(',') if k.strip()]
    print(f"Changed keys: {changed_keys}")

    # Collect unique export functions to run
    functions_to_run = set()
    for key in changed_keys:
        if key in GROUP_MAP:
            for fn in GROUP_MAP[key]:
                functions_to_run.add(fn)
        else:
            print(f"  WARNING: Unknown key '{key}', skipping")

    if not functions_to_run:
        print("No matching export functions. Nothing to do.")
        sys.exit(0)

    # Always include overview_stats when anything changed
    functions_to_run.add(export_overview_stats)

    print(f"\nRunning {len(functions_to_run)} export function(s)...")

    conn = get_connection()
    try:
        for fn in sorted(functions_to_run, key=lambda f: f.__name__):
            try:
                fn(conn)
            except Exception as e:
                print(f"  ERROR in {fn.__name__}: {e}")
                conn.rollback()
    finally:
        conn.close()

    print("\nSelective export complete.")


if __name__ == '__main__':
    main()
