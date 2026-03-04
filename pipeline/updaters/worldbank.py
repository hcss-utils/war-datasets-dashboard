"""
World Bank GDP updater.
Source: World Bank Open Data API (no auth required).
Method: Annual check — fetch latest year, UPSERT new rows.
"""

import datetime as dt
import requests
from .base import BaseUpdater

API_URL = "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD"

TABLE = "economic_data.world_bank_gdp"
COLUMNS = ["country", "year", "gdp_current_usd", "iso3"]

# Countries we care about (SIPRI/Kiel donors + Russia + Ukraine)
COUNTRIES_ISO3 = {
    "AUS", "AUT", "BEL", "BGR", "CAN", "HRV", "CYP", "CZE", "DNK", "EST",
    "FIN", "FRA", "DEU", "GRC", "HUN", "ISL", "IRL", "ITA", "JPN", "KOR",
    "LVA", "LTU", "LUX", "MLT", "NLD", "NZL", "NOR", "POL", "PRT", "ROU",
    "SVK", "SVN", "ESP", "SWE", "CHE", "TUR", "GBR", "USA",
    "RUS", "UKR",
}


class WorldBankGDPUpdater(BaseUpdater):
    name = "worldbank_gdp"
    tables = [TABLE]

    def run(self):
        # Check what year we have
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"SELECT MAX(year) FROM {TABLE}")
            max_year = cur.fetchone()[0] or 2000

        current_year = dt.date.today().year
        # World Bank typically publishes previous year data mid-year
        target_year = current_year - 1

        if max_year >= target_year:
            self.log(f"Already have data through {max_year} (target: {target_year})")
            # Still check if there's a newer year available
            target_year = max_year + 1

        self.log(f"Checking World Bank API for year {target_year}...")

        rows = self._fetch_year(target_year)
        if not rows:
            self.log(f"No data available yet for {target_year}")
            return {"new_rows": 0, "latest_year": max_year}

        # UPSERT — update existing or insert new
        n = self._upsert(rows)
        self.log(f"Upserted {n} rows for year {target_year}")
        return {"new_rows": n, "latest_year": target_year}

    def _fetch_year(self, year):
        """Fetch GDP data for a specific year from World Bank API."""
        params = {
            "format": "json",
            "per_page": 500,
            "date": str(year),
        }
        resp = requests.get(API_URL, params=params, timeout=60)
        resp.raise_for_status()
        result = resp.json()

        if len(result) < 2 or not result[1]:
            return []

        rows = []
        for rec in result[1]:
            iso3 = rec.get("countryiso3code", "")
            if iso3 not in COUNTRIES_ISO3:
                continue
            value = rec.get("value")
            if value is None:
                continue
            country = rec["country"]["value"]
            rows.append((country, year, value, iso3))

        return rows

    def _upsert(self, rows):
        """INSERT ON CONFLICT UPDATE for GDP data."""
        if not rows:
            return 0
        conn = self.connect()
        sql = """
            INSERT INTO economic_data.world_bank_gdp (country, year, gdp_current_usd, iso3)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (country, year)
            DO UPDATE SET gdp_current_usd = EXCLUDED.gdp_current_usd, iso3 = EXCLUDED.iso3
        """
        with conn.cursor() as cur:
            from psycopg2.extras import execute_batch
            execute_batch(cur, sql, rows, page_size=100)
        conn.commit()
        return len(rows)
