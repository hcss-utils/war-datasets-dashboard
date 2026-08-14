#!/usr/bin/env python3
"""Supervise the Gmail -> ZIP archive -> VPS PostGIS ISW refresh.

This job is deterministic and resume-safe at the attachment level. It does not
depend on the Google Drive mount at runtime. It records a heartbeat and an
atomic state document, validates every downloaded ZIP before publication,
invokes the incremental importer, and verifies the authoritative VPS table
advanced before declaring success.

The job does *not* establish that ISW's editorial geometries are ground truth.
It establishes only that all Gmail-reachable Ukraine shapefile attachments have
been preserved, accepted ZIPs have been offered to the importer, and the VPS
catalogue has advanced monotonically to the expected source date.
"""
from __future__ import annotations

import base64
import email.utils
import fcntl
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(os.environ.get("ISW_RUNTIME_ROOT", "/mnt/c/Apps/rubase-scheduler/isw-shapefiles"))
ATTACHMENTS = ROOT / "attachments"
BUNDLES = ROOT / "bundles"
STATE = ROOT / "state.json"
HEARTBEAT = ROOT / "heartbeat.json"
LEDGER = ROOT / "download_ledger.jsonl"
LOG = ROOT / "isw_refresh.log"
LOCK = ROOT / "isw_refresh.lock"
TOKEN = Path(os.environ.get("ISW_TOKEN_FILE", "/home/stephan/.config/rubase/isw-gmail-token.json"))
ENV_FILE = Path(os.environ.get("ISW_ENV_FILE", "/home/stephan/.config/rubase/isw-refresh.env"))
IMPORTER = Path(os.environ.get("ISW_IMPORTER", "/home/stephan/.local/lib/isw-refresh/import_to_server.py"))
DRIVE_ARCHIVE = os.environ.get("ISW_DRIVE_ARCHIVE", "")
GDRIVE_HEALTH_STATE = Path(os.environ.get(
    "ISW_GDRIVE_HEALTH_STATE",
    "/mnt/c/Users/sdspi/AppData/Local/GDriveWSLSelfHeal/state.json",
))
QUERY = 'from:press@understandingwar.org subject:"Daily Shapefiles" has:attachment'
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
MAX_RETRIES = 3


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def log(message: str) -> None:
    line = f"[{utcnow()}] {message}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
        fh.flush()


def beat(phase: str, **extra: Any) -> None:
    atomic_json(HEARTBEAT, {"updated_at": utcnow(), "phase": phase, **extra})


def save_state(status: str, phase: str, **extra: Any) -> None:
    old: dict[str, Any] = {}
    if STATE.exists():
        try:
            old = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception:
            old = {}
    if status != "failed":
        old.pop("failed_at", None)
        old.pop("error", None)
    atomic_json(STATE, {
        **old,
        "status": status,
        "phase": phase,
        "updated_at": utcnow(),
        **extra,
    })


@contextmanager
def exclusive_lock():
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w", encoding="utf-8") as fh:
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("another ISW refresh is already running")
        fh.write(f"pid={os.getpid()} started_at={utcnow()}\n")
        fh.flush()
        yield


def db_profile() -> dict[str, Any]:
    url = os.environ["PG_WARDATASETS_URL"].replace("+psycopg2", "")
    with psycopg2.connect(url, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*), max(layer_date), max(imported_at) FROM isw.shapefile_metadata")
            rows, max_date, max_imported = cur.fetchone()
    return {
        "rows": int(rows),
        "max_layer_date": max_date.isoformat() if max_date else None,
        "max_imported_at": max_imported.isoformat() if max_imported else None,
    }


def gmail_service():
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not creds.valid:
        creds.refresh(Request())
        tmp = TOKEN.with_suffix(".tmp")
        tmp.write_text(creds.to_json(), encoding="utf-8")
        os.replace(tmp, TOKEN)
        os.chmod(TOKEN, 0o600)
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def message_ids(service) -> list[str]:
    ids: list[str] = []
    token = None
    while True:
        response = service.users().messages().list(
            userId="me", q=QUERY, maxResults=500, pageToken=token
        ).execute()
        ids.extend(item["id"] for item in response.get("messages", []))
        token = response.get("nextPageToken")
        beat("enumerating_mail", messages=len(ids))
        if not token:
            return ids


def walk_parts(part: dict[str, Any]):
    filename = part.get("filename") or ""
    body = part.get("body") or {}
    if filename.lower().endswith(".zip") and body.get("attachmentId"):
        yield filename, body["attachmentId"], int(body.get("size") or 0)
    for child in part.get("parts") or []:
        yield from walk_parts(child)


def _zip_bytes_kind(data: bytes, depth: int = 0) -> tuple[str | None, str | None]:
    """Classify ZIP bytes, accepting recursively nested shapefile bundles."""
    if depth > 8:
        return None, "nested_zip_depth_exceeded"
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if not archive.namelist():
                return None, "empty_zip"
            bad = archive.testzip()
            if bad:
                return None, f"crc_failure:{bad}"
            names = archive.namelist()
            if any(name.lower().endswith(".shp") for name in names):
                return "shapefile", None
            inner_names = [name for name in names if name.lower().endswith(".zip")]
            if not inner_names:
                return None, "no_shp_or_nested_zip_member"
            for name in inner_names:
                inner_kind, inner_reason = _zip_bytes_kind(archive.read(name), depth + 1)
                if not inner_kind:
                    return None, f"invalid_nested_zip:{name}:{inner_reason}"
            return "bundle", None
    except Exception as exc:
        return None, f"{type(exc).__name__}:{exc}"


