"""
CREA Russia Fossil Tracker updater.
Source: https://api.russiafossiltracker.com/v0/counter
Method: Incremental — fetch new dates after MAX(date) in DB.
DB stores region-level aggregates (8 regions × N dates).
"""

import datetime as dt
import requests
from .base import BaseUpdater

API_URL = "https://api.russiafossiltracker.com/v0/counter"

# All regions we track
REGIONS = ["China", "EU", "India", "Others", "South Korea", "Türkiye", "United Kingdom", "United States"]

TABLE = "economic_data.crea_russia_fossil"
COLUMNS = ["destination_region", "pricing_scenario", "version", "pricing_scenario_name", "date",
           "value_tonne", "value_eur", "value_usd"]


class CREAUpdater(BaseUpdater):
    name = "crea"
    tables = [TABLE]

    def run(self):
        last_date = self.get_last_date(TABLE)
        if last_date is None:
            last_date = dt.date(2022, 2, 24)

        start = last_date + dt.timedelta(days=1)
        end = dt.date.today()

        if start > end:
            self.log(f"Already up to date (last: {last_date})")
            return {"new_rows": 0}

        self.log(f"Fetching CREA data from {start} to {end}...")

        # Fetch in 90-day chunks to avoid API limits
        all_rows = []
        chunk_start = start
        while chunk_start <= end:
            chunk_end = min(chunk_start + dt.timedelta(days=89), end)
            rows = self._fetch_chunk(chunk_start, chunk_end)
            all_rows.extend(rows)
            chunk_start = chunk_end + dt.timedelta(days=1)

        if not all_rows:
            self.log("No new data from CREA API")
            return {"new_rows": 0}

        n = self.insert_batch(TABLE, COLUMNS, all_rows)
        self.log(f"Inserted {n} rows ({n // 8} days × 8 regions)")
        return {"new_rows": n}

    def _fetch_chunk(self, start, end):
        """Fetch and aggregate CREA data for a date range."""
        params = {
            "date_from": start.isoformat(),
            "date_to": end.isoformat(),
        }
        resp = requests.get(API_URL, params=params, timeout=120)
        resp.raise_for_status()
        try:
            data = resp.json().get("data", [])
        except Exception:
            # API returns empty body when no data available for the range
            return []

        if not data:
            return []

        # Aggregate per (region, date) — API returns per-country per-commodity
        agg = {}
        for rec in data:
            key = (rec["destination_region"], rec["date"][:10])  # "2026-02-01T00:00:00" → "2026-02-01"
            if key not in agg:
                agg[key] = {
                    "pricing_scenario": rec.get("pricing_scenario", "default"),
                    "version": rec.get("version", "v2"),
                    "pricing_scenario_name": rec.get("pricing_scenario_name", "USD60/bbl (actual)"),
                    "value_tonne": 0.0,
                    "value_eur": 0.0,
                    "value_usd": 0.0,
                }
            agg[key]["value_tonne"] += rec.get("value_tonne", 0) or 0
            agg[key]["value_eur"] += rec.get("value_eur", 0) or 0
            agg[key]["value_usd"] += rec.get("value_usd", 0) or 0

        rows = []
        for (region, date_str), vals in sorted(agg.items()):
            rows.append((
                region,
                vals["pricing_scenario"],
                vals["version"],
                vals["pricing_scenario_name"],
                date_str,
                vals["value_tonne"],
                vals["value_eur"],
                vals["value_usd"],
            ))

        self.log(f"  Chunk {start} to {end}: {len(rows)} region-date rows from {len(data)} API records")
        return rows
