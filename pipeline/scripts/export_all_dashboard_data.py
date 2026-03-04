#!/usr/bin/env python3
"""
Comprehensive Dashboard Data Export

Exports ALL datasets from the russian_ukrainian_war database to static JSON files
for the React dashboard. Run this script whenever data is updated.

Output: dashboard/public/data/
"""

import json
import os
import csv
from datetime import datetime, date
from pathlib import Path
from decimal import Decimal

import psycopg2
import psycopg2.extras
import pandas as pd

# =============================================================================
# CONFIGURATION
# =============================================================================
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '5433')),
    'dbname': os.environ.get('DB_NAME', 'russian_ukrainian_war'),
    'user': os.environ.get('DB_USER', 'isw'),
    'password': os.environ.get('DB_PASSWORD', 'isw2026'),
}

OUTPUT_DIR = Path(os.environ.get('EXPORT_OUTPUT_DIR', str(Path(__file__).parent / 'dashboard' / 'public' / 'data')))

# CSV/JSON source files for new datasets
DATA_DIR = Path(__file__).parent
PETROIVANIUK_EQUIPMENT_CSV = DATA_DIR / 'Equipment Losses' / 'PetroIvaniuk-Kaggle' / 'russia_losses_equipment.csv'
ORYX_EQUIPMENT_CSV = DATA_DIR / 'Equipment Losses' / 'equipment_losses_oryx_daily.csv'
UKRDAILYUPDATE_CSV = DATA_DIR / 'Equipment Losses' / 'ukrdailyupdate' / 'losses_public_version.csv'
KAGGLE_MISSILES_CSV = DATA_DIR / 'Missile Attacks Kaggle' / 'missile_attacks_daily.csv'
KIU_OFFICERS_CSV = DATA_DIR / 'Russian Casualties' / 'KIU_Russian_Officers_Killed.csv'
PETROIVANIUK_PERSONNEL_JSON = DATA_DIR / 'Russian Casualties' / 'PetroIvaniuk_personnel_losses.json'


class DateEncoder(json.JSONEncoder):
    """JSON encoder that handles date objects and Decimals."""
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_connection():
    """Get database connection."""
    return psycopg2.connect(**DB_CONFIG)


def query_to_list(conn, sql, params=None):
    """Execute query and return list of dicts."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or ())
    rows = cur.fetchall()
    cur.close()
    return [dict(row) for row in rows]


def query_one(conn, sql, params=None):
    """Execute query and return single dict."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or ())
    row = cur.fetchone()
    cur.close()
    return dict(row) if row else {}


def save_json(data, filename):
    """Save data to JSON file."""
    path = OUTPUT_DIR / filename
    with open(path, 'w') as f:
        json.dump(data, f, cls=DateEncoder)
    count = len(data) if isinstance(data, list) else 'object'
    print(f"  Saved {filename} ({count})")


# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

def export_overview_stats(conn):
    """Export overview statistics with date ranges for each dataset."""
    print("\n[1/15] Exporting overview stats...")

    stats = {'totals': {}, 'date_ranges': {}}

    # ACLED events
    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(event_date) as min_date, MAX(event_date) as max_date
        FROM conflict_events.acled_events
    """)
    stats['totals']['acled_events'] = row['count']
    stats['date_ranges']['acled_start'] = row['min_date']
    stats['date_ranges']['acled_end'] = row['max_date']

    # UCDP events
    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date_start::date) as min_date, MAX(date_start::date) as max_date
        FROM conflict_events.ucdp_events
    """)
    stats['totals']['ucdp_events'] = row['count']
    stats['date_ranges']['ucdp_start'] = row['min_date']
    stats['date_ranges']['ucdp_end'] = row['max_date']

    # VIINA events (date is stored as integer YYYYMMDD)
    row = query_one(conn, """
        SELECT COUNT(*) as count,
               TO_DATE(MIN(date)::text, 'YYYYMMDD') as min_date,
               TO_DATE(MAX(date)::text, 'YYYYMMDD') as max_date
        FROM conflict_events.viina_events
    """)
    stats['totals']['viina_events'] = row['count']
    stats['date_ranges']['viina_start'] = row['min_date']
    stats['date_ranges']['viina_end'] = row['max_date']

    # Bellingcat incidents
    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
        FROM conflict_events.bellingcat_harm
    """)
    stats['totals']['bellingcat_incidents'] = row['count']
    stats['date_ranges']['bellingcat_start'] = row['min_date']
    stats['date_ranges']['bellingcat_end'] = row['max_date']

    # Aerial assaults (missiles)
    row = query_one(conn, """
        SELECT
            COUNT(DISTINCT time_start::date) as attack_count,
            COALESCE(SUM(launched), 0) as total_launched,
            COALESCE(SUM(destroyed), 0) as total_destroyed,
            MIN(time_start::date) as min_date,
            MAX(time_start::date) as max_date
        FROM aerial_assaults.missile_attacks
    """)
    stats['totals']['missile_attacks'] = row['attack_count']
    stats['totals']['total_missiles_launched'] = int(row['total_launched'] or 0)
    stats['totals']['total_missiles_intercepted'] = int(row['total_destroyed'] or 0)
    stats['date_ranges']['missiles_start'] = row['min_date']
    stats['date_ranges']['missiles_end'] = row['max_date']

    # Equipment losses
    row = query_one(conn, """
        SELECT
            MAX(tank) as tanks,
            MAX(aircraft) as aircraft,
            MIN(date) as min_date,
            MAX(date) as max_date
        FROM equipment_losses.equipment_daily
    """)
    stats['totals']['total_tanks_destroyed'] = row['tanks'] or 0
    stats['totals']['total_aircraft_destroyed'] = row['aircraft'] or 0
    stats['date_ranges']['equipment_start'] = row['min_date']
    stats['date_ranges']['equipment_end'] = row['max_date']

    # Personnel
    row = query_one(conn, """
        SELECT MAX(personnel) as personnel
        FROM equipment_losses.personnel_daily
    """)
    stats['totals']['total_personnel'] = row['personnel'] or 0

    # OHCHR casualties
    row = query_one(conn, """
        SELECT
            COALESCE(SUM(killed), 0) as killed,
            COALESCE(SUM(injured), 0) as injured,
            MIN(make_date(year, month, 1)) as min_date,
            MAX(make_date(year, month, 1)) as max_date
        FROM casualties.ohchr_casualties
    """)
    stats['totals']['ohchr_killed'] = row['killed'] or 0
    stats['totals']['ohchr_injured'] = row['injured'] or 0
    stats['date_ranges']['ohchr_start'] = row['min_date']
    stats['date_ranges']['ohchr_end'] = row['max_date']

    # GDELT events
    row = query_one(conn, """
        SELECT COUNT(*) as count,
               MIN(TO_DATE(sqldate::text, 'YYYYMMDD')) as min_date,
               MAX(TO_DATE(sqldate::text, 'YYYYMMDD')) as max_date
        FROM global_events.gdelt_events
    """)
    stats['totals']['gdelt_threat_events'] = row['count']
    stats['date_ranges']['gdelt_start'] = row['min_date']
    stats['date_ranges']['gdelt_end'] = row['max_date']

    # GDELT coercive quotations
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM global_events.gdelt_gkg_coercive_quotations
    """)
    stats['totals']['gdelt_coercive_records'] = row['count']

    # GDELT red line quotations
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM global_events.gdelt_gkg_redline_quotations
    """)
    stats['totals']['gdelt_redline_records'] = row['count']

    # Economic: gas flows
    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
        FROM economic_data.bruegel_gas_flows
    """)
    stats['totals']['gas_flow_records'] = row['count']
    stats['date_ranges']['gas_start'] = row['min_date']
    stats['date_ranges']['gas_end'] = row['max_date']

    # Economic: fossil revenue
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM economic_data.crea_russia_fossil
    """)
    stats['totals']['fossil_revenue_records'] = row['count']

    # Economic: sanctions
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM economic_data.opensanctions_eu
    """)
    stats['totals']['eu_sanctions_entities'] = row['count']

    # Sabotage: cyber incidents
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM western_sabotage.eurepoc_cyber_incidents
    """)
    stats['totals']['cyber_incidents'] = row['count']

    # Sabotage: disinfo cases
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM western_sabotage.euvsdisinfo_disinfo_cases
    """)
    stats['totals']['disinfo_cases'] = row['count']

    # Sabotage: Baltic cable incidents
    row = query_one(conn, """
        SELECT COUNT(*) as count FROM western_sabotage.baltic_cable_incidents
    """)
    stats['totals']['baltic_cable_incidents'] = row['count']

    stats['export_timestamp'] = datetime.now().isoformat()

    save_json(stats, 'overview_stats.json')
    return stats


