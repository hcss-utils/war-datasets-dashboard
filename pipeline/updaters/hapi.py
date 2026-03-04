"""
HAPI (Humanitarian API) updater via HDX CSV downloads.
Source: HDX dataset hdx-hapi-ukr (OCHA HAPI data for Ukraine).
Method: TRUNCATE + INSERT (full refresh from CSV downloads).
Downloads pre-built CSVs from HDX — no auth required.
"""

import csv
import io
import datetime as dt

import requests

from .base import BaseUpdater

# HDX resource URLs for each HAPI dataset (direct CSV download links)
HDX_BASE = "https://data.humdata.org/dataset/1a680b9f-5e1d-44c7-bb3f-a7661065e220/resource"

HAPI_DATASETS = {
    "idps": {
        "url": f"{HDX_BASE}/762971de-0dc9-4fb0-bca4-2302a522a67e/download/hdx_hapi_idps_ukr.csv",
        "table": "humanitarian.hapi_idps",
        "columns": [
            "location_code", "location_name", "admin1_code", "admin1_name",
            "admin2_code", "admin2_name", "provider_admin1_name", "provider_admin2_name",
            "admin_level", "resource_hdx_id", "reporting_round", "assessment_type",
            "operation", "population", "reference_period_start", "reference_period_end",
        ],
    },
    "refugees": {
        "url": f"{HDX_BASE}/11294a98-c69f-4aed-a4ff-1417b9e53eb4/download/hdx_hapi_refugees_ukr.csv",
        "table": "humanitarian.hapi_refugees",
        "columns": [
            "resource_hdx_id", "population_group", "gender", "age_range",
            "min_age", "max_age", "population", "reference_period_start",
            "reference_period_end", "origin_location_code", "origin_location_name",
            "asylum_location_code", "asylum_location_name",
        ],
    },
    "humanitarian_needs": {
        "url": f"{HDX_BASE}/e611ea8b-22b0-43c9-8b65-5254ad407b74/download/hdx_hapi_humanitarian_needs_ukr.csv",
        "table": "humanitarian.hapi_humanitarian_needs",
        "columns": [
            "location_code", "location_name", "admin1_code", "admin1_name",
            "admin2_code", "admin2_name", "provider_admin1_name", "provider_admin2_name",
            "admin_level", "resource_hdx_id", "sector_code", "category",
            "population_status", "population", "reference_period_start",
            "reference_period_end", "sector_name",
        ],
    },
    "food_prices": {
        "url": f"{HDX_BASE}/3131b1a5-d377-4d4c-973e-7cff7d4ce116/download/hdx_hapi_food_price_ukr.csv",
        "table": "humanitarian.hapi_food_prices",
        "columns": [
            "location_code", "location_name", "admin1_code", "admin1_name",
            "admin2_code", "admin2_name", "provider_admin1_name", "provider_admin2_name",
            "admin_level", "resource_hdx_id", "market_code", "market_name",
            "commodity_code", "commodity_name", "commodity_category", "currency_code",
            "unit", "price_flag", "price_type", "price", "lat", "lon",
            "reference_period_start", "reference_period_end",
        ],
    },
    "funding": {
        "url": f"{HDX_BASE}/b56dabb4-9023-4686-a470-bc4730aa5544/download/hdx_hapi_funding_ukr.csv",
        "table": "humanitarian.hapi_funding",
        "columns": [
            "resource_hdx_id", "appeal_code", "appeal_name", "appeal_type",
            "requirements_usd", "funding_usd", "funding_pct", "location_code",
            "location_name", "reference_period_start", "reference_period_end",
        ],
    },
    "conflict_events": {
        "url": f"{HDX_BASE}/6298b981-ba22-4d6f-90c7-2dfc325ca2e0/download/hdx_hapi_conflict_event_ukr.csv",
        "table": "conflict_events.hapi_conflict_events",
        "columns": [
            "location_code", "location_name", "admin1_code", "admin1_name",
            "admin2_code", "admin2_name", "provider_admin1_name", "provider_admin2_name",
            "admin_level", "resource_hdx_id", "event_type", "events",
            "fatalities", "reference_period_start", "reference_period_end",
        ],
    },
    "national_risk": {
        "url": f"{HDX_BASE}/22781cc5-2a6d-49fe-9ac4-678522f1bd23/download/hdx_hapi_national_risk_ukr.csv",
        "table": "humanitarian.hapi_national_risk",
        "columns": [
            "location_code", "location_name", "resource_hdx_id",
            "risk_class", "global_rank", "overall_risk", "hazard_exposure_risk",
            "vulnerability_risk", "coping_capacity_risk",
            "meta_missing_indicators_pct", "meta_avg_recentness_years",
            "reference_period_start", "reference_period_end",
        ],
    },
    "poverty_rate": {
        "url": f"{HDX_BASE}/f318fd9d-1440-44df-ba35-b34cd29cd2fb/download/hdx_hapi_poverty_rate_ukr.csv",
        "table": "humanitarian.hapi_poverty_rate",
        "columns": [
            "location_code", "location_name", "admin1_code", "admin1_name",
            "provider_admin1_name", "admin_level", "resource_hdx_id",
            "mpi", "headcount_ratio", "intensity_of_deprivation",
            "vulnerable_to_poverty", "in_severe_poverty",
            "reference_period_start", "reference_period_end",
        ],
    },
}

