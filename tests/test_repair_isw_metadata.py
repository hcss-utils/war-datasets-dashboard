import importlib.util
from datetime import date
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "pipeline" / "scripts" / "repair_isw_metadata.py"
SPEC = importlib.util.spec_from_file_location("repair_isw_metadata", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def test_repairs_explicit_dates_and_theatre_but_leaves_unparseable_dates_visible():
    rows = [
        (1, "Kursk Incursion Russian Advances in Russia April 01, 2025.zip",
         "ukraine", "kursk_russian_advances", date(2026, 1, 25)),
        (2, "Lebanon NASA FIRMS data, October 5-6.zip",
         "lebanon", "fire_data", date(2026, 1, 25)),
    ]

    changes, provenance = MODULE.proposed_changes(rows)

    assert (1, "layer_date", "2026-01-25", "2025-04-01",
            "deterministic_filename_date_parser") in changes
    assert (1, "conflict", "ukraine", "kursk",
            "deterministic_filename_theatre_classifier") in changes
    assert (2, "legacy_unverified") in provenance
    assert not any(change[0] == 2 and change[1] == "layer_date" for change in changes)