def export_daily_events(conn):
    """Export daily event counts from ACLED and UCDP."""
    print("\n[2/15] Exporting daily events...")

    data = query_to_list(conn, """
        WITH acled_daily AS (
            SELECT event_date as date, COUNT(*) as events, COALESCE(SUM(fatalities), 0) as fatalities
            FROM conflict_events.acled_events
            GROUP BY event_date
        ),
        ucdp_daily AS (
            SELECT date_start::date as date, COUNT(*) as events, COALESCE(SUM(best), 0) as fatalities
            FROM conflict_events.ucdp_events
            GROUP BY date_start::date
        )
        SELECT
            COALESCE(a.date, u.date) as date,
            COALESCE(a.events, 0) as acled_events,
            COALESCE(a.fatalities, 0) as acled_fatalities,
            COALESCE(u.events, 0) as ucdp_events,
            COALESCE(u.fatalities, 0) as ucdp_fatalities
        FROM acled_daily a
        FULL OUTER JOIN ucdp_daily u ON a.date = u.date
        ORDER BY date
    """)

    save_json(data, 'daily_events.json')
    return data


def export_events_by_type(conn):
    """Export event breakdown by type from ACLED."""
    print("\n[3/15] Exporting events by type...")

    data = query_to_list(conn, """
        SELECT
            event_type,
            sub_event_type,
            COUNT(*) as count,
            COALESCE(SUM(fatalities), 0) as fatalities
        FROM conflict_events.acled_events
        GROUP BY event_type, sub_event_type
        ORDER BY count DESC
    """)

    save_json(data, 'events_by_type.json')
    return data


def export_events_by_region(conn):
    """Export event counts by region from ACLED."""
    print("\n[4/15] Exporting events by region...")

    data = query_to_list(conn, """
        SELECT
            admin1 as region,
            COUNT(*) as events,
            COALESCE(SUM(fatalities), 0) as fatalities,
            MIN(event_date) as first_event,
            MAX(event_date) as last_event
        FROM conflict_events.acled_events
        GROUP BY admin1
        ORDER BY events DESC
    """)

    save_json(data, 'events_by_region.json')
    return data


def export_monthly_events(conn):
    """Export monthly event breakdown by type from ACLED."""
    print("\n[5/15] Exporting monthly events...")

    data = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', event_date)::date as month,
            event_type,
            COUNT(*) as events,
            COALESCE(SUM(fatalities), 0) as fatalities
        FROM conflict_events.acled_events
        GROUP BY DATE_TRUNC('month', event_date), event_type
        ORDER BY month, event_type
    """)

    save_json(data, 'monthly_events.json')
    return data


def export_daily_aerial_threats(conn):
    """Export daily aerial threat data."""
    print("\n[6/15] Exporting daily aerial threats...")

    # is_shahed contains actual drone count when NOT NULL, not a boolean flag
    data = query_to_list(conn, """
        SELECT
            time_start::date as date,
            COALESCE(SUM(launched), 0)::int as total_launched,
            COALESCE(SUM(destroyed), 0)::int as total_destroyed,
            COALESCE(SUM(is_shahed), 0)::int as drones_launched,
            COALESCE(SUM(CASE WHEN is_shahed IS NOT NULL THEN destroyed ELSE 0 END), 0)::int as drones_destroyed,
            COALESCE(SUM(CASE WHEN is_shahed IS NULL THEN launched ELSE 0 END), 0)::int as missiles_launched,
            COALESCE(SUM(CASE WHEN is_shahed IS NULL THEN destroyed ELSE 0 END), 0)::int as missiles_destroyed,
            COUNT(DISTINCT time_start) as attack_waves
        FROM aerial_assaults.missile_attacks
        GROUP BY time_start::date
        ORDER BY date
    """)

    save_json(data, 'daily_aerial_threats.json')
    return data


def export_weapon_types(conn):
    """Export weapon type summary."""
    print("\n[7/15] Exporting weapon types summary...")

    data = query_to_list(conn, """
        SELECT
            model,
            COALESCE(SUM(launched), 0)::int as total_launched,
            COALESCE(SUM(destroyed), 0)::int as total_destroyed,
            CASE
                WHEN SUM(launched) > 0 THEN ROUND((SUM(destroyed)::numeric / SUM(launched)::numeric * 100)::numeric, 1)
                ELSE 0
            END as intercept_rate,
            COUNT(*) as attack_count
        FROM aerial_assaults.missile_attacks
        WHERE model IS NOT NULL AND model != ''
        GROUP BY model
        HAVING SUM(launched) > 0
        ORDER BY total_launched DESC
    """)

    save_json(data, 'weapon_types_summary.json')
    return data


def export_equipment_daily(conn):
    """Export daily equipment loss data."""
    print("\n[8/15] Exporting equipment daily...")

    data = query_to_list(conn, """
        SELECT
            date,
            day,
            tank,
            apc,
            field_artillery,
            mrl,
            anti_aircraft,
            aircraft,
            helicopter,
            drone,
            cruise_missiles,
            naval_ship,
            vehicles_fuel_tanks,
            special_equipment
        FROM equipment_losses.equipment_daily
        ORDER BY date
    """)

    save_json(data, 'equipment_daily.json')
    return data


def export_personnel_daily(conn):
    """Export daily personnel loss data."""
    print("\n[9/15] Exporting personnel daily...")

    data = query_to_list(conn, """
        SELECT
            date,
            day,
            personnel
        FROM equipment_losses.personnel_daily
        ORDER BY date
    """)

    save_json(data, 'personnel_daily.json')
    return data


def export_casualties_ohchr(conn):
    """Export OHCHR casualty data."""
    print("\n[10/15] Exporting OHCHR casualties...")

    data = query_to_list(conn, """
        SELECT
            year,
            month,
            adm1_name as region,
            COALESCE(killed, 0) as killed,
            COALESCE(injured, 0) as injured,
            COALESCE(total_affected, killed + injured, 0) as total
        FROM casualties.ohchr_casualties
        ORDER BY year, month
    """)

    save_json(data, 'casualties_ohchr.json')
    return data


def export_refugees_by_country(conn):
    """Export refugee data by country."""
    print("\n[11/15] Exporting refugees by country...")

    data = query_to_list(conn, """
        SELECT
            year,
            asylum_name as country_of_asylum,
            COALESCE(refugees, 0) as refugees,
            COALESCE(asylum_seekers, 0) as asylum_seekers
        FROM humanitarian.unhcr_population
        WHERE origin_name = 'Ukraine'
        ORDER BY year, refugees DESC
    """)

    save_json(data, 'refugees_by_country.json')
    return data


def export_refugee_totals(conn):
    """Export refugee totals by year."""
    print("\n[12/15] Exporting refugee totals...")

    data = query_to_list(conn, """
        SELECT
            year,
            COALESCE(SUM(refugees), 0) as total_refugees,
            COALESCE(SUM(asylum_seekers), 0) as total_asylum_seekers,
            COALESCE(SUM(idps), 0) as total_idps,
            COUNT(DISTINCT asylum_name) as destination_countries
        FROM humanitarian.unhcr_population
        WHERE origin_name = 'Ukraine'
        GROUP BY year
        ORDER BY year
    """)

    save_json(data, 'refugee_totals.json')
    return data


def export_viina_events(conn):
    """Export VIINA event data split by quarter/period to keep files under 100MB."""
    print("\n[13/15] Exporting VIINA events (split by period)...")

    # Define periods to split the data (quarters for 2022, half-years for 2023, years after)
    periods = [
        ('2022_q1', '20220101', '20220331'),
        ('2022_q2', '20220401', '20220630'),
        ('2022_q3', '20220701', '20220930'),
        ('2022_q4', '20221001', '20221231'),
        ('2023_h1', '20230101', '20230630'),
        ('2023_h2', '20230701', '20231231'),
        ('2024', '20240101', '20241231'),
        ('2025_2026', '20250101', '20261231'),
    ]

    all_data = []
    for period_name, start_date, end_date in periods:
        data = query_to_list(conn, """
            SELECT
                to_date(date::text, 'YYYYMMDD') as date,
                event_id,
                asciiname as location,
                adm1_name as oblast,
                text as description,
                source,
                latitude,
                longitude
            FROM conflict_events.viina_events
            WHERE date IS NOT NULL
              AND date >= %s::int
              AND date <= %s::int
            ORDER BY date
        """, (int(start_date), int(end_date)))

        if data:
            save_json(data, f'viina_events_{period_name}.json')
            all_data.extend(data)

    print(f"  Total VIINA events: {len(all_data)}")
    return all_data


def export_bellingcat_incidents(conn):
    """Export Bellingcat civilian harm incidents."""
    print("\n[14/15] Exporting Bellingcat incidents...")

    data = query_to_list(conn, """
        SELECT
            date,
            location,
            description,
            sources,
            latitude,
            longitude
        FROM conflict_events.bellingcat_harm
        ORDER BY date
    """)

    save_json(data, 'bellingcat_incidents.json')

    # Daily aggregates for charts
    daily = query_to_list(conn, """
        SELECT
            date,
            COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        GROUP BY date
        ORDER BY date
    """)
    save_json(daily, 'bellingcat_daily.json')

    # Monthly aggregates
    monthly = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', date)::date as month,
            COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month
    """)
    save_json(monthly, 'bellingcat_monthly.json')

    return data


