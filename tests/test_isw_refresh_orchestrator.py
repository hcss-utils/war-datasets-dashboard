import importlib.util
import io
import json
import zipfile
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "pipeline" / "scripts" / "isw_refresh_orchestrator.py"
SPEC = importlib.util.spec_from_file_location("isw_refresh_orchestrator", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def make_zip(files: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return output.getvalue()


def test_three_level_bundle_is_classified_and_flattened(tmp_path, monkeypatch):
    leaf = make_zip({"shape.shp": b"shp", "shape.dbf": b"dbf", "shape.shx": b"shx"})
    middle = make_zip({"middle/leaf.zip": leaf})
    outer = make_zip({"outer/middle.zip": middle})

    attachments = tmp_path / "attachments"
    bundles = tmp_path / "bundles"
    attachments.mkdir()
    monkeypatch.setattr(MODULE, "ATTACHMENTS", attachments)
    monkeypatch.setattr(MODULE, "BUNDLES", bundles)

    part = tmp_path / "outer.zip.part"
    part.write_bytes(outer)
    target = attachments / "outer.zip"

    assert MODULE.zip_kind(part) == ("bundle", None)
    assert MODULE.publish_archive(part, target) == ["leaf.zip"]
    assert MODULE.zip_kind(attachments / "leaf.zip") == ("shapefile", None)
    assert (bundles / "outer.zip").exists()


def test_recursive_bundle_rejects_terminal_zip_without_shapefile(tmp_path):
    invalid_leaf = make_zip({"readme.txt": b"not a shapefile"})
    outer = make_zip({"invalid.zip": invalid_leaf})
    candidate = tmp_path / "outer.zip"
    candidate.write_bytes(outer)

    kind, reason = MODULE.zip_kind(candidate)
    assert kind is None
    assert "no_shp_or_nested_zip_member" in reason


def test_drive_health_rejects_duplicate_mount_stack(tmp_path):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({
        "status": "degraded_duplicate_mounts",
        "updated_at": "2026-08-14T03:42:13+02:00",
        "wsl_probe": {"healthy": False, "mount_count": 8, "sentinel_readable": True},
    }))

    health = MODULE.drive_mount_health(state)

    assert health["healthy"] is False
    assert health["mount_count"] == 8
    assert health["reason"] == "drive_mount_degraded"


def test_drive_health_accepts_exactly_one_mount(tmp_path):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({
        "status": "healthy",
        "updated_at": "2026-08-14T03:42:13+02:00",
        "wsl_probe": {"healthy": True, "mount_count": 1, "sentinel_readable": True},
    }))

    assert MODULE.drive_mount_health(state)["healthy"] is True
