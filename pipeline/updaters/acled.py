"""
ACLED incremental updater.
Source: acleddata.com OAuth API.
Method: Incremental — query MAX(event_date), fetch new, ON CONFLICT DO NOTHING.
"""

import datetime as dt
import time
import socket
from typing import Optional

import requests

from .base import BaseUpdater

ACLED_TOKEN_URL = "https://acleddata.com/oauth/token"
ACLED_API_URL = "https://acleddata.com/api/acled/read"
ACLED_LEGACY_API_URL = "https://api.acleddata.com/acled/read"

MAX_RESULTS_PER_PAGE = 5000
MAX_RETRIES = 3
RETRY_DELAY = 5

# Module-level OAuth token cache
_oauth_token = None
_token_expiry = None

DB_COLUMNS = [
    "event_id_cnty", "event_date", "year", "time_precision", "disorder_type",
    "event_type", "sub_event_type", "actor1", "assoc_actor_1", "inter1",
    "actor2", "assoc_actor_2", "inter2", "interaction", "civilian_targeting",
    "iso", "region", "country", "admin1", "admin2", "admin3", "location",
    "latitude", "longitude", "geo_precision", "source", "source_scale",
    "notes", "fatalities", "tags", "timestamp", "year_month",
]

# API field names that map directly (most are identical)
API_KEY_MAP = {col: col for col in DB_COLUMNS}


