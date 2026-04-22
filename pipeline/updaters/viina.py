"""
VIINA (Violent Incident Information from News Articles) updater.
Source: zhukovyuri/VIINA GitHub repo — yearly ZIP of event_info CSVs.
Method: DELETE current year + INSERT (only updates current year data).
"""

import csv
import io
import zipfile
import datetime as dt

import requests

from .base import BaseUpdater

VIINA_URL_TEMPLATE = "https://media.githubusercontent.com/media/zhukovyuri/VIINA/main/Data/event_info_latest_{year}.zip"

DB_COLUMNS = [
    "viina_version", "event_id", "event_id_1pd", "date", "time",
    "geonameid", "feature_code", "asciiname", "adm1_name", "adm1_code",
    "adm2_name", "adm2_code", "longitude", "latitude", "geo_precision",
    "geo_api", "location", "address", "report_id", "source", "url",
    "text", "lang",
]

# CSV header → DB column (most are lowercase versions)
CSV_MAP = {
    "viina_version": "viina_version",
    "event_id": "event_id",
    "event_id_1pd": "event_id_1pd",
    "date": "date",
    "time": "time",
    "geonameid": "geonameid",
    "feature_code": "feature_code",
    "asciiname": "asciiname",
    "ADM1_NAME": "adm1_name",
    "ADM1_CODE": "adm1_code",
    "ADM2_NAME": "adm2_name",
    "ADM2_CODE": "adm2_code",
    "longitude": "longitude",
    "latitude": "latitude",
    "GEO_PRECISION": "geo_precision",
    "GEO_API": "geo_api",
    "location": "location",
    "address": "address",
    "report_id": "report_id",
    "source": "source",
    "url": "url",
    "text": "text",
    "lang": "lang",
}

# Reverse map: DB column → CSV header
DB_TO_CSV = {v: k for k, v in CSV_MAP.items()}


def _safe_int(val):
    if val is None or val == "":
        return None
    try:
        return int(float(val))  # handle "703448.0" style
    except (ValueError, TypeError):
        return None


def _safe_float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


class VIINAUpdater(BaseUpdater):
    name = "viina"
    tables = ["conflict_events.viina_events"]

    def run(self):
        year = dt.date.today().year
        url = VIINA_URL_TEMPLATE.format(year=year)

        self.log(f"Downloading VIINA {year} ZIP from GitHub...")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()

        # Parse ZIP → CSV
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise RuntimeError(f"No CSV found in VIINA ZIP for {year}")

        csv_name = csv_names[0]
        self.log(f"  Parsing {csv_name}...")

        with zf.open(csv_name) as f:
            text = f.read().decode("utf-8", errors="replace")

        reader = csv.DictReader(io.StringIO(text))

        rows = []
        min_date = None
        for rec in reader:
            row = []
            for db_col in DB_COLUMNS:
                csv_key = DB_TO_CSV.get(db_col, db_col)
                val = rec.get(csv_key, "")

                if db_col in ("event_id", "event_id_1pd", "date", "geonameid",
                              "adm1_code", "adm2_code", "report_id"):
                    row.append(_safe_int(val))
                elif db_col in ("longitude", "latitude"):
                    row.append(_safe_float(val))
                elif db_col == "location":
                    # location field is sometimes just a number like "1"
                    row.append(val if val else None)
                else:
                    row.append(val if val else None)
            rows.append(tuple(row))

            # Track min date for DELETE range
            date_val = _safe_int(rec.get("date", ""))
            if date_val and (min_date is None or date_val < min_date):
                min_date = date_val

        self.log(f"  Parsed {len(rows)} events for {year}")

        if not rows:
            self.log("  No events to insert")
            return {"rows": 0}

        # DELETE current year's data, then INSERT
        # Use date range: all dates >= first date in the downloaded file
        where = f"date >= {min_date}"
        self.log(f"  DELETE WHERE {where}, then INSERT {len(rows)} rows...")
        n = self.delete_and_insert(
            "conflict_events.viina_events", DB_COLUMNS, rows, where
        )
        self.log(f"  Done — {n} rows inserted for {year}")

        return {"rows": n, "year": year}
