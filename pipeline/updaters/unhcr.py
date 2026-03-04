"""
UNHCR Refugee Data updater.
Source: UNHCR Population Statistics API (no auth required).
Method: Annual check — fetch all years for Ukraine origin, TRUNCATE+INSERT.
"""

import requests
from .base import BaseUpdater

API_URL = "https://api.unhcr.org/population/v1/population/"

TABLE = "humanitarian.unhcr_population"
COLUMNS = ["year", "origin_code", "asylum_code", "origin_name", "asylum_name",
           "refugees", "asylum_seekers", "oip", "idps", "stateless",
           "others_of_concern", "host_community"]


def _safe_int(val):
    if val is None or val == "-" or val == "":
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


class UNHCRUpdater(BaseUpdater):
    name = "unhcr"
    tables = [TABLE]

    def run(self):
        # Check current max year in DB
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"SELECT MAX(year) FROM {TABLE}")
            max_year = cur.fetchone()[0] or 0

        self.log(f"Current latest year in DB: {max_year}")
        self.log("Fetching all UNHCR data for Ukraine origin...")

        rows = self._fetch_all()
        if not rows:
            self.log("No data from UNHCR API")
            return {"new_rows": 0}

        # Check if we have new data
        new_max_year = max(r[0] for r in rows)
        if new_max_year <= max_year:
            self.log(f"No new year available (API max: {new_max_year}, DB max: {max_year})")
            return {"new_rows": 0, "latest_year": max_year}

        # Full refresh — TRUNCATE + INSERT
        n = self.truncate_and_insert(TABLE, COLUMNS, rows)
        self.log(f"Loaded {n} rows (years up to {new_max_year})")
        return {"new_rows": n, "latest_year": new_max_year}

    def _fetch_all(self):
        """Fetch all UNHCR population data for Ukraine as country of origin."""
        rows = []
        page = 1
        while True:
            params = {
                "coo": "UKR",
                "year_from": 1990,
                "year_to": 2030,
                "limit": 1000,
                "page": page,
            }
            resp = requests.get(API_URL, params=params, timeout=60)
            resp.raise_for_status()
            data = resp.json()

            items = data.get("items", [])
            if not items:
                break

            for rec in items:
                rows.append((
                    int(rec.get("year", 0)),
                    rec.get("coo", "UKR"),
                    rec.get("coa", ""),
                    rec.get("coo_name", "Ukraine"),
                    rec.get("coa_name", ""),
                    _safe_int(rec.get("refugees")),
                    _safe_int(rec.get("asylum_seekers")),
                    _safe_int(rec.get("oip")),
                    _safe_int(rec.get("idps")),
                    _safe_int(rec.get("stateless")),
                    _safe_int(rec.get("ooc")),
                    _safe_int(rec.get("hst")),
                ))

            # Check if there are more pages
            max_pages = data.get("maxPages", 1)
            if page >= max_pages:
                break
            page += 1

        self.log(f"  Fetched {len(rows)} records across {page} pages")
        return rows
