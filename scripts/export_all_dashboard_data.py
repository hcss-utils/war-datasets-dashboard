#!/usr/bin/env python3
"""
Comprehensive Dashboard Data Export

Exports ALL datasets from the war_datasets database to static JSON files
for the React dashboard. Run this script whenever data is updated.

DB connection is configured via environment variables (with local defaults).
"""

import json
import os
from datetime import datetime, date
from pathlib import Path
from decimal import Decimal

import psycopg2
import psycopg2.extras

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

OUTPUT_DIR = Path(os.environ.get('OUTPUT_DIR', str(Path(__file__).parent.parent / 'public' / 'data')))


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
    print("\n[1] Exporting overview stats...")

    stats = {'totals': {}, 'date_ranges': {}}

    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(event_date) as min_date, MAX(event_date) as max_date
        FROM conflict_events.acled_events
    """)
    stats['totals']['acled_events'] = row['count']
    stats['date_ranges']['acled_start'] = row['min_date']
    stats['date_ranges']['acled_end'] = row['max_date']

    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date_start::date) as min_date, MAX(date_start::date) as max_date
        FROM conflict_events.ucdp_events
    """)
    stats['totals']['ucdp_events'] = row['count']
    stats['date_ranges']['ucdp_start'] = row['min_date']
    stats['date_ranges']['ucdp_end'] = row['max_date']

    row = query_one(conn, """
        SELECT COUNT(*) as count,
               TO_DATE(MIN(date)::text, 'YYYYMMDD') as min_date,
               TO_DATE(MAX(date)::text, 'YYYYMMDD') as max_date
        FROM conflict_events.viina_events
    """)
    stats['totals']['viina_events'] = row['count']
    stats['date_ranges']['viina_start'] = row['min_date']
    stats['date_ranges']['viina_end'] = row['max_date']

    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
        FROM conflict_events.bellingcat_harm
    """)
    stats['totals']['bellingcat_incidents'] = row['count']
    stats['date_ranges']['bellingcat_start'] = row['min_date']
    stats['date_ranges']['bellingcat_end'] = row['max_date']

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

    row = query_one(conn, """
        SELECT MAX(personnel) as personnel
        FROM equipment_losses.personnel_daily
    """)
    stats['totals']['total_personnel'] = row['personnel'] or 0

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

    row = query_one(conn, """
        SELECT COUNT(*) as count,
               MIN(TO_DATE(sqldate::text, 'YYYYMMDD')) as min_date,
               MAX(TO_DATE(sqldate::text, 'YYYYMMDD')) as max_date
        FROM global_events.gdelt_events
    """)
    stats['totals']['gdelt_threat_events'] = row['count']
    stats['date_ranges']['gdelt_start'] = row['min_date']
    stats['date_ranges']['gdelt_end'] = row['max_date']

    row = query_one(conn, "SELECT COUNT(*) as count FROM global_events.gdelt_gkg_coercive_quotations")
    stats['totals']['gdelt_coercive_records'] = row['count']

    row = query_one(conn, "SELECT COUNT(*) as count FROM global_events.gdelt_gkg_redline_quotations")
    stats['totals']['gdelt_redline_records'] = row['count']

    row = query_one(conn, """
        SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
        FROM economic_data.bruegel_gas_flows
    """)
    stats['totals']['gas_flow_records'] = row['count']
    stats['date_ranges']['gas_start'] = row['min_date']
    stats['date_ranges']['gas_end'] = row['max_date']

    row = query_one(conn, "SELECT COUNT(*) as count FROM economic_data.crea_russia_fossil")
    stats['totals']['fossil_revenue_records'] = row['count']

    row = query_one(conn, "SELECT COUNT(*) as count FROM economic_data.opensanctions_eu")
    stats['totals']['eu_sanctions_entities'] = row['count']

    row = query_one(conn, "SELECT COUNT(*) as count FROM western_sabotage.eurepoc_cyber_incidents")
    stats['totals']['cyber_incidents'] = row['count']

    row = query_one(conn, "SELECT COUNT(*) as count FROM western_sabotage.euvsdisinfo_disinfo_cases")
    stats['totals']['disinfo_cases'] = row['count']

    row = query_one(conn, "SELECT COUNT(*) as count FROM western_sabotage.baltic_cable_incidents")
    stats['totals']['baltic_cable_incidents'] = row['count']

    stats['export_timestamp'] = datetime.now().isoformat()

    save_json(stats, 'overview_stats.json')
    return stats


def export_daily_events(conn):
    """Export daily event counts from ACLED and UCDP."""
    print("\n[2] Exporting daily events...")

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
    print("\n[3] Exporting events by type...")

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
    print("\n[4] Exporting events by region...")

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
    print("\n[5] Exporting monthly events...")

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
    print("\n[6] Exporting daily aerial threats...")

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
    print("\n[7] Exporting weapon types summary...")

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
    print("\n[8] Exporting equipment daily...")

    data = query_to_list(conn, """
        SELECT
            date, day, tank, apc, field_artillery, mrl,
            anti_aircraft, aircraft, helicopter, drone,
            cruise_missiles, naval_ship, vehicles_fuel_tanks, special_equipment
        FROM equipment_losses.equipment_daily
        ORDER BY date
    """)

    save_json(data, 'equipment_daily.json')
    return data


def export_personnel_daily(conn):
    """Export daily personnel loss data."""
    print("\n[9] Exporting personnel daily...")

    data = query_to_list(conn, """
        SELECT date, day, personnel
        FROM equipment_losses.personnel_daily
        ORDER BY date
    """)

    save_json(data, 'personnel_daily.json')
    return data


def export_casualties_ohchr(conn):
    """Export OHCHR casualty data."""
    print("\n[10] Exporting OHCHR casualties...")

    data = query_to_list(conn, """
        SELECT
            year, month,
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
    print("\n[11] Exporting refugees by country...")

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
    print("\n[12] Exporting refugee totals...")

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
    """Export VIINA event data split by quarter/period."""
    print("\n[13] Exporting VIINA events (split by period)...")

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
    print("\n[14] Exporting Bellingcat incidents...")

    data = query_to_list(conn, """
        SELECT date, location, description, sources, latitude, longitude
        FROM conflict_events.bellingcat_harm
        ORDER BY date
    """)
    save_json(data, 'bellingcat_incidents.json')

    daily = query_to_list(conn, """
        SELECT date, COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        GROUP BY date ORDER BY date
    """)
    save_json(daily, 'bellingcat_daily.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', date)::date as month, COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm
        GROUP BY DATE_TRUNC('month', date) ORDER BY month
    """)
    save_json(monthly, 'bellingcat_monthly.json')

    return data


def export_viina_aggregates(conn):
    """Export VIINA aggregated data for charts."""
    print("\n[15] Exporting VIINA aggregates...")

    daily = query_to_list(conn, """
        SELECT TO_DATE(date::text, 'YYYYMMDD') as date, COUNT(*) as events
        FROM conflict_events.viina_events WHERE date IS NOT NULL
        GROUP BY date ORDER BY date
    """)
    save_json(daily, 'viina_daily.json')

    weekly = query_to_list(conn, """
        SELECT DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD'))::date as week, COUNT(*) as events
        FROM conflict_events.viina_events WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD')) ORDER BY week
    """)
    save_json(weekly, 'viina_weekly.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month, COUNT(*) as events
        FROM conflict_events.viina_events WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD')) ORDER BY month
    """)
    save_json(monthly, 'viina_monthly.json')

    by_source = query_to_list(conn, """
        SELECT source, COUNT(*) as events
        FROM conflict_events.viina_events WHERE source IS NOT NULL
        GROUP BY source ORDER BY events DESC
    """)
    save_json(by_source, 'viina_by_source.json')

    by_oblast = query_to_list(conn, """
        SELECT adm1_name as oblast, COUNT(*) as events
        FROM conflict_events.viina_events WHERE adm1_name IS NOT NULL
        GROUP BY adm1_name ORDER BY events DESC
    """)
    save_json(by_oblast, 'viina_by_oblast.json')

    daily_by_source = query_to_list(conn, """
        SELECT TO_DATE(date::text, 'YYYYMMDD') as date, source, COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY TO_DATE(date::text, 'YYYYMMDD'), source ORDER BY date, source
    """)
    save_json(daily_by_source, 'viina_daily_by_source.json')

    weekly_by_source = query_to_list(conn, """
        SELECT DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD'))::date as week, source, COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY DATE_TRUNC('week', TO_DATE(date::text, 'YYYYMMDD')), source ORDER BY week, source
    """)
    save_json(weekly_by_source, 'viina_weekly_by_source.json')

    monthly_by_source = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month, source, COUNT(*) as events
        FROM conflict_events.viina_events
        WHERE date IS NOT NULL AND source IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD')), source ORDER BY month, source
    """)
    save_json(monthly_by_source, 'viina_monthly_by_source.json')

    return daily


def export_territory_data(conn):
    """Export territory control time series."""
    print("\n[16] Exporting territory data...")

    data = query_to_list(conn, """
        SELECT layer_date as date, layer_type, area_km2
        FROM isw.clean_daily_areas
        WHERE conflict = 'ukraine'
        ORDER BY layer_date, layer_type
    """)

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
    print("\n[17] Exporting HAPI data...")

    food_prices = query_to_list(conn, """
        SELECT DATE_TRUNC('month', reference_period_start)::date as month,
               commodity_name, commodity_category,
               AVG(price) as avg_price, COUNT(*) as records
        FROM humanitarian.hapi_food_prices WHERE price IS NOT NULL
        GROUP BY DATE_TRUNC('month', reference_period_start), commodity_name, commodity_category
        ORDER BY month, commodity_name
    """)
    save_json(food_prices, 'hapi_food_prices.json')

    idps = query_to_list(conn, """
        SELECT reference_period_start as date, admin1_name as oblast, SUM(population) as idps
        FROM humanitarian.hapi_idps WHERE admin1_name IS NOT NULL
        GROUP BY reference_period_start, admin1_name
        ORDER BY reference_period_start, admin1_name
    """)
    save_json(idps, 'hapi_idps.json')

    idps_total = query_to_list(conn, """
        SELECT reference_period_start as date, SUM(population) as total_idps
        FROM humanitarian.hapi_idps
        GROUP BY reference_period_start ORDER BY reference_period_start
    """)
    save_json(idps_total, 'hapi_idps_total.json')

    humanitarian_needs = query_to_list(conn, """
        SELECT reference_period_start as date, admin1_name as oblast, population_status, population
        FROM humanitarian.hapi_humanitarian_needs WHERE admin1_name IS NOT NULL
        ORDER BY reference_period_start, admin1_name
    """)
    save_json(humanitarian_needs, 'hapi_humanitarian_needs.json')

    funding = query_to_list(conn, """
        SELECT reference_period_start as date, requirements_usd, funding_usd, funding_pct
        FROM humanitarian.hapi_funding ORDER BY reference_period_start
    """)
    save_json(funding, 'hapi_funding.json')

    return food_prices


def export_ucdp_by_violence_type(conn):
    """Export UCDP events by violence type."""
    print("\n[18] Exporting UCDP by violence type...")

    by_type = query_to_list(conn, """
        SELECT type_of_violence,
               CASE type_of_violence
                   WHEN 1 THEN 'State-based' WHEN 2 THEN 'Non-state'
                   WHEN 3 THEN 'One-sided' ELSE 'Unknown'
               END as violence_type_label,
               COUNT(*) as events, COALESCE(SUM(best), 0) as fatalities
        FROM conflict_events.ucdp_events WHERE country = 'Ukraine'
        GROUP BY type_of_violence ORDER BY events DESC
    """)
    save_json(by_type, 'ucdp_by_violence_type.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', date_start::date)::date as month,
               type_of_violence,
               CASE type_of_violence
                   WHEN 1 THEN 'State-based' WHEN 2 THEN 'Non-state'
                   WHEN 3 THEN 'One-sided' ELSE 'Unknown'
               END as violence_type_label,
               COUNT(*) as events, COALESCE(SUM(best), 0) as fatalities
        FROM conflict_events.ucdp_events WHERE country = 'Ukraine'
        GROUP BY DATE_TRUNC('month', date_start::date), type_of_violence
        ORDER BY month, type_of_violence
    """)
    save_json(monthly, 'ucdp_monthly_by_type.json')

    return by_type