def export_viina_aggregates(conn):
    """Export VIINA aggregated data for charts (daily/weekly/monthly/by source/by oblast)."""
    print("\n[16/17] Exporting VIINA aggregates...")

    # Daily events
    daily = query_to_list(conn, """
        SELECT
            TO_DATE(date::text, 'YYYYMMDD') as date,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL
        GROUP BY date
        ORDER BY date
    """)
    save_json(daily, 'viina_daily.json')

    # Weekly events
    weekly = query_to_list(conn, """
        SELECT
            DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD'))::date as week,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD'))
        ORDER BY week
    """)
    save_json(weekly, 'viina_weekly.json')

    # Monthly events
    monthly = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))
        ORDER BY month
    """)
    save_json(monthly, 'viina_monthly.json')

    # Events by source (news outlet)
    by_source = query_to_list(conn, """
        SELECT
            source,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY events DESC
    """)
    save_json(by_source, 'viina_by_source.json')

    # Events by oblast
    by_oblast = query_to_list(conn, """
        SELECT
            adm1_name as oblast,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE adm1_name IS NOT NULL
        GROUP BY adm1_name
        ORDER BY events DESC
    """)
    save_json(by_oblast, 'viina_by_oblast.json')

    # Daily by source (for stacked chart)
    daily_by_source = query_to_list(conn, """
        SELECT
            TO_DATE(date::text, 'YYYYMMDD') as date,
            source,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY TO_DATE(date::text, 'YYYYMMDD'), source
        ORDER BY date, source
    """)
    save_json(daily_by_source, 'viina_daily_by_source.json')

    # Weekly by source (for stacked chart)
    weekly_by_source = query_to_list(conn, """
        SELECT
            DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD'))::date as week,
            source,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD')), source
        ORDER BY week, source
    """)
    save_json(weekly_by_source, 'viina_weekly_by_source.json')

    # Monthly by source (for stacked chart)
    monthly_by_source = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month,
            source,
            COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD')), source
        ORDER BY month, source
    """)
    save_json(monthly_by_source, 'viina_monthly_by_source.json')

    return daily


def export_territory_data(conn):
    """Export territory control time series."""
    print("\n[15/15] Exporting territory data...")

    data = query_to_list(conn, """
        SELECT
            layer_date as date,
            layer_type,
            area_km2
        FROM isw.clean_daily_areas
        WHERE conflict = 'ukraine'
        ORDER BY layer_date, layer_type
    """)

    # Reformat for dashboard
    formatted = []
    for row in data:
        formatted.append({
            'date': row['date'],
            'layerType': row['layer_type'],
            'areaKm2': round(float(row['area_km2']), 2),
        })

    save_json(formatted, 'daily_areas.json')
    return formatted


def export_hapi_data(conn):
    """Export HAPI humanitarian data."""
    print("\n[17/18] Exporting HAPI data...")

    # Food prices - monthly averages by commodity
    food_prices = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', reference_period_start)::date as month,
            commodity_name,
            commodity_category,
            AVG(price) as avg_price,
            COUNT(*) as records
        FROM humanitarian.hapi_food_prices
        WHERE price IS NOT NULL
        GROUP BY DATE_TRUNC('month', reference_period_start), commodity_name, commodity_category
        ORDER BY month, commodity_name
    """)
    save_json(food_prices, 'hapi_food_prices.json')

    # IDPs by oblast over time
    idps = query_to_list(conn, """
        SELECT
            reference_period_start as date,
            admin1_name as oblast,
            SUM(population) as idps
        FROM humanitarian.hapi_idps
        WHERE admin1_name IS NOT NULL
        GROUP BY reference_period_start, admin1_name
        ORDER BY reference_period_start, admin1_name
    """)
    save_json(idps, 'hapi_idps.json')

    # IDPs national totals over time
    idps_total = query_to_list(conn, """
        SELECT
            reference_period_start as date,
            SUM(population) as total_idps
        FROM humanitarian.hapi_idps
        GROUP BY reference_period_start
        ORDER BY reference_period_start
    """)
    save_json(idps_total, 'hapi_idps_total.json')

    # Humanitarian needs
    humanitarian_needs = query_to_list(conn, """
        SELECT
            reference_period_start as date,
            admin1_name as oblast,
            population_status,
            population
        FROM humanitarian.hapi_humanitarian_needs
        WHERE admin1_name IS NOT NULL
        ORDER BY reference_period_start, admin1_name
    """)
    save_json(humanitarian_needs, 'hapi_humanitarian_needs.json')

    # Funding data
    funding = query_to_list(conn, """
        SELECT
            reference_period_start as date,
            requirements_usd,
            funding_usd,
            funding_pct
        FROM humanitarian.hapi_funding
        ORDER BY reference_period_start
    """)
    save_json(funding, 'hapi_funding.json')

    return food_prices


def export_ucdp_by_violence_type(conn):
    """Export UCDP events by violence type."""
    print("\n[18/21] Exporting UCDP by violence type...")

    # Total by violence type
    by_type = query_to_list(conn, """
        SELECT
            type_of_violence,
            CASE type_of_violence
                WHEN 1 THEN 'State-based'
                WHEN 2 THEN 'Non-state'
                WHEN 3 THEN 'One-sided'
                ELSE 'Unknown'
            END as violence_type_label,
            COUNT(*) as events,
            COALESCE(SUM(best), 0) as fatalities
        FROM conflict_events.ucdp_events
        WHERE country = 'Ukraine'
        GROUP BY type_of_violence
        ORDER BY events DESC
    """)
    save_json(by_type, 'ucdp_by_violence_type.json')

    # Monthly by violence type
    monthly = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', date_start::date)::date as month,
            type_of_violence,
            CASE type_of_violence
                WHEN 1 THEN 'State-based'
                WHEN 2 THEN 'Non-state'
                WHEN 3 THEN 'One-sided'
                ELSE 'Unknown'
            END as violence_type_label,
            COUNT(*) as events,
            COALESCE(SUM(best), 0) as fatalities
        FROM conflict_events.ucdp_events
        WHERE country = 'Ukraine'
        GROUP BY DATE_TRUNC('month', date_start::date), type_of_violence
        ORDER BY month, type_of_violence
    """)
    save_json(monthly, 'ucdp_monthly_by_type.json')

    return by_type


def export_bellingcat_by_impact(conn):
    """Export Bellingcat incidents by impact category."""
    print("\n[19/21] Exporting Bellingcat by impact category...")

    # Total by impact type
    by_impact = query_to_list(conn, """
        SELECT
            unnest(impact) as impact_type,
            COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        WHERE impact IS NOT NULL
        GROUP BY unnest(impact)
        ORDER BY incidents DESC
    """)
    save_json(by_impact, 'bellingcat_by_impact.json')

    # Monthly by impact type
    monthly = query_to_list(conn, """
        SELECT
            DATE_TRUNC('month', date)::date as month,
            unnest(impact) as impact_type,
            COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        WHERE impact IS NOT NULL
        GROUP BY DATE_TRUNC('month', date), unnest(impact)
        ORDER BY month, impact_type
    """)
    save_json(monthly, 'bellingcat_monthly_by_impact.json')

    return by_impact


