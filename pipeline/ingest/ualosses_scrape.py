#!/usr/bin/env python3
r"""
UALosses ingester — scrape the named Ukrainian military-casualties database (ualosses.org).

The data is SERVER-RENDERED HTML paginated by ?page=N (no API needed; ~213k records / ~2130 pages,
100/page). Each <li> record carries: name, DOB-DOD, location, status (img), rank (img), unit (insignia img)
+ the canonical slug. Quality source: per-soldier, obituary-verified (name/DOB/DOD/location/unit/rank).

RESUMABLE (per the batch-jobs-must-be-resumable rule): appends to soldiers.jsonl, tracks done pages in
done_pages.txt, skips already-scraped pages, flushes per page. Safe to interrupt + re-run. Polite delay.

Usage:
  python ualosses_scrape.py                 # full scrape (resumes)
  python ualosses_scrape.py --pages 1-5     # bounded (validation)
  python ualosses_scrape.py --incremental   # page 1 only, stop when all-known (daily refresh)
"""
import os, re, sys, json, time, html as _html, urllib.request, datetime as dt

OUT_DIR = os.environ.get("CASUALTY_DATA_DIR", "/mnt/c/Apps/rubase-scheduler/ualosses_data")
JSONL = os.path.join(OUT_DIR, "soldiers.jsonl")
DONE  = os.path.join(OUT_DIR, "done_pages.txt")
BASE  = "https://ualosses.org/en/soldiers/?page={}"
UA    = "Mozilla/5.0 (research; RuBase war-datasets casualty ingest)"
DELAY = 0.7  # polite

MONTHS = {m: i+1 for i, m in enumerate(
    ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"])}

def parse_endate(s):
    # "Nov. 6, 1973" / "Sept. 23, 2022" -> (ISO, precision). NEVER fabricate day precision:
    # a year-only source yields YYYY-01-01 but precision='year' so downstream can refuse to over-claim.
    s = s.strip().rstrip(".")
    m = re.search(r"([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})", s)   # search, not match: handles "(July 15, 2022)"
    if m:
        mo = MONTHS.get(m.group(1)[:3].lower())
        if mo: return f"{int(m.group(3)):04d}-{mo:02d}-{int(m.group(2)):02d}", "day"
    m = re.search(r"(\d{4})", s)        # year-only
    return (f"{m.group(1)}-01-01", "year") if m else (None, None)

REC = re.compile(r"<li>(.*?)</li>", re.S)
def parse_page(htmltext):
    recs = []
    for block in REC.findall(htmltext):
        if "/en/soldier/" not in block: continue
        g = lambda pat: (re.search(pat, block, re.S) or [None, None])[1]
        slug = g(r'href="/en/soldier/([a-z0-9-]+)/"')
        if not slug: continue
        name = g(r"<b>(.*?)</b>")
        status = g(r"/status/miniature/([a-z_]+)\.")          # dead / missing / ...
        rank   = g(r"/ranks/miniature/([a-z0-9_]+)\.")
        unit   = g(r"/military_units/insignia/miniature/([A-Za-z0-9_]+)\.")
        dates  = re.findall(r'font-size:0\.8rem">(.*?)</div>', block, re.S)
        dob = dod = location = raw_dates = None; dod_prec = None
        if dates:
            d0 = _html.unescape(re.sub(r"\s+", " ", dates[0])).strip(); raw_dates = d0
            if " - " in d0:
                a, b = d0.split(" - ", 1); dob, _ = parse_endate(a); dod, dod_prec = parse_endate(b)
            else:
                dob, _ = parse_endate(d0)
            if len(dates) > 1:
                location = _html.unescape(re.sub(r"<[^>]+>", "", dates[1])); location = re.sub(r"\s+", " ", location).strip()
        recs.append({"slug": slug, "name": _html.unescape(name).strip() if name else None,
                     "status": status, "rank": rank, "unit_code": unit,
                     "dob": dob, "dod": dod, "dod_precision": dod_prec, "raw_dates": raw_dates,
                     "location": location})
    return recs

def fetch(page, sort=None):
    url = BASE.format(page) + (f"&sort={sort}" if sort else "")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")

def last_page():
    pages = re.findall(r"\?page=(\d+)", fetch(1))
    return max(int(p) for p in pages) if pages else 1

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    args = sys.argv[1:]
    done = set()
    if os.path.exists(DONE):
        done = {int(x) for x in open(DONE).read().split() if x.strip().isdigit()}
    known = set()
    if os.path.exists(JSONL):
        for ln in open(JSONL, encoding="utf-8"):
            try: known.add(json.loads(ln)["slug"])
            except Exception: pass
    incremental = "--incremental" in args
    if "--pages" in args:
        a, b = args[args.index("--pages")+1].split("-"); pages = range(int(a), int(b)+1)
    elif incremental:
        pages = range(1, 9999)
    else:
        lp = last_page(); print(f"last page: {lp}", flush=True); pages = range(1, lp+1)

    # INCREMENTAL: order by death-date DESC so newly-added records (overwhelmingly recent deaths) cluster
    # at the FRONT, then walk pages until 2 CONSECUTIVE all-known pages (grace for a new record sitting just
    # past a known one). Catches the daily additions in ~a handful of pages instead of all 2130. Rare
    # late-added OLD-death obituaries (deep in -dod order) are swept by the periodic full --reconcile.
    sort = "-dod" if incremental else None
    out = open(JSONL, "a", encoding="utf-8")
    total_new = 0; clean_streak = 0
    for p in pages:
        if p in done and not incremental: continue
        try:
            recs = parse_page(fetch(p, sort))
        except Exception as e:
            print(f"page {p}: ERROR {e}", flush=True); time.sleep(3); continue
        new = [r for r in recs if r["slug"] not in known]
        for r in new:
            r["page"] = p; out.write(json.dumps(r, ensure_ascii=False) + "\n"); known.add(r["slug"])
        out.flush(); total_new += len(new)
        if not incremental:
            with open(DONE, "a") as d: d.write(f"{p}\n")
        if p % 25 == 0 or incremental:
            print(f"page {p}: {len(recs)} recs ({len(new)} new) | total_new={total_new} | known={len(known)}", flush=True)
        if incremental:
            clean_streak = clean_streak + 1 if (recs and not new) else 0
            if clean_streak >= 2:
                print(f"incremental: 2 consecutive all-known pages — stopping (added {total_new})", flush=True); break
        if not recs:
            print(f"page {p}: empty — stopping", flush=True); break
        time.sleep(DELAY)
    out.close()
    print(f"DONE — total records in jsonl: {len(known)} (+{total_new} this run)", flush=True)

if __name__ == "__main__":
    main()