def export_bellingcat_by_impact(conn):
    """Export Bellingcat incidents by impact category."""
    print("\n[19] Exporting Bellingcat by impact category...")

    by_impact = query_to_list(conn, """
        SELECT unnest(impact) as impact_type, COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm WHERE impact IS NOT NULL
        GROUP BY unnest(impact) ORDER BY incidents DESC
    """)
    save_json(by_impact, 'bellingcat_by_impact.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', date)::date as month,
               unnest(impact) as impact_type, COUNT(*) as incidents
        FROM conflict_events.bellingcat_harm WHERE impact IS NOT NULL
        GROUP BY DATE_TRUNC('month', date), unnest(impact) ORDER BY month, impact_type
    """)
    save_json(monthly, 'bellingcat_monthly_by_impact.json')

    return by_impact


def export_viina_by_event_type(conn):
    """Export VIINA events by ML-classified event type."""
    print("\n[20] Exporting VIINA by event type...")

    event_types = [
        ('t_airstrike_b', 'Airstrike'), ('t_artillery_b', 'Artillery'),
        ('t_uav_b', 'UAV/Drone'), ('t_armor_b', 'Armor'),
        ('t_firefight_b', 'Firefight'), ('t_control_b', 'Territorial Control'),
        ('t_raid_b', 'Raid'), ('t_ied_b', 'IED/Mine'),
        ('t_property_b', 'Property Destruction'), ('t_hospital_b', 'Hospital/Humanitarian'),
        ('t_milcas_b', 'Military Casualties'), ('t_civcas_b', 'Civilian Casualties'),
        ('t_cyber_b', 'Cyber'), ('t_arrest_b', 'Arrest'),
        ('t_occupy_b', 'Occupation'), ('t_retreat_b', 'Retreat'),
        ('t_airalert_b', 'Air Alert'), ('t_aad_b', 'Anti-Air Defense'),
    ]

    totals = []
    for col, label in event_types:
        result = query_to_list(conn, f"""
            SELECT '{label}' as event_type, COUNT(*) as events
            FROM conflict_events.viina_labels WHERE {col} = 1
        """)
        if result:
            totals.append(result[0])
    save_json(totals, 'viina_by_event_type.json')

    monthly_data = []
    for col, label in event_types:
        monthly = query_to_list(conn, f"""
            SELECT DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD'))::date as month,
                   '{label}' as event_type, COUNT(*) as events
            FROM conflict_events.viina_labels
            WHERE {col} = 1 AND date IS NOT NULL
            GROUP BY DATE_TRUNC('month', TO_DATE(date::text, 'YYYYMMDD')) ORDER BY month
        """)
        monthly_data.extend(monthly)
    save_json(monthly_data, 'viina_monthly_by_event_type.json')

    return totals


# =============================================================================
# GDELT, ECONOMIC, SABOTAGE, ACLED HDX EXPORTS
# =============================================================================

def export_gdelt_events(conn):
    """Export GDELT threat events aggregates."""
    print("\n[21] Exporting GDELT threat events...")

    daily = query_to_list(conn, """
        SELECT TO_DATE(sqldate::text, 'YYYYMMDD') as date,
               COUNT(*) as events,
               COALESCE(AVG(goldsteinscale), 0) as avg_goldstein,
               COALESCE(SUM(nummentions), 0) as total_mentions
        FROM global_events.gdelt_events GROUP BY sqldate ORDER BY date
    """)
    save_json(daily, 'gdelt_events_daily.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE(sqldate::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as events,
               COALESCE(AVG(goldsteinscale), 0) as avg_goldstein,
               COALESCE(SUM(nummentions), 0) as total_mentions
        FROM global_events.gdelt_events
        GROUP BY DATE_TRUNC('month', TO_DATE(sqldate::text, 'YYYYMMDD')) ORDER BY month
    """)
    save_json(monthly, 'gdelt_events_monthly.json')

    by_target = query_to_list(conn, """
        SELECT actor2countrycode as country, actor2name as name,
               COUNT(*) as events, COALESCE(AVG(goldsteinscale), 0) as avg_goldstein
        FROM global_events.gdelt_events
        WHERE actor2countrycode IS NOT NULL AND actor2countrycode != ''
        GROUP BY actor2countrycode, actor2name ORDER BY events DESC LIMIT 30
    """)
    save_json(by_target, 'gdelt_events_by_target.json')

    goldstein = query_to_list(conn, """
        SELECT ROUND(goldsteinscale::numeric, 0) as goldstein_bin, COUNT(*) as count
        FROM global_events.gdelt_events WHERE goldsteinscale IS NOT NULL
        GROUP BY ROUND(goldsteinscale::numeric, 0) ORDER BY goldstein_bin
    """)
    save_json(goldstein, 'gdelt_goldstein.json')

    return daily