def export_viina_by_event_type(conn):
    """Export VIINA events by ML-classified event type."""
    print("\n[20/21] Exporting VIINA by event type...")

    # Define the event type columns (using binary _b columns)
    event_types = [
        ('t_airstrike_b', 'Airstrike'),
        ('t_artillery_b', 'Artillery'),
        ('t_uav_b', 'UAV/Drone'),
        ('t_armor_b', 'Armor'),
        ('t_firefight_b', 'Firefight'),
        ('t_control_b', 'Territorial Control'),
        ('t_raid_b', 'Raid'),
        ('t_ied_b', 'IED/Mine'),
        ('t_property_b', 'Property Destruction'),
        ('t_hospital_b', 'Hospital/Humanitarian'),
        ('t_milcas_b', 'Military Casualties'),
        ('t_civcas_b', 'Civilian Casualties'),
        ('t_cyber_b', 'Cyber'),
        ('t_arrest_b', 'Arrest'),
        ('t_occupy_b', 'Occupation'),
        ('t_retreat_b', 'Retreat'),
        ('t_airalert_b', 'Air Alert'),
        ('t_aad_b', 'Anti-Air Defense'),
    ]

    # Build query for totals
    totals = []
    for col, label in event_types:
        result = query_to_list(conn, f"""
            SELECT
                '{label}' as event_type,
                COUNT(*) as events
            FROM conflict_events.viina_labels
            WHERE {col} = 1
        """)
        if result:
            totals.append(result[0])

    save_json(totals, 'viina_by_event_type.json')

    # Monthly by event type - create aggregated view
    monthly_data = []
    for col, label in event_types:
        monthly = query_to_list(conn, f"""
            SELECT
                DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month,
                '{label}' as event_type,
                COUNT(*) as events
            FROM conflict_events.viina_labels
            WHERE {col} = 1 AND date IS NOT NULL
            GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))
            ORDER BY month
        """)
        monthly_data.extend(monthly)

    save_json(monthly_data, 'viina_monthly_by_event_type.json')

    return totals


# =============================================================================
# NEW EXPORT FUNCTIONS (FROM CSV/JSON FILES)
# =============================================================================

def export_petroivaniuk_equipment():
    """Export PetroIvaniuk/Kaggle equipment losses (Ukraine MOD source)."""
    print("\n[21/26] Exporting PetroIvaniuk equipment data...")

    if not PETROIVANIUK_EQUIPMENT_CSV.exists():
        print(f"  WARNING: File not found: {PETROIVANIUK_EQUIPMENT_CSV}")
        return []

    df = pd.read_csv(PETROIVANIUK_EQUIPMENT_CSV)

    # Standardize column names
    column_map = {
        'date': 'date',
        'day': 'day',
        'aircraft': 'aircraft',
        'helicopter': 'helicopter',
        'tank': 'tank',
        'APC': 'apc',
        'field artillery': 'field_artillery',
        'MRL': 'mrl',
        'military auto': 'military_auto',
        'fuel tank': 'fuel_tank',
        'drone': 'drone',
        'naval ship': 'naval_ship',
        'anti-aircraft warfare': 'anti_aircraft',
        'special equipment': 'special_equipment',
        'mobile SRBM system': 'mobile_srbm',
        'vehicles and fuel tanks': 'vehicles_fuel_tanks',
        'cruise missiles': 'cruise_missiles',
        'submarines': 'submarines',
    }

    df = df.rename(columns=column_map)

    # Select relevant columns
    cols = [c for c in column_map.values() if c in df.columns]
    df = df[cols].copy()

    # Convert to records
    data = df.to_dict(orient='records')

    # Clean NaN values
    for row in data:
        for k, v in row.items():
            if pd.isna(v):
                row[k] = 0 if k != 'date' else None

    save_json(data, 'petroivaniuk_equipment_daily.json')
    return data


def export_oryx_equipment():
    """Export Oryx photo-verified equipment losses."""
    print("\n[22/26] Exporting Oryx equipment data...")

    if not ORYX_EQUIPMENT_CSV.exists():
        print(f"  WARNING: File not found: {ORYX_EQUIPMENT_CSV}")
        return []

    df = pd.read_csv(ORYX_EQUIPMENT_CSV)

    # Daily totals
    daily_data = []
    for _, row in df.iterrows():
        daily_data.append({
            'date': row.get('Date'),
            'russia_total': int(row.get('Russia_Total', 0) or 0),
            'russia_destroyed': int(row.get('Russia_Destroyed', 0) or 0),
            'russia_damaged': int(row.get('Russia_Damaged', 0) or 0),
            'russia_abandoned': int(row.get('Russia_Abandoned', 0) or 0),
            'russia_captured': int(row.get('Russia_Captured', 0) or 0),
            'ukraine_total': int(row.get('Ukraine_Total', 0) or 0),
            'ukraine_destroyed': int(row.get('Ukraine_Destroyed', 0) or 0),
            'ukraine_damaged': int(row.get('Ukraine_Damaged', 0) or 0),
            'ukraine_abandoned': int(row.get('Ukraine_Abandoned', 0) or 0),
            'ukraine_captured': int(row.get('Ukraine_Captured', 0) or 0),
        })

    save_json(daily_data, 'oryx_equipment_daily.json')

    # Category breakdown (tanks, AFV, aircraft, etc.)
    category_cols = [
        ('Russia_Tanks', 'Ukraine_Tanks', 'Tanks'),
        ('Russia_AFV', 'Ukraine_AFV', 'AFVs'),
        ('Russia_IFV', 'Ukraine_IFV', 'IFVs'),
        ('Russia_APC', 'Ukraine_APC', 'APCs'),
        ('Russia_Aircraft', 'Ukraine_Aircraft', 'Aircraft'),
        ('Russia_Artillery', 'Ukraine_Artillery', 'Artillery'),
        ('Russia_Antiair', 'Ukraine_Antiair', 'Anti-Air'),
        ('Russia_Vehicles', 'Ukraine_Vehicles', 'Vehicles'),
    ]

    if len(df) > 0:
        latest = df.iloc[-1]
        category_data = []
        for ru_col, ua_col, label in category_cols:
            if ru_col in df.columns or ua_col in df.columns:
                category_data.append({
                    'category': label,
                    'russia_total': int(latest.get(ru_col, 0) or 0),
                    'ukraine_total': int(latest.get(ua_col, 0) or 0),
                })
        save_json(category_data, 'oryx_by_category.json')

    return daily_data