def zip_kind(path: Path) -> tuple[str | None, str | None]:
    """Classify a validated archive as a direct shapefile or recursive ZIP bundle."""
    try:
        return _zip_bytes_kind(path.read_bytes())
    except Exception as exc:
        return None, f"{type(exc).__name__}:{exc}"


def valid_zip(path: Path) -> tuple[bool, str | None]:
    kind, reason = zip_kind(path)
    return kind is not None, reason


def publish_archive(part: Path, target: Path) -> list[str]:
    """Atomically publish a direct ZIP or expand an outer ZIP-of-ZIPs.

    Outer bundles are preserved separately for reproducibility. Their validated
    constituent shapefile ZIPs are flattened into ``attachments`` because the
    generic PostGIS importer consumes one shapefile archive per file.
    """
    kind, reason = zip_kind(part)
    if not kind:
        raise ValueError(reason)
    if kind == "shapefile":
        os.replace(part, target)
        return [target.name]

    BUNDLES.mkdir(parents=True, exist_ok=True)
    published: list[str] = []
    def publish_nested(data: bytes, member_path: str, depth: int = 1) -> None:
        if depth > 8:
            raise ValueError(f"nested_zip_depth_exceeded:{member_path}")
        inner_kind, inner_reason = _zip_bytes_kind(data, depth)
        if inner_kind == "shapefile":
            name = Path(member_path).name
            destination = ATTACHMENTS / name
            if destination.exists():
                if destination.read_bytes() != data:
                    raise ValueError(f"nested_filename_collision:{name}")
            else:
                partial = destination.with_suffix(destination.suffix + ".part")
                partial.write_bytes(data)
                os.replace(partial, destination)
            published.append(name)
            return
        if inner_kind != "bundle":
            raise ValueError(inner_reason or f"invalid_nested_archive:{member_path}")
        with zipfile.ZipFile(io.BytesIO(data)) as nested:
            members = sorted(name for name in nested.namelist() if name.lower().endswith(".zip"))
            for child in members:
                publish_nested(nested.read(child), child, depth + 1)

    with zipfile.ZipFile(part) as outer:
        members = sorted(name for name in outer.namelist() if name.lower().endswith(".zip"))
        for member in members:
            publish_nested(outer.read(member), member)
    os.replace(part, BUNDLES / target.name)
    return published


def append_ledger(record: dict[str, Any]) -> None:
    with LEDGER.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        fh.flush()
        os.fsync(fh.fileno())


def download_all(service) -> dict[str, Any]:
    ATTACHMENTS.mkdir(parents=True, exist_ok=True)
    BUNDLES.mkdir(parents=True, exist_ok=True)
    existing = {p.name for p in ATTACHMENTS.glob("*.zip")}
    existing_bundles = {p.name for p in BUNDLES.glob("*.zip")}
    ids = message_ids(service)
    downloaded = skipped = errors = 0
    latest_mail_date: date | None = None
    for index, msg_id in enumerate(ids, 1):
        msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        subject = headers.get("subject", "")
        parsed = email.utils.parsedate_to_datetime(headers.get("date", ""))
        if parsed:
            d = parsed.date()
            latest_mail_date = max(latest_mail_date or d, d)
        for filename, attachment_id, expected_size in walk_parts(msg.get("payload") or {}):
            beat(
                "validating_archive",
                messages_done=index - 1,
                messages_total=len(ids),
                filename=filename,
                downloaded=downloaded,
                errors=errors,
            )
            target = ATTACHMENTS / filename
            if filename in existing or filename in existing_bundles:
                candidate = target if filename in existing else BUNDLES / filename
                ok, _ = valid_zip(candidate)
                if ok:
                    skipped += 1
                    continue
            final_error = "unknown"
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    payload = service.users().messages().attachments().get(
                        userId="me", messageId=msg_id, id=attachment_id
                    ).execute()
                    data = base64.urlsafe_b64decode(payload["data"])
                    part = target.with_suffix(target.suffix + ".part")
                    part.write_bytes(data)
                    if expected_size and len(data) != expected_size:
                        raise ValueError(f"size_mismatch:{len(data)}!={expected_size}")
                    published = publish_archive(part, target)
                    if filename in {p.name for p in BUNDLES.glob("*.zip")}:
                        existing_bundles.add(filename)
                    existing.update(published)
                    downloaded += len(published)
                    append_ledger({
                        "status": "downloaded", "at": utcnow(), "message_id": msg_id,
                        "subject": subject, "filename": filename, "size": len(data),
                        "published": published,
                    })
                    break
                except Exception as exc:
                    final_error = f"{type(exc).__name__}:{exc}"
                    if attempt < MAX_RETRIES:
                        time.sleep(2 ** attempt)
            else:
                errors += 1
                append_ledger({
                    "status": "error", "at": utcnow(), "message_id": msg_id,
                    "subject": subject, "filename": filename, "error": final_error,
                })
            beat("downloading", messages_done=index, messages_total=len(ids),
                 downloaded=downloaded, errors=errors)
    return {
        "messages": len(ids), "downloaded": downloaded, "skipped": skipped,
        "download_errors": errors, "archive_zip_count": len(existing),
        "bundle_zip_count": len(existing_bundles),
        "latest_mail_date": latest_mail_date.isoformat() if latest_mail_date else None,
    }


