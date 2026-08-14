import importlib.util
from pathlib import Path

import pandas as pd
import pytest


SCRIPT = Path(__file__).parents[1] / "pipeline" / "scripts" / "import_isw_shapefiles.py"
SPEC = importlib.util.spec_from_file_location("import_isw_shapefiles", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def test_workspace_reset_prevents_cross_archive_contamination(tmp_path):
    stale = tmp_path / "stale.shp"
    nested = tmp_path / "old" / "nested.dbf"
    stale.write_bytes(b"old")
    nested.parent.mkdir()
    nested.write_bytes(b"old")

    MODULE._reset_workspace(tmp_path)

    assert list(tmp_path.iterdir()) == []


def test_single_shapefile_searches_recursively_and_rejects_ambiguity(tmp_path):
    nested = tmp_path / "one" / "two" / "shape.shp"
    nested.parent.mkdir(parents=True)
    nested.write_bytes(b"shape")
    assert MODULE._single_shapefile(tmp_path) == nested

    (tmp_path / "second.shp").write_bytes(b"shape")
    with pytest.raises(ValueError, match="expected_one_shapefile:found_2"):
        MODULE._single_shapefile(tmp_path)


def test_confidence_preserves_categories_and_normalizes_integral_scores():
    source = pd.Series(["low", "nominal", "3.0", 4, "2.5", None])
    raw, numeric = MODULE._split_confidence(source)

    assert raw.tolist() == ["low", "nominal", "3.0", 4, "2.5", None]
    assert numeric.tolist()[:4] == [pd.NA, pd.NA, 3, 4]
    assert pd.isna(numeric.iloc[4])
    assert pd.isna(numeric.iloc[5])


@pytest.mark.parametrize(
    ("declared", "expected"),
    [("Point Z", "point"), ("Measured 3D LineString", "line"), ("Polygon Z", "polygon")],
)
def test_declared_geometry_type_maps_to_existing_enum(monkeypatch, declared, expected):
    import pyogrio

    monkeypatch.setattr(pyogrio, "read_info", lambda _path: {"geometry_type": declared})
    assert MODULE._declared_geometry_type(Path("unused.shp")) == expected


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Claimed Furthest Israeli Advances April 18,2024.zip", "2024-04-18"),
        ("Palestinian Militia Infiltration February 29,2024.zip", "2024-02-29"),
        ("Lebanon NASA FIRMS data October 26-27, 2024.zip", "2024-10-27"),
        ("Confirmed Israeli Strikes against Iran AO 10302024.zip", "2024-10-30"),
    ],
)
def test_source_date_parser_accepts_isw_full_month_variants(filename, expected):
    assert MODULE.parse_date_from_filename(filename).isoformat() == expected


def test_palestinian_infiltration_is_not_misclassified_as_ukraine():
    filename = "Palestinian Militia Infiltration April 11,2024.zip"
    assert MODULE.classify_conflict(filename) == "israel_gaza"
    assert MODULE.classify_layer_type(filename) == "palestinian_militia_infiltration"


def test_target_theatre_outranks_actor_in_cross_border_filename():
    filename = "Confirmed Israeli Strikes against Iran October 25 AO 10302024.zip"
    assert MODULE.classify_conflict(filename) == "iran"


@pytest.mark.parametrize("filename", [
    "ClaimedUkrainianCounteroffensivesDEC060205.zip",
    "UkraineControlMapAO02FEB22024.zip",
    "ReportedUkrainianPartisanWarfareNOV092924.zip",
])
def test_implausible_or_malformed_years_are_not_accepted(filename):
    assert MODULE.parse_date_from_filename(filename) is None
