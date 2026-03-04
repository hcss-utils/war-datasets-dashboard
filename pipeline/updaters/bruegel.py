"""
Bruegel European Gas Tracker updater.
Source: https://www.bruegel.org/dataset/european-natural-gas-imports
Method: Incremental — download latest ZIP, extract daily_data CSV,
        append rows with dates > MAX(date) in DB.
The download URL changes weekly: /sites/default/files/YYYY-MM/Gas Tracker update week N YYYY.zip
We scrape the page to find the current URL.
"""

import csv
import io
import re
import zipfile
import datetime as dt

import requests

from .base import BaseUpdater

BRUEGEL_PAGE = "https://www.bruegel.org/dataset/european-natural-gas-imports"

TABLE = "economic_data.bruegel_gas_flows"
# DB columns (excluding 'id' serial)
COLUMNS = [
    "date", "norway", "algeria", "russia", "azerbaijan", "libya",
    "uk_net_flows", "lng", "eu_total", "nord_stream",
    "ukraine_gas_transit", "yamal_by_pl", "turkstream",
]

# CSV header → DB column mapping
CSV_TO_DB = {
    "dates": "date",
    "Norway": "norway",
    "Algeria": "algeria",
    "Russia": "russia",
    "Azerbaijan": "azerbaijan",
    "Libya": "libya",
    "UK net flows": "uk_net_flows",
    "LNG": "lng",
    "EU total": "eu_total",
    "Nord Stream": "nord_stream",
    "Ukraine Gas Transit": "ukraine_gas_transit",
    "Yamal (BY,PL)": "yamal_by_pl",
    "Turkstream": "turkstream",
}


def _safe_float(val):
    if not val or val == "" or val == "nan" or val == "#N/A":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


class BruegelUpdater(BaseUpdater):
    name = "bruegel"
    tables = [TABLE]

    def run(self):
        last_date = self.get_last_date(TABLE)
        if last_date is None:
            last_date = dt.date(2021, 1, 1)

        self.log(f"Last date in DB: {last_date}")
        self.log("Finding latest Bruegel download URL...")

        zip_url = self._find_zip_url()
        if not zip_url:
            self.log("WARNING: Could not find Bruegel ZIP URL")
            return {"new_rows": 0}

        self.log(f"Downloading: {zip_url}")
        csv_data = self._download_daily_csv(zip_url)
        if not csv_data:
            self.log("WARNING: No daily_data CSV found in ZIP")
            return {"new_rows": 0}

        # Parse CSV and filter to new rows only
        reader = csv.DictReader(io.StringIO(csv_data))
        rows = []
        for rec in reader:
            date_str = rec.get("dates", "").strip()
            if not date_str:
                continue
            try:
                row_date = dt.datetime.strptime(date_str, "%d/%m/%Y").date()
            except ValueError:
                try:
                    row_date = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    continue

            if row_date <= last_date:
                continue

            row = [row_date.isoformat()]
            for csv_col, db_col in list(CSV_TO_DB.items())[1:]:  # Skip 'dates'
                row.append(_safe_float(rec.get(csv_col)))
            rows.append(tuple(row))

        if not rows:
            self.log("No new rows to insert")
            return {"new_rows": 0}

        n = self.insert_batch(TABLE, COLUMNS, rows)
        self.log(f"Inserted {n} new rows (up to {rows[-1][0]})")
        return {"new_rows": n}

    def _find_zip_url(self):
        """Scrape Bruegel page to find the latest ZIP download URL."""
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        try:
            resp = requests.get(BRUEGEL_PAGE, timeout=30, headers=headers)
            resp.raise_for_status()
            matches = re.findall(r'href="(/sites/default/files/[^"]*Gas[^"]*\.zip)"', resp.text, re.IGNORECASE)
            if matches:
                return "https://www.bruegel.org" + matches[0]
        except Exception as e:
            self.log(f"  Page scrape failed ({e}), trying URL patterns...")

        # Fallback: try recent week patterns
        today = dt.date.today()
        for weeks_back in range(0, 6):
            d = today - dt.timedelta(weeks=weeks_back)
            year = d.year
            month = d.strftime("%m")
            # ISO week number
            week_num = d.isocalendar()[1]
            url = f"https://www.bruegel.org/sites/default/files/{year}-{month}/Gas%20Tracker%20update%20week%20{week_num}%20{year}.zip"
            try:
                resp = requests.head(url, timeout=10, headers=headers)
                if resp.status_code == 200:
                    return url
            except Exception:
                continue

        return None

    def _download_daily_csv(self, zip_url):
        """Download ZIP and extract the daily_data CSV."""
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        }
        resp = requests.get(zip_url, timeout=120, headers=headers)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            for name in zf.namelist():
                if name.lower().startswith("daily_data") and name.endswith(".csv"):
                    return zf.read(name).decode("utf-8-sig")
        return None
