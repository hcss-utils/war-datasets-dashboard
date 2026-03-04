"""
OpenSanctions EU updater.
Source: opensanctions.org bulk CSV (targets.simple.csv).
Method: TRUNCATE + INSERT (full replacement, ~70K rows).
"""

import csv
import io

import requests

from .base import BaseUpdater

SANCTIONS_URL = "https://data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv"

# DB columns — id is SERIAL (auto), so we skip it and insert the rest
DB_COLUMNS = [
    "entity_id", "schema_type", "name", "aliases", "birth_date",
    "countries", "addresses", "identifiers", "sanctions", "phones",
    "emails", "program_ids", "dataset", "first_seen", "last_seen", "last_change",
]

# CSV header → DB column mapping
CSV_MAP = {
    "id": "entity_id",
    "schema": "schema_type",
    "name": "name",
    "aliases": "aliases",
    "birth_date": "birth_date",
    "countries": "countries",
    "addresses": "addresses",
    "identifiers": "identifiers",
    "sanctions": "sanctions",
    "phones": "phones",
    "emails": "emails",
    "program_ids": "program_ids",
    "dataset": "dataset",
    "first_seen": "first_seen",
    "last_seen": "last_seen",
    "last_change": "last_change",
}


def _to_timestamp(val):
    """Convert ISO date/datetime string to value suitable for TIMESTAMP column, or None."""
    if not val or val.strip() == "":
        return None
    return val.strip()


class OpenSanctionsUpdater(BaseUpdater):
    name = "opensanctions"
    tables = ["economic_data.opensanctions_eu"]

    def run(self):
        self.log("Downloading OpenSanctions CSV...")
        resp = requests.get(SANCTIONS_URL, timeout=300, stream=True)
        resp.raise_for_status()

        content = resp.content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))

        rows = []
        for rec in reader:
            row = []
            for db_col in DB_COLUMNS:
                # Find the CSV key that maps to this DB column
                csv_key = None
                for ck, dc in CSV_MAP.items():
                    if dc == db_col:
                        csv_key = ck
                        break
                val = rec.get(csv_key, "")
                if db_col in ("first_seen", "last_seen", "last_change"):
                    row.append(_to_timestamp(val))
                else:
                    row.append(val if val else None)
            rows.append(tuple(row))

        self.log(f"  Parsed {len(rows)} entities")

        self.log("TRUNCATE + INSERT into opensanctions_eu...")
        n = self.truncate_and_insert(
            "economic_data.opensanctions_eu", DB_COLUMNS, rows
        )
        self.log(f"  Inserted {n} rows")

        return {"rows": n}
