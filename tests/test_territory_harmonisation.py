import importlib.util
from pathlib import Path


ROOT = Path(__file__).parents[1]


def load(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


GEN = load("gen_territory_harmonisation", "pipeline/scripts/gen_territory_harmonisation.py")
REFRESH = load("refresh_territory_harmonisation", "pipeline/scripts/refresh_territory_harmonisation.py")


def test_availability_summary_counts_and_highwaters():
    rows = [
        {"date": "2026-08-12", "deepstate_available": True,
         "isw_ukraine_control_available": False, "isw_ukraine_change_available": True,
         "isw_kursk_available": False, "like_for_like_comparison_available": False},
        {"date": "2026-08-13", "deepstate_available": True,
         "isw_ukraine_control_available": True, "isw_ukraine_change_available": False,
         "isw_kursk_available": True, "like_for_like_comparison_available": True},
    ]
    result = GEN.availability_summary(rows)
    assert result["calendarDays"] == 2
    assert result["deepstate"] == {"days": 2, "firstDate": "2026-08-12", "latestDate": "2026-08-13"}
    assert result["iswUkraineControl"]["days"] == 1
    assert result["iswKursk"]["latestDate"] == "2026-08-13"


def test_refresh_infers_current_stages_after_state_loss():
    measured = {
        "deepstate_latest": "2026-08-13",
        "isw_latest": "2026-08-13",
        "comparison_latest": "2026-08-13",
        "theatre_latest": "2026-08-13",
    }
    target = {"deepstate": "2026-08-13", "isw_control": "2026-08-13"}
    assert REFRESH.infer_completed_stages(measured, target) == set(REFRESH.STAGES)


def test_refresh_does_not_infer_stale_products():
    measured = {
        "deepstate_latest": "2026-08-12",
        "isw_latest": "2026-08-13",
        "comparison_latest": "2026-08-12",
        "theatre_latest": "2026-08-12",
    }
    target = {"deepstate": "2026-08-13", "isw_control": "2026-08-13"}
    assert REFRESH.infer_completed_stages(measured, target) == {"isw_russian_control_daily"}
