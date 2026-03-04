#!/usr/bin/env python3
"""
Unified Dataset Updater for war_datasets PostgreSQL DB.
=========================================================

Updates all auto-updatable datasets into the war_datasets DB on the VPS.
Each updater runs independently — one failure does NOT block others.

Daily updaters (10 datasets):
  equipment, acled, viina, opensanctions, crea, bruegel, missiles, hapi

Annual/periodic checkers (2 datasets):
  worldbank (GDP), unhcr (refugees)

Separate crons (not in default run):
  gdelt (events, gkg, varx)

Usage:
    python update_all_datasets.py              # All auto-updatable (10 daily + 2 annual)
    python update_all_datasets.py --crea       # CREA fossil revenue only
    python update_all_datasets.py --hapi       # HAPI humanitarian only
    python update_all_datasets.py --missiles   # Missile attacks (requires Kaggle CLI)
    python update_all_datasets.py --gdelt      # Include GDELT (opt-in, not in default run)
    python update_all_datasets.py --status     # Show all tables with staleness
    python update_all_datasets.py --days 30    # Override lookback for ACLED
"""

import sys
import os
import argparse
import datetime as dt
import traceback
from pathlib import Path

# Ensure the script's directory is on the path for relative imports
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

from updaters.base import load_env
from updaters.equipment import EquipmentUpdater
from updaters.opensanctions import OpenSanctionsUpdater
from updaters.acled import ACLEDUpdater
from updaters.viina import VIINAUpdater
from updaters.gdelt import GDELTUpdater
from updaters.crea import CREAUpdater
from updaters.bruegel import BruegelUpdater
from updaters.missiles import MissileUpdater
from updaters.hapi import HAPIUpdater
from updaters.worldbank import WorldBankGDPUpdater
from updaters.unhcr import UNHCRUpdater


# All tables tracked by the dashboard pipeline (for --status)
ALL_TABLES = {
    # Daily auto-updated
    "conflict_events.acled_events": {"date_col": "event_date", "auto": True},
    "conflict_events.viina_events": {"date_col": "date", "auto": True},
    "equipment_losses.equipment_daily": {"date_col": "date", "auto": True},
    "equipment_losses.personnel_daily": {"date_col": "date", "auto": True},
    "economic_data.opensanctions_eu": {"date_col": "first_seen", "auto": True},
    "economic_data.crea_russia_fossil": {"date_col": "date", "auto": True},
    "economic_data.bruegel_gas_flows": {"date_col": "date", "auto": True},
    "aerial_assaults.missile_attacks": {"date_col": "time_end", "auto": True},
    # HAPI humanitarian (weekly refresh from HDX)
    "humanitarian.hapi_food_prices": {"date_col": "reference_period_end", "auto": True},
    "humanitarian.hapi_idps": {"date_col": "reference_period_end", "auto": True},
    "humanitarian.hapi_humanitarian_needs": {"date_col": "reference_period_end", "auto": True},
    "humanitarian.hapi_funding": {"date_col": "reference_period_end", "auto": True},
    "humanitarian.hapi_refugees": {"date_col": "reference_period_end", "auto": True},
    "conflict_events.hapi_conflict_events": {"date_col": "reference_period_end", "auto": True},
    # Annual check
    "economic_data.world_bank_gdp": {"date_col": "year", "auto": True},
    "humanitarian.unhcr_population": {"date_col": "year", "auto": True},
    # GDELT (separate crons)
    "global_events.gdelt_events": {"date_col": "sqldate", "auto": False},
    "global_events.gdelt_gkg_coercive_quotations": {"date_col": "date", "auto": False},
    "global_events.gdelt_gkg_redline_quotations": {"date_col": "date", "auto": False},
    # Static / manual
    "conflict_events.ucdp_events": {"date_col": "date_start", "auto": False},
    "conflict_events.bellingcat_harm": {"date_col": "date", "auto": False},
    "economic_data.sipri_military_expenditure": {"date_col": "year", "auto": False},
    "western_sabotage.eurepoc_cyber_incidents": {"date_col": "start_date", "auto": False},
    "western_sabotage.euvsdisinfo_disinfo_cases": {"date_col": "date", "auto": False},
    "western_sabotage.baltic_cable_incidents": {"date_col": "date", "auto": False},
}


