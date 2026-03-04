"""
GDELT updater — thin wrapper around existing update_gdelt.py.
NOT included in default --all run (existing GDELT crons handle it).
Only runs with explicit --gdelt flag.
"""

import subprocess

from .base import BaseUpdater

GDELT_PYTHON = "/stratbase/apps/webapps/gdelt-updater/env/bin/python"
GDELT_SCRIPT = "/stratbase/apps/webapps/gdelt-updater/update_gdelt.py"


class GDELTUpdater(BaseUpdater):
    name = "gdelt"
    tables = [
        "global_events.gdelt_events",
        "global_events.gdelt_gkg_coercive_quotations",
        "global_events.gdelt_gkg_redline_quotations",
        "global_events.gdelt_weekly_varx",
        "global_events.gdelt_gkg_themes_lookup",
    ]

    def __init__(self, config=None, days=2):
        super().__init__(config)
        self.days = days

    def run(self):
        self.log(f"Running update_gdelt.py --days {self.days} via subprocess...")

        result = subprocess.run(
            [GDELT_PYTHON, GDELT_SCRIPT, "--days", str(self.days)],
            capture_output=True,
            text=True,
            timeout=3600,
        )

        if result.stdout:
            for line in result.stdout.strip().split("\n")[-10:]:
                self.log(f"  {line}")

        if result.returncode != 0:
            self.log(f"  GDELT update failed (exit code {result.returncode})")
            if result.stderr:
                for line in result.stderr.strip().split("\n")[-5:]:
                    self.log(f"  STDERR: {line}")
            raise RuntimeError(f"update_gdelt.py failed with exit code {result.returncode}")

        self.log("  GDELT update completed successfully")
        return {"exit_code": result.returncode}