# CSV column → DB column mapping (HDX CSV headers use the same names)
# Type conversion helpers
def _safe_int(val):
    if not val or val == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

def _safe_float(val):
    if not val or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def _safe_date(val):
    if not val or val == "":
        return None
    return val[:10]  # "2024-01-01" from "2024-01-01T00:00:00"

# Columns that need int conversion
INT_COLS = {"admin_level", "min_age", "max_age", "events", "fatalities", "global_rank"}
# Columns that need float conversion
FLOAT_COLS = {
    "population", "price", "lat", "lon", "requirements_usd", "funding_usd", "funding_pct",
    "overall_risk", "hazard_exposure_risk", "vulnerability_risk", "coping_capacity_risk",
    "meta_missing_indicators_pct", "meta_avg_recentness_years",
    "mpi", "headcount_ratio", "intensity_of_deprivation", "vulnerable_to_poverty", "in_severe_poverty",
}
# Columns that need date conversion
DATE_COLS = {"reference_period_start", "reference_period_end"}


class HAPIUpdater(BaseUpdater):
    name = "hapi"
    tables = [ds["table"] for ds in HAPI_DATASETS.values()]

    def run(self):
        results = {}
        total_rows = 0

        for ds_name, ds_config in HAPI_DATASETS.items():
            try:
                n = self._update_dataset(ds_name, ds_config)
                results[ds_name] = n
                total_rows += n
            except Exception as e:
                self.log(f"  WARNING: {ds_name} failed: {e}")
                results[ds_name] = f"ERROR: {e}"

        self.log(f"Total: {total_rows} rows across {len(HAPI_DATASETS)} datasets")
        return results

    def _update_dataset(self, ds_name, ds_config):
        """Download CSV and TRUNCATE+INSERT for one HAPI dataset."""
        url = ds_config["url"]
        table = ds_config["table"]
        db_columns = ds_config["columns"]

        self.log(f"  Downloading {ds_name}...")
        resp = requests.get(url, timeout=120, allow_redirects=True)
        resp.raise_for_status()

        # Parse CSV — HDX CSVs have HXL tags on line 2, skip them
        text = resp.text
        lines = text.split("\n")
        # Check if line 2 starts with # (HXL tag row)
        if len(lines) > 1 and lines[1].startswith("#"):
            # Remove the HXL tag row
            text = lines[0] + "\n" + "\n".join(lines[2:])

        reader = csv.DictReader(io.StringIO(text))
        csv_columns = reader.fieldnames or []

        rows = []
        for rec in reader:
            row = []
            for col in db_columns:
                val = rec.get(col, "")
                if col in INT_COLS:
                    row.append(_safe_int(val))
                elif col in FLOAT_COLS:
                    row.append(_safe_float(val))
                elif col in DATE_COLS:
                    row.append(_safe_date(val))
                else:
                    row.append(val if val else None)
            rows.append(tuple(row))

        if not rows:
            self.log(f"  {ds_name}: no data in CSV")
            return 0

        n = self.truncate_and_insert(table, db_columns, rows)
        self.log(f"  {ds_name}: {n} rows loaded into {table}")
        return n
