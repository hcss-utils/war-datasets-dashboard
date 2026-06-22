#!/usr/bin/env python3
r"""
Mediazona "РОССИЯ 200" roster ingester -> war_datasets casualties.mediazona_roster.

The named-RU-KIA database (g200w infographic) is downloadable from public S3 — NOT browse-only:
  - urls.json              : 227,680 records, each "Surname_Name_Patronymic_age"
  - distributed_markers.csv: per-record canvas (x,y), index-aligned to urls.json
  - location_names.csv     : 27,968 Russian towns with canvas coords
Home geography is recovered by nearest-town spatial join (marker -> closest town center).

⚠️ NO PER-RECORD DEATH DATE EXISTS in this dataset (g200w is a names+geography mosaic, not a timeline).
   So this table carries name/age/home-town only — by design, no dod column. Do NOT fabricate one.
   (UALosses is the per-record-date source; Mediazona is the RU roster/demographics/geography source.)
"""
import os, re, json, urllib.request, brotli, psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import numpy as np
from scipy.spatial import cKDTree
load_dotenv("/mnt/g/My Drive/SYSTEM_CREDENTIALS.env")

S3 = "https://s3.zona.media/infographics/g200w/{}"
UA = {"User-Agent": "Mozilla/5.0 (research; RuBase war-datasets casualty ingest)", "Referer": "https://200.zona.media/", "Accept-Encoding": "br"}

def fetch(path, brotli_expected=False):
    req = urllib.request.Request(S3.format(path), headers=UA)
    raw = urllib.request.urlopen(req, timeout=60).read()
    if brotli_expected:
        try: return brotli.decompress(raw).decode("utf-8", "replace")
        except brotli.error: return raw.decode("utf-8", "replace")   # CDN may pre-decompress
    return raw.decode("utf-8", "replace")

def parse_name(s):
    parts = s.split("_")
    age = int(parts[-1]) if parts and parts[-1].isdigit() else None
    toks = parts[:-1] if age is not None else parts
    surname  = toks[0] if len(toks) > 0 else None
    name     = toks[1] if len(toks) > 1 else None
    patron   = "_".join(toks[2:]) if len(toks) > 2 else None
    return surname, name, patron, (" ".join(toks) if toks else s), age

def main():
    print("fetching urls.json ...", flush=True)
    names = json.loads(fetch("urls.json.br", True))
    print(f"  {len(names)} records", flush=True)

    print("fetching markers + towns ...", flush=True)
    mk = [l for l in fetch("distributed_markers.csv.br", True).splitlines() if l.strip()]
    # markers are index-aligned to names; first two cols = x,y. (no header)
    mx = np.full(len(names), np.nan); my = np.full(len(names), np.nan)
    for i, row in enumerate(mk[:len(names)]):
        p = row.split(",")
        if len(p) >= 2 and p[0].lstrip("-").isdigit() and p[1].lstrip("-").isdigit():
            x, y = int(p[0]), int(p[1])
            if not (x == 0 and y == 0):   # (0,0) = location-unknown; do NOT snap to nearest town
                mx[i], my[i] = x, y

    towns = []
    for ln in fetch("location_names.csv.br", True).splitlines():
        p = ln.split(",")
        if len(p) >= 3 and p[1].lstrip("-").isdigit() and p[2].lstrip("-").isdigit():
            towns.append((p[0], int(p[1]), int(p[2])))
    tnames = [t[0] for t in towns]
    tree = cKDTree(np.array([[t[1], t[2]] for t in towns]))
    print(f"  {len(towns)} towns; nearest-town join ...", flush=True)
    home = [None] * len(names)
    valid = ~np.isnan(mx)
    idxs = np.where(valid)[0]
    if len(idxs):
        _, nn = tree.query(np.column_stack([mx[idxs], my[idxs]]))
        for j, i in enumerate(idxs): home[i] = tnames[nn[j]]

    print("loading to war_datasets.casualties.mediazona_roster ...", flush=True)
    cn = psycopg2.connect(host=os.environ["PG_WARDATASETS_HOST"], port=os.environ["PG_WARDATASETS_PORT"],
        dbname=os.environ["PG_WARDATASETS_DATABASE"], user=os.environ["PG_WARDATASETS_USER"],
        password=os.environ["PG_WARDATASETS_PASSWORD"], connect_timeout=20)
    cur = cn.cursor()
    cur.execute("""
      CREATE SCHEMA IF NOT EXISTS casualties;
      DROP TABLE IF EXISTS casualties.mediazona_roster;
      CREATE TABLE casualties.mediazona_roster (
        idx int PRIMARY KEY, full_name text, surname text, name text, patronymic text,
        age int, home_town text, marker_x int, marker_y int,
        note text DEFAULT 'no per-record death date in source (g200w names+geo mosaic)',
        source text DEFAULT 'mediazona 200.zona.media (g200w)', scraped_at timestamptz DEFAULT now());
    """)
    rows = []
    for i, s in enumerate(names):
        sur, nm, pat, full, age = parse_name(s)
        rows.append((i, full, sur, nm, pat, age, home[i],
                     None if np.isnan(mx[i]) else int(mx[i]),
                     None if np.isnan(my[i]) else int(my[i])))
    execute_values(cur, """INSERT INTO casualties.mediazona_roster
        (idx,full_name,surname,name,patronymic,age,home_town,marker_x,marker_y) VALUES %s""",
        rows, page_size=5000)
    cn.commit()
    cur.execute("SELECT count(*), count(age), count(home_town), round(avg(age),1) FROM casualties.mediazona_roster")
    n, na, nh, avg = cur.fetchone()
    print(f"DONE: {n} rows | age on {na} | home_town on {nh} | mean age {avg}", flush=True)
    cn.close()

if __name__ == "__main__":
    main()