def export_gdelt_coercive(conn):
    """Export GDELT GKG coercive quotations aggregates."""
    print("\n[22] Exporting GDELT coercive discourse...")

    daily = query_to_list(conn, """
        SELECT TO_DATE((date / 1000000)::text, 'YYYYMMDD') as day, COUNT(*) as records
        FROM global_events.gdelt_gkg_coercive_quotations WHERE date IS NOT NULL
        GROUP BY TO_DATE((date / 1000000)::text, 'YYYYMMDD') ORDER BY day
    """)
    save_json(daily, 'gdelt_coercive_daily.json')

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as records
        FROM global_events.gdelt_gkg_coercive_quotations WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD')) ORDER BY month
    """)
    save_json(monthly, 'gdelt_coercive_monthly.json')

    sources = query_to_list(conn, """
        SELECT sourcecommonname as source, COUNT(*) as count
        FROM global_events.gdelt_gkg_coercive_quotations
        WHERE sourcecommonname IS NOT NULL AND sourcecommonname != ''
        GROUP BY sourcecommonname ORDER BY count DESC LIMIT 25
    """)
    save_json(sources, 'gdelt_coercive_sources.json')

    return daily


def export_gdelt_redlines(conn):
    """Export GDELT GKG red line quotations aggregates."""
    print("\n[23] Exporting GDELT red lines discourse...")

    monthly = query_to_list(conn, """
        SELECT DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD'))::date as month,
               COUNT(*) as records
        FROM global_events.gdelt_gkg_redline_quotations WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', TO_DATE((date / 1000000)::text, 'YYYYMMDD')) ORDER BY month
    """)
    save_json(monthly, 'gdelt_redlines_monthly.json')

    sources = query_to_list(conn, """
        SELECT sourcecommonname as source, COUNT(*) as count
        FROM global_events.gdelt_gkg_redline_quotations
        WHERE sourcecommonname IS NOT NULL AND sourcecommonname != ''
        GROUP BY sourcecommonname ORDER BY count DESC LIMIT 25
    """)
    save_json(sources, 'gdelt_redlines_sources.json')

    return monthly


def export_gdelt_varx(conn):
    """Export GDELT weekly VARX escalation index."""
    print("\n[24] Exporting GDELT VARX weekly index...")

    data = query_to_list(conn, """
        SELECT week, media_volume_all, media_volume_russia,
               media_tone_mean, media_tone_std,
               media_negativity_mean, media_negativity_std,
               nuclear_quote_count, redline_quote_count,
               threat_quote_count, ultimatum_quote_count,
               escalation_quote_count, deter_quote_count,
               russia_share, year, week_of_year
        FROM global_events.gdelt_weekly_varx ORDER BY week
    """)
    save_json(data, 'gdelt_varx_weekly.json')

    return data


def export_economic_energy(conn):
    """Export EU gas flows and Russia fossil revenue."""
    print("\n[25] Exporting economic energy data...")

    gas = query_to_list(conn, """
        SELECT date, norway, algeria, russia, azerbaijan, libya,
               uk_net_flows, lng, eu_total,
               nord_stream, ukraine_gas_transit, yamal_by_pl, turkstream
        FROM economic_data.bruegel_gas_flows ORDER BY date
    """)
    save_json(gas, 'energy_gas_flows.json')

    fossil = query_to_list(conn, """
        SELECT DATE_TRUNC('month', date)::date as month,
               destination_region, pricing_scenario_name,
               COALESCE(SUM(value_eur), 0) as total_eur,
               COALESCE(SUM(value_usd), 0) as total_usd
        FROM economic_data.crea_russia_fossil WHERE date IS NOT NULL
        GROUP BY DATE_TRUNC('month', date), destination_region, pricing_scenario_name
        ORDER BY month, destination_region
    """)
    save_json(fossil, 'energy_fossil_revenue.json')

    return gas


def export_economic_aid(conn):
    """Export Kiel Ukraine aid data."""
    print("\n[26] Exporting economic aid data...")

    by_donor = query_to_list(conn, """
        SELECT donor, aid_type_general, COUNT(*) as commitments,
               SUM(CASE WHEN tot_sub_activity_value_eur ~ '^[0-9.]+$'
                   THEN tot_sub_activity_value_eur::numeric ELSE 0 END) as total_eur
        FROM economic_data.kiel_ukraine_aid
        WHERE donor IS NOT NULL AND donor != ''
        GROUP BY donor, aid_type_general ORDER BY total_eur DESC LIMIT 50
    """)
    save_json(by_donor, 'kiel_aid_by_donor.json')

    timeline = query_to_list(conn, """
        SELECT DATE_TRUNC('month', announcement_date_clean)::date as month,
               aid_type_general, COUNT(*) as commitments,
               SUM(CASE WHEN tot_sub_activity_value_eur ~ '^[0-9.]+$'
                   THEN tot_sub_activity_value_eur::numeric ELSE 0 END) as total_eur
        FROM economic_data.kiel_ukraine_aid WHERE announcement_date_clean IS NOT NULL
        GROUP BY DATE_TRUNC('month', announcement_date_clean), aid_type_general ORDER BY month
    """)
    save_json(timeline, 'kiel_aid_timeline.json')

    return by_donor


def export_economic_sanctions(conn):
    """Export EU sanctions summary."""
    print("\n[27] Exporting EU sanctions data...")

    summary = query_to_list(conn, """
        SELECT schema_type, COUNT(*) as count
        FROM economic_data.opensanctions_eu GROUP BY schema_type ORDER BY count DESC
    """)
    save_json(summary, 'sanctions_eu_summary.json')

    timeline = query_to_list(conn, """
        SELECT DATE_TRUNC('month', first_seen)::date as month, schema_type, COUNT(*) as count
        FROM economic_data.opensanctions_eu WHERE first_seen IS NOT NULL
        GROUP BY DATE_TRUNC('month', first_seen), schema_type ORDER BY month
    """)
    save_json(timeline, 'sanctions_eu_timeline.json')

    return summary


def export_economic_military(conn):
    """Export SIPRI military expenditure."""
    print("\n[28] Exporting SIPRI military expenditure...")

    data = query_to_list(conn, """
        SELECT country, year,
               COALESCE(military_expenditure_usd_2023, 0) as expenditure_usd
        FROM economic_data.sipri_military_expenditure
        WHERE country IN (
            'Russia', 'Ukraine', 'United States of America',
            'United Kingdom', 'Germany', 'France', 'Poland',
            'China', 'Turkey', 'India'
        )
        ORDER BY country, year
    """)
    save_json(data, 'sipri_expenditure.json')

    return data


def export_sabotage_cyber(conn):
    """Export EURepoC cyber incidents."""
    print("\n[29] Exporting cyber incidents...")

    timeline = query_to_list(conn, r"""
        WITH parsed AS (
            SELECT CASE
                WHEN start_date ~ '^\d{2}\.\d{2}\.\d{4}$' THEN TO_DATE(start_date, 'DD.MM.YYYY')
                WHEN start_date ~ '^\d{4}-\d{2}-\d{2}' THEN start_date::date
                ELSE NULL END as parsed_date
            FROM western_sabotage.eurepoc_cyber_incidents
            WHERE start_date IS NOT NULL AND start_date != '' AND start_date != 'Not available'
        )
        SELECT DATE_TRUNC('month', parsed_date)::date as month, COUNT(*) as incidents
        FROM parsed WHERE parsed_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', parsed_date) ORDER BY month
    """)
    save_json(timeline, 'cyber_incidents_timeline.json')

    by_country = query_to_list(conn, """
        SELECT initiator_country as country, COUNT(*) as incidents
        FROM western_sabotage.eurepoc_cyber_incidents
        WHERE initiator_country IS NOT NULL AND initiator_country != ''
        GROUP BY initiator_country ORDER BY incidents DESC LIMIT 20
    """)
    save_json(by_country, 'cyber_incidents_by_country.json')

    return timeline


def export_sabotage_disinfo(conn):
    """Export EUvsDisinfo data."""
    print("\n[30] Exporting disinformation data...")

    monthly = query_to_list(conn, r"""
        WITH parsed AS (
            SELECT CASE
                WHEN case_date ~ '^\d{2}\.\d{2}\.\d{4}' THEN TO_DATE(case_date, 'DD.MM.YYYY')
                WHEN case_date ~ '^\d{4}-\d{2}-\d{2}' THEN case_date::date
                ELSE NULL END as parsed_date
            FROM western_sabotage.euvsdisinfo_disinfo_cases
            WHERE case_date IS NOT NULL AND case_date != ''
        )
        SELECT DATE_TRUNC('month', parsed_date)::date as month, COUNT(*) as cases
        FROM parsed WHERE parsed_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', parsed_date) ORDER BY month
    """)
    save_json(monthly, 'disinfo_monthly.json')

    by_language = query_to_list(conn, """
        SELECT article_language as language, COUNT(*) as count
        FROM western_sabotage.euvsdisinfo_articles
        WHERE article_language IS NOT NULL AND article_language != ''
        GROUP BY article_language ORDER BY count DESC LIMIT 20
    """)
    save_json(by_language, 'disinfo_by_language.json')

    return monthly


def export_sabotage_infrastructure(conn):
    """Export Baltic cable incidents."""
    print("\n[31] Exporting Baltic cable incidents...")

    data = query_to_list(conn, """
        SELECT id, incident_name, incident_date, vessel_name, vessel_flag,
               damage_description, cables_affected, source_url, notes
        FROM western_sabotage.baltic_cable_incidents ORDER BY incident_date
    """)
    save_json(data, 'baltic_cable_incidents.json')

    return data


def export_sabotage_hybrid(conn):
    """Export Leiden hybrid threat events."""
    print("\n[32] Exporting Leiden hybrid events...")

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
    print("\n[33] Exporting ACLED HDX data...")

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

    by_region = query_to_list(conn, """
        SELECT
            COALESCE(v.admin1, c.admin1, d.admin1) as admin1,
            v.events as violence_events, v.fatalities as violence_fatalities,
            c.events as civilian_events, c.fatalities as civilian_fatalities,
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

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    conn = get_connection()
    print(f"Connected to {DB_CONFIG['dbname']} on {DB_CONFIG['host']}:{DB_CONFIG['port']}")

    try:
        export_overview_stats(conn)
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
        export_gdelt_events(conn)
        export_gdelt_coercive(conn)
        export_gdelt_redlines(conn)
        export_gdelt_varx(conn)
        export_economic_energy(conn)
        export_economic_aid(conn)
        export_economic_sanctions(conn)
        export_economic_military(conn)
        export_sabotage_cyber(conn)
        export_sabotage_disinfo(conn)
        export_sabotage_infrastructure(conn)
        export_sabotage_hybrid(conn)
        export_acled_hdx(conn)

        print("\n" + "=" * 70)
        print("EXPORT COMPLETE")
        print("=" * 70)
        print(f"Output written to: {OUTPUT_DIR}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
