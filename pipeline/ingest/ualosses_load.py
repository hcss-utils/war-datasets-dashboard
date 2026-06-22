#!/usr/bin/env python3
"""Load ualosses_data/soldiers.jsonl -> war_datasets casualties.ualosses_kia (idempotent upsert on slug)."""
import os, json, sys, psycopg2
from dotenv import load_dotenv
load_dotenv("/mnt/g/My Drive/SYSTEM_CREDENTIALS.env")
JSONL=os.path.join(os.environ.get("CASUALTY_DATA_DIR","/mnt/c/Apps/rubase-scheduler/ualosses_data"),"soldiers.jsonl")
cn=psycopg2.connect(host=os.environ["PG_WARDATASETS_HOST"],port=os.environ["PG_WARDATASETS_PORT"],
    dbname=os.environ["PG_WARDATASETS_DATABASE"],user=os.environ["PG_WARDATASETS_USER"],
    password=os.environ["PG_WARDATASETS_PASSWORD"],connect_timeout=20)
cur=cn.cursor(); d=lambda v: v if (v and len(str(v))==10) else None
batch=[]
for ln in open(JSONL,encoding="utf-8"):
    try: r=json.loads(ln)
    except: continue
    batch.append((r["slug"],r.get("name"),r.get("status"),r.get("rank"),r.get("unit_code"),
                  d(r.get("dob")),d(r.get("dod")),r.get("dod_precision"),r.get("raw_dates"),
                  r.get("location"),r.get("page")))
cur.executemany("""INSERT INTO casualties.ualosses_kia
  (slug,name,status,rank,unit_code,dob,dod,dod_precision,raw_dates,location,page)
  VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
  ON CONFLICT (slug) DO UPDATE SET status=EXCLUDED.status,dod=EXCLUDED.dod,
    dod_precision=EXCLUDED.dod_precision,scraped_at=now()""", batch)
cn.commit()
cur.execute("SELECT count(*), count(*) FILTER (WHERE status='dead') FROM casualties.ualosses_kia")
print("loaded %d rows; table: %d total, %d confirmed KIA" % (len(batch), *cur.fetchone()))
cn.close()