def log(msg):
    ts = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def show_status(config):
    """Show staleness of all 18 tracked tables."""
    import psycopg2
    from updaters.base import get_db_connection

    conn = get_db_connection(config)
    print()
    print("=" * 80)
    print(f"  DATASET STATUS — war_datasets @ {config.get('DB_HOST', 'localhost')}")
    print(f"  {dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    print(f"  {'Table':<50} {'Rows':>8} {'Last Date':>12} {'Stale':>6}  Auto")
    print(f"  {'-'*50} {'-'*8} {'-'*12} {'-'*6}  {'-'*4}")

    for table, info in ALL_TABLES.items():
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]

            max_date = None
            date_col = info["date_col"]
            try:
                with conn.cursor() as cur:
                    cur.execute(f"SELECT MAX({date_col}) FROM {table}")
                    val = cur.fetchone()[0]
                    if val is not None:
                        if isinstance(val, int):
                            if val > 99999999:
                                # GDELT-style YYYYMMDDHHMMSS bigint
                                dstr = str(val)[:8]
                                max_date = dt.date(int(dstr[:4]), int(dstr[4:6]), int(dstr[6:8]))
                            elif val > 9999:
                                # VIINA-style YYYYMMDD integer
                                max_date = dt.date(val // 10000, (val % 10000) // 100, val % 100)
                            elif val > 0:
                                # Year-only integer (e.g. World Bank GDP)
                                max_date = dt.date(val, 1, 1)
                        elif isinstance(val, dt.datetime):
                            max_date = val.date()
                        elif isinstance(val, dt.date):
                            max_date = val
                        elif isinstance(val, str):
                            # Text date column
                            try:
                                max_date = dt.datetime.strptime(val[:10], "%Y-%m-%d").date()
                            except ValueError:
                                pass
            except psycopg2.Error:
                conn.rollback()

            staleness = ""
            if max_date:
                days = (dt.date.today() - max_date).days
                staleness = f"{days}d"

            auto_mark = "YES" if info["auto"] else "  -"
            date_str = str(max_date) if max_date else "?"
            print(f"  {table:<50} {count:>8,} {date_str:>12} {staleness:>6}  {auto_mark}")

        except psycopg2.Error as e:
            conn.rollback()
            print(f"  {table:<50} {'ERROR':>8} {str(e)[:30]}")

    print()
    print("  Auto=YES: Updated by this script | Auto=-: Manual/static dataset")
    print("  Stale: days since last data point")
    print()
    conn.close()


def run_updater(updater, name):
    """Run a single updater with error handling. Returns (name, success, result_or_error)."""
    try:
        log(f"--- Starting {name} ---")
        result = updater.run()
        updater.close()
        log(f"--- {name} completed successfully ---")
        return (name, True, result)
    except Exception as e:
        log(f"--- {name} FAILED: {e} ---")
        traceback.print_exc()
        try:
            updater.close()
        except Exception:
            pass
        return (name, False, str(e))


def main():
    parser = argparse.ArgumentParser(
        description="Unified dataset updater for war_datasets DB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--acled", action="store_true", help="Update ACLED events")
    parser.add_argument("--viina", action="store_true", help="Update VIINA events")
    parser.add_argument("--equipment", action="store_true", help="Update equipment + personnel losses")
    parser.add_argument("--opensanctions", action="store_true", help="Update OpenSanctions EU")
    parser.add_argument("--crea", action="store_true", help="Update CREA fossil revenue")
    parser.add_argument("--bruegel", action="store_true", help="Update Bruegel gas flows")
    parser.add_argument("--missiles", action="store_true", help="Update missile attacks (Kaggle)")
    parser.add_argument("--hapi", action="store_true", help="Update HAPI humanitarian data (HDX)")
    parser.add_argument("--worldbank", action="store_true", help="Update World Bank GDP")
    parser.add_argument("--unhcr", action="store_true", help="Update UNHCR refugee data")
    parser.add_argument("--gdelt", action="store_true", help="Run GDELT update (opt-in, not in default)")
    parser.add_argument("--status", action="store_true", help="Show all table statuses and exit")
    parser.add_argument("--days", type=int, default=None, help="Lookback days for ACLED (default: auto)")

    args = parser.parse_args()

    config = load_env(SCRIPT_DIR / ".env")

    # --status mode
    if args.status:
        show_status(config)
        return

    # Determine which updaters to run
    specific = (args.acled or args.viina or args.equipment or args.opensanctions
                or args.crea or args.bruegel or args.missiles or args.hapi
                or args.worldbank or args.unhcr or args.gdelt)
    run_all = not specific  # If no specific flags, run all auto-updatable (except GDELT)

    updaters_to_run = []

    if run_all or args.equipment:
        updaters_to_run.append(("Equipment + Personnel", EquipmentUpdater(config)))

    if run_all or args.opensanctions:
        updaters_to_run.append(("OpenSanctions", OpenSanctionsUpdater(config)))

    if run_all or args.acled:
        updaters_to_run.append(("ACLED", ACLEDUpdater(config, days_back=args.days)))

    if run_all or args.viina:
        updaters_to_run.append(("VIINA", VIINAUpdater(config)))

    if run_all or args.crea:
        updaters_to_run.append(("CREA Fossil Revenue", CREAUpdater(config)))

    if run_all or args.bruegel:
        updaters_to_run.append(("Bruegel Gas Flows", BruegelUpdater(config)))

    if run_all or args.missiles:
        updaters_to_run.append(("Missile Attacks", MissileUpdater(config)))

    if run_all or args.hapi:
        updaters_to_run.append(("HAPI Humanitarian", HAPIUpdater(config)))

    if run_all or args.worldbank:
        updaters_to_run.append(("World Bank GDP", WorldBankGDPUpdater(config)))

    if run_all or args.unhcr:
        updaters_to_run.append(("UNHCR Refugees", UNHCRUpdater(config)))

    if args.gdelt:
        updaters_to_run.append(("GDELT", GDELTUpdater(config)))

    if not updaters_to_run:
        parser.print_help()
        return

    # Run each updater
    log(f"=== Starting unified update ({len(updaters_to_run)} datasets) ===")
    results = []
    for name, updater in updaters_to_run:
        results.append(run_updater(updater, name))

    # Summary
    print()
    log("=" * 60)
    log("UPDATE SUMMARY")
    log("=" * 60)
    success_count = 0
    fail_count = 0
    for name, success, detail in results:
        if success:
            success_count += 1
            log(f"  OK  {name}: {detail}")
        else:
            fail_count += 1
            log(f"  FAIL  {name}: {detail}")

    log(f"  Total: {success_count} succeeded, {fail_count} failed")
    log("=" * 60)

    # Exit with error code if any failed
    if fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
