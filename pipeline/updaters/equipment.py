"""
Equipment & Personnel losses updater.
Source: PetroIvaniuk/2022-Ukraine-Russia-War-Dataset on GitHub.
Method: TRUNCATE + INSERT (small datasets, ~1500 rows each).
"""

import json
import datetime as dt

import requests

from .base import BaseUpdater

EQUIPMENT_URL = "https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/russia_losses_equipment.json"
PERSONNEL_URL = "https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/russia_losses_personnel.json"

# DB columns ↔ JSON key mapping
EQUIPMENT_COLUMNS = [
    "date", "day", "aircraft", "helicopter", "tank", "apc",
    "field_artillery", "mrl", "anti_aircraft", "drone", "cruise_missiles",
    "naval_ship", "submarines", "vehicles_fuel_tanks", "special_equipment",
    "military_auto", "fuel_tank",
]

# JSON keys differ from DB columns in some cases
EQUIPMENT_JSON_MAP = {
    "date": "date",
    "day": "day",
    "aircraft": "aircraft",
    "helicopter": "helicopter",
    "tank": "tank",
    "apc": "APC",
    "field_artillery": "field artillery",
    "mrl": "MRL",
    "anti_aircraft": "anti-aircraft warfare",
    "drone": "drone",
    "cruise_missiles": "cruise missiles",
    "naval_ship": "naval ship",
    "submarines": "submarines",
    "vehicles_fuel_tanks": "vehicles and fuel tanks",
    "special_equipment": "special equipment",
    "military_auto": "military auto",
    "fuel_tank": "fuel tank",
}

PERSONNEL_COLUMNS = ["date", "day", "personnel", "personnel_approx", "pow"]
PERSONNEL_JSON_MAP = {
    "date": "date",
    "day": "day",
    "personnel": "personnel",
    "personnel_approx": "personnel*",
    "pow": "POW",
}


def _safe_int(val):
    """Convert to int or None."""
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


class EquipmentUpdater(BaseUpdater):
    name = "equipment"
    tables = ["equipment_losses.equipment_daily", "equipment_losses.personnel_daily"]

    def run(self):
        self.log("Downloading equipment JSON...")
        resp = requests.get(EQUIPMENT_URL, timeout=60)
        resp.raise_for_status()
        equip_data = resp.json()
        self.log(f"  Got {len(equip_data)} equipment records")

        self.log("Downloading personnel JSON...")
        resp = requests.get(PERSONNEL_URL, timeout=60)
        resp.raise_for_status()
        pers_data = resp.json()
        self.log(f"  Got {len(pers_data)} personnel records")

        # Parse equipment rows
        equip_rows = []
        for rec in equip_data:
            row = []
            for db_col in EQUIPMENT_COLUMNS:
                json_key = EQUIPMENT_JSON_MAP[db_col]
                val = rec.get(json_key)
                if db_col == "date":
                    row.append(val)  # already "YYYY-MM-DD" string
                elif db_col == "day":
                    row.append(_safe_int(val))
                else:
                    row.append(_safe_int(val))
            equip_rows.append(tuple(row))

        # Parse personnel rows
        pers_rows = []
        for rec in pers_data:
            row = []
            for db_col in PERSONNEL_COLUMNS:
                json_key = PERSONNEL_JSON_MAP[db_col]
                val = rec.get(json_key)
                if db_col == "date":
                    row.append(val)
                elif db_col == "personnel_approx":
                    row.append(str(val) if val is not None else None)
                else:
                    row.append(_safe_int(val))
            pers_rows.append(tuple(row))

        # TRUNCATE + INSERT
        self.log("Inserting equipment data...")
        n = self.truncate_and_insert(
            "equipment_losses.equipment_daily", EQUIPMENT_COLUMNS, equip_rows
        )
        self.log(f"  Inserted {n} equipment rows")

        self.log("Inserting personnel data...")
        n = self.truncate_and_insert(
            "equipment_losses.personnel_daily", PERSONNEL_COLUMNS, pers_rows
        )
        self.log(f"  Inserted {n} personnel rows")

        return {"equipment_rows": len(equip_rows), "personnel_rows": len(pers_rows)}
