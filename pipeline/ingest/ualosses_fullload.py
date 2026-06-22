import os, json, io, psycopg2
from dotenv import load_dotenv
load_dotenv("/mnt/g/My Drive/SYSTEM_CREDENTIALS.env")
JSONL="/mnt/c/Apps/rubase-scheduler/ualosses_data/soldiers.jsonl"
d=lambda v: v if (v and len(str(v))==10) else None
cols=["slug","name","status","rank","unit_code","dob","dod","dod_precision","raw_dates","location","page"]
buf=io.StringIO(); n=0; seen=set()
for ln in open(JSONL,encoding="utf-8"):
    try: r=json.loads(ln)
    except: continue
    if r.get("slug") in seen: continue          # dedup on slug (TRUNCATE+COPY has no ON CONFLICT)
    seen.add(r.get("slug"))
    v=[r.get("slug"),r.get("name"),r.get("status"),r.get("rank"),r.get("unit_code"),d(r.get("dob")),d(r.get("dod")),r.get("dod_precision"),r.get("raw_dates"),r.get("location"),r.get("page")]
    buf.write("\t".join("\\N" if x is None else str(x).replace("\\","\\\\").replace("\t"," ").replace("\n"," ") for x in v)+"\n"); n+=1
buf.seek(0)
cn=psycopg2.connect(host=os.environ["PG_WARDATASETS_HOST"],port=os.environ["PG_WARDATASETS_PORT"],dbname=os.environ["PG_WARDATASETS_DATABASE"],user=os.environ["PG_WARDATASETS_USER"],password=os.environ["PG_WARDATASETS_PASSWORD"],connect_timeout=20)
cur=cn.cursor()
cur.execute("TRUNCATE casualties.ualosses_kia")
cur.copy_expert("COPY casualties.ualosses_kia ("+",".join(cols)+") FROM STDIN", buf)
cn.commit()
cur.execute("SELECT count(*),count(*) FILTER(WHERE status='dead'),count(*) FILTER(WHERE status='dead' AND dod_precision='day') FROM casualties.ualosses_kia")
print("LOADED %d rows -> table total/dead/dead-dayDOD = %s" % (n, cur.fetchone())); cn.close()