def _get_oauth_token(email: str, password: str) -> Optional[str]:
    """Get OAuth access token from ACLED, with caching."""
    global _oauth_token, _token_expiry

    if _oauth_token and _token_expiry and dt.datetime.now() < _token_expiry:
        return _oauth_token

    response = requests.post(
        ACLED_TOKEN_URL,
        data={
            "grant_type": "password",
            "client_id": "acled",
            "username": email,
            "password": password,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    _oauth_token = data.get("access_token")
    expires_in = data.get("expires_in", 3600)
    _token_expiry = dt.datetime.now() + dt.timedelta(seconds=expires_in - 60)
    return _oauth_token


def _safe_int(val):
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_float(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_acled_date(val):
    """Parse ACLED date formats like '25 January 2026' or '2026-01-25'."""
    if not val:
        return None
    try:
        return dt.datetime.strptime(val, "%d %B %Y").date()
    except ValueError:
        pass
    try:
        return dt.datetime.strptime(val, "%Y-%m-%d").date()
    except ValueError:
        return None


class ACLEDUpdater(BaseUpdater):
    name = "acled"
    tables = ["conflict_events.acled_events"]

    def __init__(self, config=None, days_back=None):
        super().__init__(config)
        self.days_back = days_back

    def _fetch_page(self, api_url, params, headers, page):
        """Fetch one page with retries."""
        params["page"] = page
        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.get(api_url, params=params, headers=headers, timeout=120)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as e:
                if attempt < MAX_RETRIES - 1:
                    self.log(f"  Retry {attempt + 1}/{MAX_RETRIES}: {e}")
                    time.sleep(RETRY_DELAY)
                else:
                    raise

    def _fetch_all(self, start_date, end_date):
        """Fetch ACLED events via OAuth API with pagination."""
        email = self.config.get("ACLED_EMAIL", "")
        password = self.config.get("ACLED_PASSWORD", "")
        api_key = self.config.get("ACLED_API_KEY", "")

        # Determine API: try legacy first, fall back to OAuth
        use_oauth = False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect(("api.acleddata.com", 443))
            sock.close()
        except (socket.error, socket.timeout, socket.gaierror, OSError):
            self.log("Legacy API unreachable, using OAuth")
            use_oauth = True

        if use_oauth:
            if not password:
                raise RuntimeError("ACLED_PASSWORD required for OAuth API")
            token = _get_oauth_token(email, password)
            if not token:
                raise RuntimeError("Failed to obtain ACLED OAuth token")
            api_url = ACLED_API_URL
            headers = {"Authorization": f"Bearer {token}"}
            params = {
                "_format": "json",
                "event_date": f"{start_date}|{end_date}",
                "event_date_where": "BETWEEN",
                "limit": MAX_RESULTS_PER_PAGE,
            }
        else:
            api_url = ACLED_LEGACY_API_URL
            headers = {}
            params = {
                "key": api_key,
                "email": email,
                "event_date": f"{start_date}|{end_date}",
                "event_date_where": "BETWEEN",
                "limit": MAX_RESULTS_PER_PAGE,
            }

        self.log(f"Fetching ACLED {start_date} to {end_date} via {'OAuth' if use_oauth else 'Legacy'} API")

        all_events = []
        page = 1
        while True:
            data = self._fetch_page(api_url, params, headers, page)

            if "error" in data:
                # If legacy fails, retry with OAuth
                if not use_oauth and password:
                    self.log(f"  Legacy API error: {data.get('error')}. Switching to OAuth...")
                    return self._fetch_oauth(start_date, end_date, email, password)
                raise RuntimeError(f"ACLED API error: {data.get('error')}")

            events = data.get("data", [])
            if not events:
                break

            all_events.extend(events)
            self.log(f"  Page {page}: {len(events)} events (total: {len(all_events)})")

            if len(events) < MAX_RESULTS_PER_PAGE:
                break
            page += 1
            if page > 1000:
                self.log("  WARNING: Reached page limit")
                break

        return all_events

    def _fetch_oauth(self, start_date, end_date, email, password):
        """Direct OAuth fetch (fallback)."""
        token = _get_oauth_token(email, password)
        if not token:
            raise RuntimeError("OAuth token failed")
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "_format": "json",
            "event_date": f"{start_date}|{end_date}",
            "event_date_where": "BETWEEN",
            "limit": MAX_RESULTS_PER_PAGE,
        }
        all_events = []
        page = 1
        while True:
            data = self._fetch_page(ACLED_API_URL, params, headers, page)
            events = data.get("data", [])
            if not events:
                break
            all_events.extend(events)
            if len(events) < MAX_RESULTS_PER_PAGE:
                break
            page += 1
            if page > 1000:
                break
        return all_events

    def _event_to_row(self, ev):
        """Convert API event dict to DB row tuple."""
        parsed_date = _parse_acled_date(ev.get("event_date"))
        year = _safe_int(ev.get("year"))
        year_month = None
        if parsed_date:
            year_month = parsed_date.strftime("%Y-%m")

        return (
            ev.get("event_id_cnty"),
            parsed_date,
            year,
            ev.get("time_precision"),
            ev.get("disorder_type"),
            ev.get("event_type"),
            ev.get("sub_event_type"),
            ev.get("actor1"),
            ev.get("assoc_actor_1"),
            ev.get("inter1"),
            ev.get("actor2"),
            ev.get("assoc_actor_2"),
            ev.get("inter2"),
            ev.get("interaction"),
            ev.get("civilian_targeting"),
            _safe_int(ev.get("iso")),
            ev.get("region"),
            ev.get("country"),
            ev.get("admin1"),
            ev.get("admin2"),
            ev.get("admin3"),
            ev.get("location"),
            _safe_float(ev.get("latitude")),
            _safe_float(ev.get("longitude")),
            ev.get("geo_precision"),
            ev.get("source"),
            ev.get("source_scale"),
            ev.get("notes"),
            _safe_int(ev.get("fatalities")),
            ev.get("tags"),
            _safe_int(ev.get("timestamp")),
            year_month,
        )

    def run(self):
        conn = self.connect()

        # Determine start date
        if self.days_back:
            start_date = dt.date.today() - dt.timedelta(days=self.days_back)
        else:
            last = self.get_last_date("conflict_events.acled_events", "event_date")
            if last:
                start_date = last + dt.timedelta(days=1)
                self.log(f"Last event_date in DB: {last}")
            else:
                start_date = dt.date.today() - dt.timedelta(days=365)
                self.log("No existing data, fetching last 365 days")

        end_date = dt.date.today()

        if start_date > end_date:
            self.log("Already up to date")
            return {"new_events": 0}

        events = self._fetch_all(start_date, end_date)
        if not events:
            self.log("No new events from API")
            return {"new_events": 0}

        rows = [self._event_to_row(ev) for ev in events]
        self.log(f"Inserting {len(rows)} events (ON CONFLICT DO NOTHING)...")
        self.insert_batch(
            "conflict_events.acled_events",
            DB_COLUMNS,
            rows,
            conflict_col="event_id_cnty",
        )
        self.log(f"  Done — {len(rows)} events processed")

        return {"new_events": len(rows)}
