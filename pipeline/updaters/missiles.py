"""
Missile attacks updater.
Source: Kaggle dataset piterfm/massive-missile-attacks-on-ukraine
Method: TRUNCATE + INSERT (full refresh via Kaggle API).
Requires: kaggle CLI installed and ~/.kaggle/kaggle.json configured.
"""

import csv
import io
import os
import tempfile
import zipfile
import datetime as dt

import requests

from .base import BaseUpdater

KAGGLE_DATASET = "piterfm/massive-missile-attacks-on-ukraine"

TABLE = "aerial_assaults.missile_attacks"
COLUMNS = [
    "time_start", "time_end", "model", "launch_place", "target", "target_main",
    "launched", "destroyed", "not_reach_goal", "still_attacking",
    "border_crossing", "is_shahed", "num_hit_location", "num_fall_fragment_location",
    "carrier", "turbojet", "turbojet_destroyed", "affected_region",
    "destroyed_details", "launched_details", "launch_place_details", "source",
]


def _safe_float(val):
    if val is None or val == "" or val == "nan":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_ts(val):
    """Parse timestamp string to datetime or None."""
    if not val or val == "" or val == "nan":
        return None
    try:
        return dt.datetime.fromisoformat(val.replace("Z", "+00:00").replace("+00:00", ""))
    except (ValueError, TypeError):
        return None


class MissileUpdater(BaseUpdater):
    name = "missiles"
    tables = [TABLE]

    def run(self):
        self.log("Downloading missile attacks dataset from Kaggle...")

        csv_data = self._download_kaggle()
        if csv_data is None:
            self.log("WARNING: Could not download Kaggle data, skipping")
            return {"new_rows": 0}

        reader = csv.DictReader(io.StringIO(csv_data))
        rows = []
        for rec in reader:
            rows.append((
                _safe_ts(rec.get("time_start")),
                _safe_ts(rec.get("time_end")),
                rec.get("model") or None,
                rec.get("launch_place") or None,
                rec.get("target") or None,
                rec.get("target_main") or None,
                _safe_float(rec.get("launched")),
                _safe_float(rec.get("destroyed")),
                _safe_float(rec.get("not_reach_goal")),
                _safe_float(rec.get("still_attacking")),
                rec.get("border_crossing") or None,
                _safe_float(rec.get("is_shahed")),
                _safe_float(rec.get("num_hit_location")),
                _safe_float(rec.get("num_fall_fragment_location")),
                rec.get("carrier") or None,
                rec.get("turbojet") or None,
                rec.get("turbojet_destroyed") or None,
                rec.get("affected_region") or None,
                rec.get("destroyed_details") or None,
                rec.get("launched_details") or None,
                rec.get("launch_place_details") or None,
                rec.get("source") or None,
            ))

        self.log(f"  Parsed {len(rows)} missile attack records")

        n = self.truncate_and_insert(TABLE, COLUMNS, rows)
        self.log(f"  Inserted {n} rows")
        return {"new_rows": n}

    def _download_kaggle(self):
        """Download the missile_attacks_daily.csv from Kaggle API."""
        # Try kaggle CLI first
        try:
            return self._download_via_cli()
        except Exception as e:
            self.log(f"  Kaggle CLI failed ({e}), trying API...")

        # Try direct Kaggle API
        try:
            return self._download_via_api()
        except Exception as e:
            self.log(f"  Kaggle API also failed: {e}")
            return None

    def _download_via_cli(self):
        """Use kaggle CLI to download dataset."""
        import subprocess
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["kaggle", "datasets", "download", "-d", KAGGLE_DATASET, "-p", tmpdir, "--unzip"],
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                raise RuntimeError(f"kaggle CLI error: {result.stderr}")

            # Find the CSV file
            for fname in os.listdir(tmpdir):
                if "missile" in fname.lower() and fname.endswith(".csv"):
                    with open(os.path.join(tmpdir, fname)) as f:
                        return f.read()

            raise FileNotFoundError("No missile CSV found in download")

    def _download_via_api(self):
        """Use Kaggle REST API directly."""
        kaggle_json = os.path.expanduser("~/.kaggle/kaggle.json")
        if not os.path.exists(kaggle_json):
            raise FileNotFoundError("~/.kaggle/kaggle.json not found")

        import json
        with open(kaggle_json) as f:
            creds = json.load(f)

        auth = (creds["username"], creds["key"])
        url = f"https://www.kaggle.com/api/v1/datasets/download/{KAGGLE_DATASET}"
        resp = requests.get(url, auth=auth, timeout=120, stream=True)
        resp.raise_for_status()

        # Response is a ZIP file
        content = resp.content
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            for name in zf.namelist():
                if "missile" in name.lower() and name.endswith(".csv"):
                    return zf.read(name).decode("utf-8")

        raise FileNotFoundError("No missile CSV in Kaggle ZIP")
