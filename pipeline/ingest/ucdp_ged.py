#!/usr/bin/env python3
r"""
UCDP GED ingester -> war_datasets casualties.ucdp_ged_monthly.

The dated, methodologically-transparent fatality source for the Russia-Ukraine war (both sides + civilians):
UCDP Georeferenced Event Dataset (Uppsala). Each event has date_start + deaths_a/deaths_b/deaths_civilians.
For the Russia-Ukraine dyad: side_a = Government of Russia -> deaths_a = RUSSIAN forces killed;
side_b = Government of Ukraine -> deaths_b = UKRAINIAN forces killed.

⚠️ UCDP "best" estimates are CONSERVATIVE event-verified counts — far below the named/claimed figures.
   This is the DATED complement (a rigorous timeline + side split), not a magnitude estimate.

Data (no token; bulk download): the full annual release (ged261, 1989-2025) + the latest monthly CANDIDATE
(2026). Both passed as CSV paths in args, or defaults under /tmp/r17.
"""
import os, csv, sys, psycopg2, io
from datetime import date
from dotenv import load_dotenv
load_dotenv("/mnt/g/My Drive/SYSTEM_CREDENTIALS.env")

CSVS = sys.argv[1:] or ["/tmp/r17/GEDEvent_v26_1.csv", "/tmp/r17/ucdp_ged.csv"]
START = "2022-02-24"
monthly = {}   # 'YYYY-MM' -> [ru, ua, civ, best, events]
seen = set()
for path in CSVS:
    if not os.path.exists(path): print("skip (missing):", path); continue
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if (row.get("country") or "") != "Ukraine": continue
            ds = (row.get("date_start") or "")[:10]
            if not ds or ds < START: continue
            eid = row.get("id") or row.get("relid")
            if eid in seen: continue
            seen.add(eid)
            m = ds[:7]
            g = lambda k: int(float(row.get(k) or 0))
            acc = monthly.setdefault(m, [0, 0, 0, 0, 0])
            acc[0] += g("deaths_a"); acc[1] += g("deaths_b")
            acc[2] += g("deaths_civilians"); acc[3] += g("best"); acc[4] += 1

rows = [(m + "-01", v[0], v[1], v[2], v[3], v[4]) for m, v in sorted(monthly.items())]
print(f"months: {len(rows)} | RU total {sum(v[1] for v in [r[1:] for r in rows]) if False else sum(r[1] for r in rows):,} "
      f"UA total {sum(r[2] for r in rows):,} civ {sum(r[3] for r in rows):,} best {sum(r[4] for r in rows):,}")

cn = psycopg2.connect(host=os.environ["PG_WARDATASETS_HOST"], port=os.environ["PG_WARDATASETS_PORT"],
    dbname=os.environ["PG_WARDATASETS_DATABASE"], user=os.environ["PG_WARDATASETS_USER"],
    password=os.environ["PG_WARDATASETS_PASSWORD"], connect_timeout=20)
cur = cn.cursor()
cur.execute("""CREATE SCHEMA IF NOT EXISTS casualties;
  DROP TABLE IF EXISTS casualties.ucdp_ged_monthly;
  CREATE TABLE casualties.ucdp_ged_monthly (
    month date PRIMARY KEY, ru_deaths int, ua_deaths int, civilian_deaths int, best_total int, events int,
    note text DEFAULT 'UCDP GED event-verified (conservative); deaths_a=RU forces, deaths_b=UA forces',
    source text DEFAULT 'UCDP GED (Uppsala) ged261 + candidate', loaded_at timestamptz DEFAULT now());""")
io_buf = io.StringIO()
for r in rows: io_buf.write("\t".join(str(x) for x in r) + "\n")
io_buf.seek(0)
cur.copy_expert("COPY casualties.ucdp_ged_monthly (month,ru_deaths,ua_deaths,civilian_deaths,best_total,events) FROM STDIN", io_buf)
cn.commit()
cur.execute("SELECT count(*), sum(ru_deaths), sum(ua_deaths), sum(civilian_deaths) FROM casualties.ucdp_ged_monthly")
print("LOADED ucdp_ged_monthly:", cur.fetchone()); cn.close()