def run_importer() -> None:
    env = os.environ.copy()
    env["ISW_ATTACHMENTS_DIR"] = str(ATTACHMENTS)
    env["ISW_ENV_FILE"] = str(ENV_FILE)
    beat("importing")
    with LOG.open("a", encoding="utf-8") as output:
        process = subprocess.Popen(
            [sys.executable, str(IMPORTER), "--skip-existing"],
            env=env, stdout=output, stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + 7200
        while process.poll() is None:
            if time.monotonic() >= deadline:
                process.terminate()
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                raise RuntimeError("importer exceeded 7200-second timeout")
            beat("importing", importer_pid=process.pid)
            time.sleep(30)
    if process.returncode:
        raise RuntimeError(f"importer exited {process.returncode}")


def drive_mount_health(path: Path = GDRIVE_HEALTH_STATE) -> dict[str, Any]:
    """Return the controller's measured mount health without touching Drive."""
    if not path.exists():
        return {"healthy": False, "reason": "health_state_missing"}
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        probe = state.get("wsl_probe") or {}
        healthy = bool(probe.get("healthy")) and probe.get("mount_count") == 1
        return {
            "healthy": healthy,
            "status": state.get("status"),
            "mount_count": probe.get("mount_count"),
            "sentinel_readable": probe.get("sentinel_readable"),
            "updated_at": state.get("updated_at"),
            "reason": None if healthy else "drive_mount_degraded",
        }
    except Exception as exc:
        return {"healthy": False, "reason": f"health_state_invalid:{type(exc).__name__}"}


def mirror_archive() -> dict[str, Any]:
    """Best-effort durable raw-file mirror after authoritative DB publication.

    The mirror is deliberately downstream: an unavailable Drive mount can mark
    archival health degraded, but can never prevent Gmail recovery or VPS load.
    """
    if not DRIVE_ARCHIVE:
        return {"status": "not_configured"}
    health = drive_mount_health()
    if not health["healthy"]:
        return {"status": "deferred", "reason": health["reason"], "health": health}
    target = Path(DRIVE_ARCHIVE)
    try:
        target.mkdir(parents=True, exist_ok=True)
        copied = 0
        for source in ATTACHMENTS.glob("*.zip"):
            destination = target / source.name
            if destination.exists() and destination.stat().st_size == source.stat().st_size:
                continue
            partial = destination.with_suffix(destination.suffix + ".part")
            with source.open("rb") as src, partial.open("wb") as dst:
                while chunk := src.read(1024 * 1024):
                    dst.write(chunk)
            ok, reason = valid_zip(partial)
            if not ok:
                partial.unlink(missing_ok=True)
                raise RuntimeError(f"mirror validation failed for {source.name}: {reason}")
            os.replace(partial, destination)
            copied += 1
            if copied % 50 == 0:
                beat("mirroring_archive", copied=copied)
        return {"status": "healthy", "copied": copied}
    except Exception as exc:
        return {"status": "degraded", "error": f"{type(exc).__name__}: {exc}"}


def main() -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    load_dotenv(ENV_FILE)
    started = utcnow()
    with exclusive_lock():
        try:
            save_state("running", "preflight", started_at=started)
            beat("preflight")
            before = db_profile()
            log(f"preflight db rows={before['rows']} max_layer_date={before['max_layer_date']}")
            result = download_all(gmail_service())
            log(f"download complete: {result}")
            if result["download_errors"]:
                raise RuntimeError(f"{result['download_errors']} attachment downloads failed")
            run_importer()
            after = db_profile()
            expected = result["latest_mail_date"]
            if after["rows"] < before["rows"]:
                raise RuntimeError("database row high-water mark regressed")
            if expected and (not after["max_layer_date"] or after["max_layer_date"] < expected):
                raise RuntimeError(
                    f"database max layer date {after['max_layer_date']} trails source {expected}"
                )
            archive = mirror_archive()
            final_status = "healthy" if archive["status"] in {"healthy", "not_configured"} else "degraded"
            save_state(final_status, "complete", started_at=started, completed_at=utcnow(),
                       before=before, after=after, download=result, archive_mirror=archive)
            beat("complete", status=final_status, db_max_layer_date=after["max_layer_date"])
            log(f"{final_status.upper()} db rows={after['rows']} "
                f"max_layer_date={after['max_layer_date']} archive={archive}")
            return 0
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            save_state("failed", "failed", started_at=started, failed_at=utcnow(), error=error)
            beat("failed", status="failed", error=error)
            log(f"FAILED {error}")
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
