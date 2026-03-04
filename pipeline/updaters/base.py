"""
Base utilities for all dataset updaters.
Provides DB connection, insert helpers, and status reporting.
"""

import os
import sys
import datetime as dt
from pathlib import Path

import psycopg2
import psycopg2.extras


def load_env(path=None):
    """Parse .env file into a dict."""
    if path is None:
        path = Path(__file__).parent.parent / ".env"
    config = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip()
    return config


def get_db_connection(config=None):
    """Return a psycopg2 connection using .env config."""
    if config is None:
        config = load_env()
    return psycopg2.connect(
        host=config.get("DB_HOST", "localhost"),
        port=int(config.get("DB_PORT", 5432)),
        dbname=config.get("DB_NAME", "war_datasets"),
        user=config.get("DB_USER", "postgres"),
        password=config.get("DB_PASSWORD", ""),
    )


class BaseUpdater:
    """Shared base for all dataset updaters."""

    name = "base"  # Override in subclass
    tables = []    # List of "schema.table" strings this updater manages

    def __init__(self, config=None):
        if config is None:
            config = load_env()
        self.config = config
        self.conn = None

    def connect(self):
        if self.conn is None or self.conn.closed:
            self.conn = get_db_connection(self.config)
        return self.conn

    def close(self):
        if self.conn and not self.conn.closed:
            self.conn.close()
            self.conn = None

    def get_row_count(self, table):
        """COUNT(*) for a table."""
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            return cur.fetchone()[0]

    def get_last_date(self, table, date_col="date"):
        """MAX(date_col) for a table. Returns date or None."""
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"SELECT MAX({date_col}) FROM {table}")
            val = cur.fetchone()[0]
            if val is None:
                return None
            if isinstance(val, int):
                # VIINA stores dates as YYYYMMDD integers
                return dt.date(val // 10000, (val % 10000) // 100, val % 100)
            if isinstance(val, dt.datetime):
                return val.date()
            if isinstance(val, dt.date):
                return val
            return val

    def insert_batch(self, table, columns, rows, conflict_col=None, page_size=1000):
        """
        Batch INSERT with optional ON CONFLICT DO NOTHING.
        rows: list of tuples matching columns order.
        """
        if not rows:
            return 0
        conn = self.connect()
        placeholders = ",".join(["%s"] * len(columns))
        cols = ",".join(columns)
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        if conflict_col:
            sql += f" ON CONFLICT ({conflict_col}) DO NOTHING"
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows, page_size=page_size)
        conn.commit()
        return len(rows)

    def truncate_and_insert(self, table, columns, rows, page_size=1000):
        """TRUNCATE table then batch INSERT."""
        if not rows:
            return 0
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE TABLE {table}")
        placeholders = ",".join(["%s"] * len(columns))
        cols = ",".join(columns)
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows, page_size=page_size)
        conn.commit()
        return len(rows)

    def delete_and_insert(self, table, columns, rows, where_clause, page_size=1000):
        """DELETE matching rows then INSERT. For partial replacement (e.g. current year)."""
        if not rows:
            return 0
        conn = self.connect()
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {table} WHERE {where_clause}")
            deleted = cur.rowcount
        placeholders = ",".join(["%s"] * len(columns))
        cols = ",".join(columns)
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows, page_size=page_size)
        conn.commit()
        return len(rows)

    def status(self):
        """Return status dict for each managed table."""
        results = {}
        for table in self.tables:
            try:
                conn = self.connect()
                count = self.get_row_count(table)
                # Try common date column names
                max_date = None
                for col in ("date", "event_date", "first_seen", "last_seen"):
                    try:
                        with conn.cursor() as cur:
                            cur.execute(f"SELECT MAX({col}) FROM {table}")
                            val = cur.fetchone()[0]
                            if val is not None:
                                if isinstance(val, int):
                                    max_date = dt.date(val // 10000, (val % 10000) // 100, val % 100)
                                elif isinstance(val, dt.datetime):
                                    max_date = val.date()
                                elif isinstance(val, dt.date):
                                    max_date = val
                                break
                    except psycopg2.Error:
                        conn.rollback()
                        continue

                staleness = None
                if max_date:
                    staleness = (dt.date.today() - max_date).days

                results[table] = {
                    "count": count,
                    "max_date": str(max_date) if max_date else None,
                    "staleness_days": staleness,
                }
            except Exception as e:
                results[table] = {"error": str(e)}
                if self.conn and not self.conn.closed:
                    self.conn.rollback()
        return results

    def run(self):
        """Execute the update. Override in subclass."""
        raise NotImplementedError

    def log(self, msg):
        ts = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] [{self.name}] {msg}")