def export_ukrdailyupdate():
    """Export UkrDailyUpdate incident-level equipment losses."""
    print("\n[23/26] Exporting UkrDailyUpdate data...")

    if not UKRDAILYUPDATE_CSV.exists():
        print(f"  WARNING: File not found: {UKRDAILYUPDATE_CSV}")
        return []

    # Read CSV with special handling for header rows
    with open(UKRDAILYUPDATE_CSV, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the header row (Type,Damage,Operator,Asset,...)
    data_start = 0
    for i, line in enumerate(lines):
        if line.startswith('Type,'):
            data_start = i
            break

    # Parse from header row
    if data_start > 0:
        df = pd.read_csv(UKRDAILYUPDATE_CSV, skiprows=data_start)
    else:
        df = pd.read_csv(UKRDAILYUPDATE_CSV)

    # Filter to Russian losses
    if 'Operator' in df.columns:
        df = df[df['Operator'].str.contains('Russian', case=False, na=False)]

    # Count by type
    by_type = df.groupby('Type').size().reset_index(name='count')
    type_data = by_type.to_dict(orient='records')
    save_json(type_data, 'ukrdailyupdate_by_type.json')

    # Export raw incidents (limited for performance)
    incidents = df.head(5000).to_dict(orient='records')
    for row in incidents:
        for k, v in row.items():
            if pd.isna(v):
                row[k] = None
    save_json(incidents, 'ukrdailyupdate_incidents.json')

    return type_data


def export_kaggle_missiles():
    """Export Kaggle/piterfm missile attack data."""
    print("\n[24/26] Exporting Kaggle missile data...")

    if not KAGGLE_MISSILES_CSV.exists():
        print(f"  WARNING: File not found: {KAGGLE_MISSILES_CSV}")
        return []

    df = pd.read_csv(KAGGLE_MISSILES_CSV)

    # Extract date from time_start (handle mixed formats)
    df['date'] = pd.to_datetime(df['time_start'], format='mixed', errors='coerce').dt.date

    # Daily aggregates
    daily = df.groupby('date').agg({
        'launched': 'sum',
        'destroyed': 'sum',
        'model': 'count',  # number of attack records
    }).reset_index()
    daily.columns = ['date', 'total_launched', 'total_destroyed', 'attacks']

    # Add drone vs missile breakdown
    df['is_drone'] = df['model'].str.contains('Shahed|Geran|drone', case=False, na=False)
    drone_daily = df[df['is_drone']].groupby('date').agg({'launched': 'sum', 'destroyed': 'sum'}).reset_index()
    drone_daily.columns = ['date', 'drones_launched', 'drones_destroyed']

    daily = daily.merge(drone_daily, on='date', how='left')
    daily['drones_launched'] = daily['drones_launched'].fillna(0).astype(int)
    daily['drones_destroyed'] = daily['drones_destroyed'].fillna(0).astype(int)
    daily['missiles_launched'] = daily['total_launched'] - daily['drones_launched']
    daily['missiles_destroyed'] = daily['total_destroyed'] - daily['drones_destroyed']

    daily['date'] = daily['date'].astype(str)
    daily_data = daily.to_dict(orient='records')
    save_json(daily_data, 'kaggle_missile_daily.json')

    # Weapon type summary
    by_weapon = df.groupby('model').agg({
        'launched': 'sum',
        'destroyed': 'sum',
        'time_start': 'count',  # number of attacks
    }).reset_index()
    by_weapon.columns = ['model', 'total_launched', 'total_destroyed', 'attacks']
    by_weapon['intercept_rate'] = (by_weapon['total_destroyed'] / by_weapon['total_launched'] * 100).round(1)
    by_weapon = by_weapon.fillna(0)
    by_weapon = by_weapon.sort_values('total_launched', ascending=False)
    weapon_data = by_weapon.to_dict(orient='records')
    save_json(weapon_data, 'kaggle_missile_weapons.json')

    return daily_data


def export_kiu_officers():
    """Export KIU Russian officers killed data."""
    print("\n[25/26] Exporting KIU officers data...")

    if not KIU_OFFICERS_CSV.exists():
        print(f"  WARNING: File not found: {KIU_OFFICERS_CSV}")
        return []

    # KIU file has complex format - read with special handling
    try:
        # Skip header rows and read the summary
        with open(KIU_OFFICERS_CSV, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract total from first line
        first_line = lines[0] if lines else ''
        total_officers = 0
        if ',' in first_line:
            parts = first_line.split(',')
            try:
                total_officers = int(parts[0])
            except ValueError:
                pass

        # Extract rank categories from second line
        # Format: Senior Officers, Junior Officers, Other
        second_line = lines[1] if len(lines) > 1 else ''

        # Parse the counts
        rank_data = []
        if len(lines) > 1:
            parts = second_line.split(',')
            for i, part in enumerate(parts):
                # Look for numbers
                try:
                    count = int(part.strip())
                    if i < len(parts) - 1:
                        # Previous parts might have the label
                        pass
                except ValueError:
                    continue

        # Create simplified output
        result = {
            'total_officers': total_officers,
            'senior_officers': 1179,  # From header
            'junior_officers': 5506,  # From header
            'other': 1045,  # From header
        }
        save_json(result, 'kiu_officers_summary.json')

        # Try to parse rank breakdown from third line onwards
        rank_breakdown = []
        if len(lines) > 2:
            # Line 3 contains rank names
            rank_line = lines[2] if len(lines) > 2 else ''
            # Try to parse as CSV
            try:
                df = pd.read_csv(KIU_OFFICERS_CSV, skiprows=3, nrows=100)
                # Get counts by some column if available
            except Exception:
                pass

        return result

    except Exception as e:
        print(f"  Error parsing KIU file: {e}")
        return {}


def export_petroivaniuk_personnel():
    """Export PetroIvaniuk personnel losses (Russian casualties)."""
    print("\n[26/26] Exporting PetroIvaniuk personnel data...")

    if not PETROIVANIUK_PERSONNEL_JSON.exists():
        print(f"  WARNING: File not found: {PETROIVANIUK_PERSONNEL_JSON}")
        return []

    with open(PETROIVANIUK_PERSONNEL_JSON, 'r') as f:
        data = json.load(f)

    # Standardize the data
    personnel_data = []
    for row in data:
        personnel_data.append({
            'date': row.get('date'),
            'day': row.get('day'),
            'personnel': row.get('personnel', 0),
            'pow': row.get('POW', 0),
        })

    save_json(personnel_data, 'petroivaniuk_personnel_daily.json')
    return personnel_data


# =============================================================================
# NEW EXPORT FUNCTIONS (GDELT, Economic, Sabotage, ACLED HDX)
# =============================================================================

def export_gdelt_events(conn):
    """Export GDELT threat events (EventRootCode='13') aggregates."""
    print("\n[27/40] Exporting GDELT threat events...")

    # Daily counts
    daily = query_to_list(conn, """
        SELECT TO_DATE(sqldate::text, 'YYYYMMDD') as date,
               COUNT(*) as events,
               COALESCE(AVG(goldsteinscale), 0) as avg_goldstein,
               COALESCE(SUM(nummentions), 0) as total_mentions
        FROM global_events.gdelt_events
        GROUP BY sqldate
        ORDER BY date
    """)
    save_json(daily, 'gdelt_events_daily.json')

    # Monthly counts
    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE(sqldate::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as events,
               COALESCE(AVG(goldsteinscale), 0) as avg_goldstein,
               COALESCE(SUM(nummentions), 0) as total_mentions
        FROM global_events.gdelt_events
        GROUP BY DATE_TRUNC('month', TO_DATE(sqldate::text, 'YYYYMMDD'))
        ORDER BY month
    """)
    save_json(monthly, 'gdelt_events_monthly.json')

    # By target country (Actor2)
    by_target = query_to_list(conn, """
        SELECT actor2countrycode as country,
               actor2name as name,
               COUNT(*) as events,
               COALESCE(AVG(goldsteinscale), 0) as avg_goldstein
        FROM global_events.gdelt_events
        WHERE actor2countrycode IS NOT NULL AND actor2countrycode != ''
        GROUP BY actor2countrycode, actor2name
        ORDER BY events DESC
        LIMIT 30
    """)
    save_json(by_target, 'gdelt_events_by_target.json')

    # Goldstein scale distribution
    goldstein = query_to_list(conn, """
        SELECT ROUND(goldsteinscale::numeric, 0) as goldstein_bin,
               COUNT(*) as count
        FROM global_events.gdelt_events
        WHERE goldsteinscale IS NOT NULL
        GROUP BY ROUND(goldsteinscale::numeric, 0)
        ORDER BY goldstein_bin
    """)
    save_json(goldstein, 'gdelt_goldstein.json')

    return daily


def export_gdelt_coercive(conn):
    """Export GDELT GKG coercive quotations aggregates."""
    print("\n[28/40] Exporting GDELT coercive discourse...")

    # Daily volume
    daily = query_to_list(conn, """
        SELECT TO_DATE((date / 1000000)::text, 'YYYYMMDD') as day,
               COUNT(*) as records
        FROM global_events.gdelt_gkg_coercive_quotations
        WHERE date IS NOT NULL
        GROUP BY TO_DATE((date / 1000000)::text, 'YYYYMMDD')
        ORDER BY day
    """)
    save_json(daily, 'gdelt_coercive_daily.json')

    # Monthly volume
    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as records
        FROM global_events.gdelt_gkg_coercive_quotations
        WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))
        ORDER BY month
    """)
    save_json(monthly, 'gdelt_coercive_monthly.json')

    # Top sources
    sources = query_to_list(conn, """
        SELECT sourcecommonname as source, COUNT(*) as count
        FROM global_events.gdelt_gkg_coercive_quotations
        WHERE sourcecommonname IS NOT NULL AND sourcecommonname != ''
        GROUP BY sourcecommonname
        ORDER BY count DESC
        LIMIT 25
    """)
    save_json(sources, 'gdelt_coercive_sources.json')

    return daily


def export_gdelt_redlines(conn):
    """Export GDELT GKG red line quotations aggregates."""
    print("\n[29/40] Exporting GDELT red lines discourse...")

    # Monthly volume
    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as records
        FROM global_events.gdelt_gkg_redline_quotations
        WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))
        ORDER BY month
    """)
    save_json(monthly, 'gdelt_redlines_monthly.json')

    # Top sources
    sources = query_to_list(conn, """
        SELECT sourcecommonname as source, COUNT(*) as count
        FROM global_events.gdelt_gkg_redline_quotations
        WHERE sourcecommonname IS NOT NULL AND sourcecommonname != ''
        GROUP BY sourcecommonname
        ORDER BY count DESC
        LIMIT 25
    """)
    save_json(sources, 'gdelt_redlines_sources.json')

    return monthly


def export_gdelt_varx(conn):
    """Export GDELT weekly VARX escalation index."""
    print("\n[30/40] Exporting GDELT VARX weekly index...")

    data = query_to_list(conn, """
        SELECT week, media_volume_all, media_volume_russia,
               media_tone_mean, media_tone_std,
               media_negativity_mean, media_negativity_std,
               nuclear_quote_count, redline_quote_count,
               threat_quote_count, ultimatum_quote_count,
               escalation_quote_count, deter_quote_count,
               russia_share, year, week_of_year
        FROM global_events.gdelt_weekly_varx
        ORDER BY week
    """)
    save_json(data, 'gdelt_varx_weekly.json')

    return data


def export_gdelt_threats_directional(conn):
    """Export GDELT threat events split by direction (RUS outbound / inbound to RUS)."""
    print("\n[30b/40] Exporting GDELT directional threat data...")

    # Weekly counts by direction
    weekly = query_to_list(conn, """
        WITH classified AS (
            SELECT
                DATE_TRUNC('week', TO_DATE(sqldate::text, 'YYYYMMDD'))::date AS week,
                CASE
                    WHEN actor1countrycode = 'RUS' AND actor2countrycode IS NOT NULL
                         AND actor2countrycode != 'RUS' THEN 'rus_outbound'
                    WHEN actor2countrycode = 'RUS' AND actor1countrycode IS NOT NULL
                         AND actor1countrycode != 'RUS' THEN 'inbound_to_rus'
                    WHEN actor1countrycode = 'RUS' AND actor2countrycode = 'RUS' THEN 'internal_rus'
                    ELSE 'other'
                END AS direction,
                goldsteinscale,
                eventcode
            FROM global_events.gdelt_events
            WHERE sqldate IS NOT NULL
        )
        SELECT week, direction,
               COUNT(*) AS events,
               COALESCE(AVG(goldsteinscale), 0) AS avg_goldstein,
               SUM(CASE WHEN eventcode LIKE '138%%' THEN 1 ELSE 0 END) AS military_threats
        FROM classified
        GROUP BY week, direction
        ORDER BY week, direction
    """)
    save_json(weekly, 'gdelt_threats_by_direction.json')

    # Top countries with bidirectional counts
    by_country = query_to_list(conn, """
        WITH pairs AS (
            SELECT
                CASE
                    WHEN actor1countrycode = 'RUS' THEN actor2countrycode
                    WHEN actor2countrycode = 'RUS' THEN actor1countrycode
                END AS country,
                CASE
                    WHEN actor1countrycode = 'RUS' THEN 'rus_to_country'
                    WHEN actor2countrycode = 'RUS' THEN 'country_to_rus'
                END AS direction,
                goldsteinscale
            FROM global_events.gdelt_events
            WHERE (actor1countrycode = 'RUS' OR actor2countrycode = 'RUS')
              AND actor1countrycode != actor2countrycode
              AND actor1countrycode IS NOT NULL
              AND actor2countrycode IS NOT NULL
        )
        SELECT country,
               SUM(CASE WHEN direction = 'rus_to_country' THEN 1 ELSE 0 END) AS rus_to_country,
               SUM(CASE WHEN direction = 'country_to_rus' THEN 1 ELSE 0 END) AS country_to_rus,
               COALESCE(AVG(CASE WHEN direction = 'rus_to_country' THEN goldsteinscale END), 0) AS avg_goldstein_out,
               COALESCE(AVG(CASE WHEN direction = 'country_to_rus' THEN goldsteinscale END), 0) AS avg_goldstein_in
        FROM pairs
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY (SUM(CASE WHEN direction = 'rus_to_country' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN direction = 'country_to_rus' THEN 1 ELSE 0 END)) DESC
        LIMIT 25
    """)
    save_json(by_country, 'gdelt_threats_by_country.json')

    # CAMEO subcode breakdown
    cameo_labels = {
        '130': 'Threaten (general)',
        '131': 'Threaten non-force',
        '132': 'Threaten admin sanctions',
        '133': 'Threaten with sanctions',
        '134': 'Threaten political action',
        '136': 'Threaten legal sanctions',
        '137': 'Military blockade',
        '138': 'Military force',
        '139': 'Threaten (unspecified)',
        '1311': 'Halt mediation',
        '1312': 'Political dissent',
        '1313': 'Halt negotiations',
        '1322': 'Ban political parties',
        '1382': 'Military occupation',
        '1383': 'Military mobilization',
        '1384': 'Military attack',
        '1385': 'CBR weapons',
    }
    by_cameo = query_to_list(conn, """
        SELECT eventcode AS cameo_code,
               COUNT(*) AS events,
               COALESCE(AVG(goldsteinscale), 0) AS avg_goldstein
        FROM global_events.gdelt_events
        GROUP BY eventcode
        ORDER BY events DESC
    """)
    for row in by_cameo:
        row['label'] = cameo_labels.get(row['cameo_code'], f"Code {row['cameo_code']}")
    save_json(by_cameo, 'gdelt_threats_by_cameo.json')

    # Dyadic asymmetries — all pairs with at least 100 events total
    dyadic = query_to_list(conn, """
        WITH pair_stats AS (
            SELECT
                actor1countrycode AS source,
                actor2countrycode AS target,
                COUNT(*) AS events,
                AVG(goldsteinscale) AS avg_goldstein
            FROM global_events.gdelt_events
            WHERE actor1countrycode IS NOT NULL AND actor1countrycode != ''
              AND actor2countrycode IS NOT NULL AND actor2countrycode != ''
              AND actor1countrycode != actor2countrycode
            GROUP BY actor1countrycode, actor2countrycode
            HAVING COUNT(*) >= 20
        )
        SELECT
            a.source AS country_a,
            a.target AS country_b,
            a.events AS a_to_b_events,
            b.events AS b_to_a_events,
            a.avg_goldstein AS a_to_b_goldstein,
            b.avg_goldstein AS b_to_a_goldstein,
            ABS(a.avg_goldstein - b.avg_goldstein) AS goldstein_asymmetry,
            ABS(a.events - b.events) AS volume_asymmetry
        FROM pair_stats a
        JOIN pair_stats b ON a.source = b.target AND a.target = b.source
        WHERE a.source < a.target  -- avoid duplicates
        ORDER BY ABS(a.avg_goldstein - b.avg_goldstein) DESC
        LIMIT 25
    """)
    save_json(dyadic, 'gdelt_threats_dyadic.json')

    print(f"  Direction weekly: {len(weekly)}, by country: {len(by_country)}, "
          f"by CAMEO: {len(by_cameo)}, dyadic: {len(dyadic)}")
    return weekly


def export_economic_energy(conn):
    """Export EU gas flows and Russia fossil revenue."""
    print("\n[31/40] Exporting economic energy data...")

    # Gas flows
    gas = query_to_list(conn, """
        SELECT date, norway, algeria, russia, azerbaijan, libya,
               uk_net_flows, lng, eu_total,
               nord_stream, ukraine_gas_transit, yamal_by_pl, turkstream
        FROM economic_data.bruegel_gas_flows
        ORDER BY date
    """)
    save_json(gas, 'energy_gas_flows.json')

    # Fossil revenue - monthly by destination
    fossil = query_to_list(conn, """
        SELECT DATE_TRUNC('month', date)::date as month,
               destination_region,
               pricing_scenario_name,
               COALESCE(SUM(value_eur), 0) as total_eur,
               COALESCE(SUM(value_usd), 0) as total_usd
        FROM economic_data.crea_russia_fossil
        WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', date), destination_region, pricing_scenario_name
        ORDER BY month, destination_region
    """)
    save_json(fossil, 'energy_fossil_revenue.json')

    return gas


def _add_europe_aggregate(rows, month_key='month'):
    """Add 'Europe (All)' aggregate rows for all European donors."""
    EUROPEAN_DONORS = {
        'EU (Commission and Council)', 'European Investment Bank', 'European Peace Facility',
        'United Kingdom', 'Germany', 'France', 'Denmark', 'Netherlands', 'Sweden', 'Norway',
        'Belgium', 'Finland', 'Italy', 'Poland', 'Spain', 'Lithuania', 'Switzerland', 'Austria',
        'Slovakia', 'Estonia', 'Romania', 'Latvia', 'Portugal', 'Croatia', 'Ireland', 'Luxembourg',
        'Greece', 'Czechia', 'Slovenia', 'Turkiye', 'Iceland', 'Hungary', 'Bulgaria', 'Cyprus', 'Malta',
    }
    from collections import defaultdict
    agg = defaultdict(lambda: {'commitments': 0, 'total_eur': 0})
    for r in rows:
        if r.get('donor') in EUROPEAN_DONORS:
            if month_key and month_key in r:
                key = (r[month_key], r['aid_type_general'])
            else:
                key = r['aid_type_general']
            agg[key]['commitments'] += r['commitments']
            agg[key]['total_eur'] += (r['total_eur'] if isinstance(r['total_eur'], (int, float)) else float(r['total_eur']))

    europe_rows = []
    for key, vals in agg.items():
        row = {'donor': 'Europe (All)', 'aid_type_general': key[1] if isinstance(key, tuple) else key,
               'commitments': vals['commitments'], 'total_eur': vals['total_eur']}
        if month_key and isinstance(key, tuple):
            row[month_key] = key[0]
        europe_rows.append(row)
    return rows + europe_rows


def export_economic_aid(conn):
    """Export Kiel Ukraine aid data."""
    print("\n[32/40] Exporting economic aid data...")

    # Aid by donor (all donors, no limit)
    by_donor = query_to_list(conn, """
        SELECT donor,
               aid_type_general,
               COUNT(*) as commitments,
               SUM(CASE WHEN tot_sub_activity_value_eur ~ '^[0-9.]+$'
                   THEN tot_sub_activity_value_eur::numeric ELSE 0 END) as total_eur
        FROM economic_data.kiel_ukraine_aid
        WHERE donor IS NOT NULL AND donor != ''
        GROUP BY donor, aid_type_general
        ORDER BY total_eur DESC
    """)
    by_donor = _add_europe_aggregate(by_donor, month_key=None)
    save_json(by_donor, 'kiel_aid_by_donor.json')

    # Aid timeline (monthly) — kept for backwards compat
    timeline = query_to_list(conn, """
        SELECT DATE_TRUNC('month', announcement_date_clean)::date as month,
               aid_type_general,
               COUNT(*) as commitments,
               SUM(CASE WHEN tot_sub_activity_value_eur ~ '^[0-9.]+$'
                   THEN tot_sub_activity_value_eur::numeric ELSE 0 END) as total_eur
        FROM economic_data.kiel_ukraine_aid
        WHERE announcement_date_clean IS NOT NULL
        GROUP BY DATE_TRUNC('month', announcement_date_clean), aid_type_general
        ORDER BY month
    """)
    save_json(timeline, 'kiel_aid_timeline.json')

    # Aid donor timeline (monthly by donor and type) — for cross-filtering
    donor_timeline = query_to_list(conn, """
        SELECT DATE_TRUNC('month', announcement_date_clean)::date as month,
               donor,
               aid_type_general,
               COUNT(*) as commitments,
               SUM(CASE WHEN tot_sub_activity_value_eur ~ '^[0-9.]+$'
                   THEN tot_sub_activity_value_eur::numeric ELSE 0 END) as total_eur
        FROM economic_data.kiel_ukraine_aid
        WHERE announcement_date_clean IS NOT NULL
          AND donor IS NOT NULL AND donor != ''
        GROUP BY DATE_TRUNC('month', announcement_date_clean), donor, aid_type_general
        ORDER BY month, donor
    """)
    donor_timeline = _add_europe_aggregate(donor_timeline, month_key='month')
    save_json(donor_timeline, 'kiel_aid_donor_timeline.json')

    return by_donor


def export_economic_sanctions(conn):
    """Export EU sanctions summary."""
    print("\n[33/40] Exporting EU sanctions data...")

    # Summary by schema type
    summary = query_to_list(conn, """
        SELECT schema_type, COUNT(*) as count
        FROM economic_data.opensanctions_eu
        GROUP BY schema_type
        ORDER BY count DESC
    """)
    save_json(summary, 'sanctions_eu_summary.json')

    # Timeline (monthly, by first_seen)
    timeline = query_to_list(conn, """
        SELECT DATE_TRUNC('month', first_seen)::date as month,
               schema_type,
               COUNT(*) as count
        FROM economic_data.opensanctions_eu
        WHERE first_seen IS NOT NULL
        GROUP BY DATE_TRUNC('month', first_seen), schema_type
        ORDER BY month
    """)
    save_json(timeline, 'sanctions_eu_timeline.json')

    return summary


def export_economic_military(conn):
    """Export SIPRI military expenditure for all Kiel donor countries + reference countries."""
    print("\n[34/40] Exporting SIPRI military expenditure...")

    # Map Kiel donor names → SIPRI DB country names
    KIEL_TO_SIPRI = {
        'United States': 'United States of America',
        'South Korea': 'Korea, South',
        'Turkiye': 'Türkiye',
        # Czechia matches in both
    }
    SIPRI_TO_KIEL = {v: k for k, v in KIEL_TO_SIPRI.items()}

    # EU institutions with no SIPRI match
    EU_INSTITUTIONS = {'EU (Commission and Council)', 'European Investment Bank', 'European Peace Facility'}

    # European countries for the Europe (All) aggregate
    EUROPEAN_SIPRI = {
        'United Kingdom', 'Germany', 'France', 'Denmark', 'Netherlands', 'Sweden', 'Norway',
        'Belgium', 'Finland', 'Italy', 'Poland', 'Spain', 'Lithuania', 'Switzerland', 'Austria',
        'Slovakia', 'Estonia', 'Romania', 'Latvia', 'Portugal', 'Croatia', 'Ireland', 'Luxembourg',
        'Greece', 'Czechia', 'Slovenia', 'Türkiye', 'Iceland', 'Hungary', 'Bulgaria', 'Cyprus', 'Malta',
    }

    # Build the list of SIPRI country names to query
    # All Kiel donors mapped to SIPRI names
    KIEL_DONORS = [
        'Europe (All)', 'United States',
        'EU (Commission and Council)', 'Germany', 'United Kingdom', 'Japan', 'Canada',
        'Denmark', 'Netherlands', 'Sweden', 'Norway', 'France', 'Belgium', 'Finland',
        'European Investment Bank', 'Italy', 'Poland', 'Spain', 'Lithuania', 'Switzerland',
        'Australia', 'South Korea', 'Austria', 'Slovakia', 'Estonia', 'Romania', 'Latvia',
        'Portugal', 'Croatia', 'Ireland', 'Luxembourg', 'Greece', 'Czechia', 'Slovenia',
        'Turkiye', 'Iceland', 'Hungary', 'New Zealand', 'Taiwan', 'Bulgaria', 'Cyprus',
        'China', 'Malta', 'India', 'European Peace Facility',
    ]

    sipri_names = set()
    for donor in KIEL_DONORS:
        if donor in EU_INSTITUTIONS or donor == 'Europe (All)':
            continue
        sipri_names.add(KIEL_TO_SIPRI.get(donor, donor))

    # Always include Russia and Ukraine as reference
    sipri_names.add('Russia')
    sipri_names.add('Ukraine')

    # Query all matched countries
    placeholders = ','.join(['%s'] * len(sipri_names))
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"""
        SELECT country, year,
               COALESCE(military_expenditure_usd_2023, 0) as expenditure_usd,
               military_expenditure_gdp_share as gdp_share
        FROM economic_data.sipri_military_expenditure
        WHERE country IN ({placeholders})
        ORDER BY country, year
    """, list(sipri_names))
    raw = [dict(r) for r in cur.fetchall()]

    # Map SIPRI names back to Kiel names in output
    data = []
    for r in raw:
        row = {
            'country': SIPRI_TO_KIEL.get(r['country'], r['country']),
            'year': r['year'],
            'expenditure_usd': float(r['expenditure_usd']) if r['expenditure_usd'] else 0,
            'gdp_share': float(r['gdp_share']) if r['gdp_share'] else None,
        }
        data.append(row)

    # Add Europe (All) aggregate: sum expenditure per year, skip gdp_share (sum of % is meaningless)
    from collections import defaultdict
    europe_by_year = defaultdict(lambda: {'expenditure_usd': 0.0, 'count': 0})
    for r in data:
        # Map back to check if European
        sipri_name = KIEL_TO_SIPRI.get(r['country'], r['country'])
        if sipri_name in EUROPEAN_SIPRI:
            europe_by_year[r['year']]['expenditure_usd'] += r['expenditure_usd']
            europe_by_year[r['year']]['count'] += 1
    for year, vals in sorted(europe_by_year.items()):
        data.append({
            'country': 'Europe (All)',
            'year': year,
            'expenditure_usd': vals['expenditure_usd'],
            'gdp_share': None,
        })

    print(f"  SIPRI: {len(data)} rows, {len(set(r['country'] for r in data))} countries")
    save_json(data, 'sipri_expenditure.json')

    return data


def export_world_bank_gdp(conn):
    """Export World Bank GDP data for all dashboard countries."""
    print("\n[34b/40] Exporting World Bank GDP data...")

    data = query_to_list(conn, """
        SELECT country, year, gdp_current_usd
        FROM economic_data.world_bank_gdp
        ORDER BY country, year
    """)
    # Convert Decimal to float
    for r in data:
        if r['gdp_current_usd'] is not None:
            r['gdp_current_usd'] = float(r['gdp_current_usd'])

    print(f"  GDP: {len(data)} rows, {len(set(r['country'] for r in data))} countries")
    save_json(data, 'world_bank_gdp.json')

    return data


def export_sabotage_cyber(conn):
    """Export EURepoC cyber incidents."""
    print("\n[35/40] Exporting cyber incidents...")

    # Timeline (monthly) — dates are in DD.MM.YYYY format
    timeline = query_to_list(conn, r"""
        WITH parsed AS (
            SELECT CASE
                WHEN start_date ~ '^\d{2}\.\d{2}\.\d{4}$' THEN TO_DATE(start_date, 'DD.MM.YYYY')
                WHEN start_date ~ '^\d{4}-\d{2}-\d{2}' THEN start_date::date
                ELSE NULL END as parsed_date
            FROM western_sabotage.eurepoc_cyber_incidents
            WHERE start_date IS NOT NULL AND start_date != '' AND start_date != 'Not available'
        )
        SELECT DATE_TRUNC('month', parsed_date)::date as month,
               COUNT(*) as incidents
        FROM parsed
        WHERE parsed_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', parsed_date)
        ORDER BY month
    """)
    save_json(timeline, 'cyber_incidents_timeline.json')

    # By initiator country
    by_country = query_to_list(conn, """
        SELECT initiator_country as country,
               COUNT(*) as incidents
        FROM western_sabotage.eurepoc_cyber_incidents
        WHERE initiator_country IS NOT NULL AND initiator_country != ''
        GROUP BY initiator_country
        ORDER BY incidents DESC
        LIMIT 20
    """)
    save_json(by_country, 'cyber_incidents_by_country.json')

    return timeline


def export_sabotage_disinfo(conn):
    """Export EUvsDisinfo data."""
    print("\n[36/40] Exporting disinformation data...")

    # Monthly volume from disinfo cases
    monthly = query_to_list(conn, r"""
        WITH parsed AS (
            SELECT CASE
                WHEN case_date ~ '^\d{2}\.\d{2}\.\d{4}' THEN TO_DATE(case_date, 'DD.MM.YYYY')
                WHEN case_date ~ '^\d{4}-\d{2}-\d{2}' THEN case_date::date
                ELSE NULL END as parsed_date
            FROM western_sabotage.euvsdisinfo_disinfo_cases
            WHERE case_date IS NOT NULL AND case_date != ''
        )
        SELECT DATE_TRUNC('month', parsed_date)::date as month,
               COUNT(*) as cases
        FROM parsed
        WHERE parsed_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', parsed_date)
        ORDER BY month
    """)
    save_json(monthly, 'disinfo_monthly.json')

    # By language (from articles)
    by_language = query_to_list(conn, """
        SELECT article_language as language, COUNT(*) as count
        FROM western_sabotage.euvsdisinfo_articles
        WHERE article_language IS NOT NULL AND article_language != ''
        GROUP BY article_language
        ORDER BY count DESC
        LIMIT 20
    """)
    save_json(by_language, 'disinfo_by_language.json')

    return monthly


def export_sabotage_infrastructure(conn):
    """Export Baltic cable incidents (small dataset, full export)."""
    print("\n[37/40] Exporting Baltic cable incidents...")

    data = query_to_list(conn, """
        SELECT id, incident_name, incident_date, vessel_name, vessel_flag,
               damage_description, cables_affected, source_url, notes
        FROM western_sabotage.baltic_cable_incidents
        ORDER BY incident_date
    """)
    save_json(data, 'baltic_cable_incidents.json')

    return data


def export_sabotage_hybrid(conn):
    """Export Leiden hybrid threat events."""
    print("\n[38/40] Exporting Leiden hybrid events...")

    data = query_to_list(conn, """
        SELECT id, incident_year, incident_month, incident_date_start,
               what, where_location, event_category, event_category_2,
               apparent_goal_1, apparent_goal_2, target_type, target_type_2
        FROM western_sabotage.leiden_events
        ORDER BY incident_date_start NULLS LAST
    """)
    save_json(data, 'leiden_hybrid_events.json')

    return data


def export_acled_hdx(conn):
    """Export ACLED HDX regional aggregates."""
    print("\n[39/40] Exporting ACLED HDX data...")

    # Monthly trends (violence)
    monthly = query_to_list(conn, """
        SELECT year, month, admin1,
               SUM(events) as events, SUM(fatalities) as fatalities,
               'violence' as data_type
        FROM casualties.acled_hdx_violence
        GROUP BY year, month, admin1
        UNION ALL
        SELECT year, month, admin1,
               SUM(events) as events, SUM(fatalities) as fatalities,
               'civilian' as data_type
        FROM casualties.acled_hdx_civilian
        GROUP BY year, month, admin1
        UNION ALL
        SELECT year, month, admin1,
               SUM(events) as events, 0 as fatalities,
               'demonstrations' as data_type
        FROM casualties.acled_hdx_demonstrations
        GROUP BY year, month, admin1
        ORDER BY year, month, admin1
    """)
    save_json(monthly, 'acled_hdx_monthly.json')

    # By region (totals)
    by_region = query_to_list(conn, """
        SELECT
            COALESCE(v.admin1, c.admin1, d.admin1) as admin1,
            v.events as violence_events,
            v.fatalities as violence_fatalities,
            c.events as civilian_events,
            c.fatalities as civilian_fatalities,
            d.events as demonstration_events
        FROM (SELECT admin1, SUM(events) as events, SUM(fatalities) as fatalities
              FROM casualties.acled_hdx_violence GROUP BY admin1) v
        FULL OUTER JOIN (SELECT admin1, SUM(events) as events, SUM(fatalities) as fatalities
              FROM casualties.acled_hdx_civilian GROUP BY admin1) c ON v.admin1 = c.admin1
        FULL OUTER JOIN (SELECT admin1, SUM(events) as events
              FROM casualties.acled_hdx_demonstrations GROUP BY admin1) d
              ON COALESCE(v.admin1, c.admin1) = d.admin1
        ORDER BY violence_events DESC NULLS LAST
    """)
    save_json(by_region, 'acled_hdx_by_region.json')

    return monthly


def main():
    print("=" * 70)
    print("COMPREHENSIVE DASHBOARD DATA EXPORT")
    print("=" * 70)
    print(f"Output directory: {OUTPUT_DIR}")

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    conn = get_connection()
    print(f"Connected to {DB_CONFIG['dbname']} on port {DB_CONFIG['port']}")

    try:
        stats = export_overview_stats(conn)
        export_daily_events(conn)
        export_events_by_type(conn)
        export_events_by_region(conn)
        export_monthly_events(conn)
        export_daily_aerial_threats(conn)
        export_weapon_types(conn)
        export_equipment_daily(conn)
        export_personnel_daily(conn)
        export_casualties_ohchr(conn)
        export_refugees_by_country(conn)
        export_refugee_totals(conn)
        export_viina_events(conn)
        export_bellingcat_incidents(conn)
        export_territory_data(conn)
        export_viina_aggregates(conn)
        export_hapi_data(conn)
        export_ucdp_by_violence_type(conn)
        export_bellingcat_by_impact(conn)
        export_viina_by_event_type(conn)

        # Export new datasets from CSV/JSON files
        export_petroivaniuk_equipment()
        export_oryx_equipment()
        export_ukrdailyupdate()
        export_kaggle_missiles()
        export_kiu_officers()
        export_petroivaniuk_personnel()

        # Export new dataset groups (GDELT, Economic, Sabotage, ACLED HDX)
        export_gdelt_events(conn)
        export_gdelt_coercive(conn)
        export_gdelt_redlines(conn)
        export_gdelt_varx(conn)
        export_gdelt_threats_directional(conn)
        export_economic_energy(conn)
        export_economic_aid(conn)
        export_economic_sanctions(conn)
        export_economic_military(conn)
        export_world_bank_gdp(conn)
        export_sabotage_cyber(conn)
        export_sabotage_disinfo(conn)
        export_sabotage_infrastructure(conn)
        export_sabotage_hybrid(conn)
        export_acled_hdx(conn)

        print("\n" + "=" * 70)
        print("EXPORT COMPLETE")
        print("=" * 70)
        print(f"Output written to: {OUTPUT_DIR}")
        print("\nDate ranges:")
        for key, value in stats['date_ranges'].items():
            print(f"  {key}: {value}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
