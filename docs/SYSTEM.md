# War Datasets Dashboard — Complete System Documentation

> Last updated: 2026-03-04

This document provides a complete, end-to-end account of the War Datasets Dashboard
system: the PostgreSQL database, the automated data updaters, the JSON export pipeline,
the React dashboard, and the daily deployment cron that ties everything together.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Infrastructure](#2-infrastructure)
3. [Database Architecture](#3-database-architecture)
4. [Dataset Updaters](#4-dataset-updaters)
5. [Data Export Pipeline](#5-data-export-pipeline)
6. [Dashboard Application](#6-dashboard-application)
7. [Daily Automation Pipeline](#7-daily-automation-pipeline)
8. [Deployment & Operations](#8-deployment--operations)
9. [Known Issues & Workarounds](#9-known-issues--workarounds)

---

## 1. System Overview

The system consists of four major components that run in sequence daily:

```
                          VPS (Hetzner 138.201.62.161)
    ┌────────────────────────────────────────────────────────────┐
    │                                                            │
    │  06:00 UTC  ┌──────────────┐                               │
    │  ──────────>│ GDELT Updater│  (events, GKG, VARX)          │
    │             └──────────────┘                               │
    │                                                            │
    │  09:00 UTC  ┌──────────────────┐                           │
    │  ──────────>│ Dataset Updater   │  (10 daily + 2 annual)   │
    │             │ update_all.py     │                           │
    │             └────────┬─────────┘                           │
    │                      │                                     │
    │                      ▼                                     │
    │             ┌──────────────────┐       ┌──────────────┐    │
    │  10:00 UTC  │ Dashboard Pipeline│──────>│ PostgreSQL   │    │
    │  ──────────>│ run_pipeline.sh   │<──────│ war_datasets │    │
    │             └────────┬─────────┘       └──────────────┘    │
    │                      │                                     │
    │                      ▼                                     │
    │             ┌──────────────────┐                           │
    │             │ Export → Build →  │                           │
    │             │ Deploy to GitHub  │                           │
    │             │ Pages             │                           │
    │             └──────────────────┘                           │
    └────────────────────────────────────────────────────────────┘
                           │
                           ▼
              sdspieg.github.io/war-datasets-dashboard
```

**Data flow**: External APIs → Updaters → PostgreSQL → JSON Export → React Dashboard → GitHub Pages

---

## 2. Infrastructure

### VPS (Hetzner)

| Property | Value |
|----------|-------|
| IP       | `138.201.62.161` |
| OS       | Ubuntu (Linux) |
| SSH      | `ssh root@138.201.62.161` |
| Python   | 3.x with `psycopg2`, `requests` in venv |
| Node.js  | 22.x (for dashboard build) |
| Git      | Authenticated via stored token |

### PostgreSQL Database

| Property | Value |
|----------|-------|
| Host     | `138.201.62.161:5432` (localhost on VPS) |
| Database | `war_datasets` |
| User     | `postgres` |
| Schemas  | 12 schemas, 68+ tables |

### GitHub Pages

| Property | Value |
|----------|-------|
| Repository | `sdspieg/war-datasets-dashboard` |
| Live URL   | `https://sdspieg.github.io/war-datasets-dashboard/` |
| Branch     | `gh-pages` (built `dist/` folder) |
| Source     | `main` (React/TypeScript source) |

---

## 3. Database Architecture

The `war_datasets` database contains 12 schemas with 68+ tables covering every
dimension of the Russia-Ukraine conflict:

### Schemas

| Schema | Tables | Description |
|--------|--------|-------------|
| `conflict_events` | 6 | ACLED, UCDP, VIINA, Bellingcat, HAPI conflict events |
| `equipment_losses` | 2 | Equipment daily + personnel daily (Ukraine MOD via PetroIvaniuk) |
| `aerial_assaults` | 1 | Kaggle missile/drone attack dataset |
| `economic_data` | 5 | SIPRI military expenditure, CREA fossil revenue, Bruegel gas flows, World Bank GDP, OpenSanctions |
| `humanitarian` | 8 | HAPI (IDPs, refugees, needs, food prices, funding, risk, poverty), UNHCR |
| `global_events` | 5 | GDELT events, GKG quotations (coercive + redline), VARX, themes |
| `western_sabotage` | 4 | EUvsDisinfo, EURePoC cyber, Baltic cable incidents, Leiden hybrid |
| `isw` | 3+ | ISW territory data, control polygons, shapefile metadata |
| `kiel` | 2 | Kiel Institute aid data (by donor, timeline) |
| `public` | 5+ | Materialized views, daily territory areas |

### Table Inventory (auto-updatable marked with *)

**Daily auto-updated (10 tables, 6 updaters):**

| Table | Updater | Method | Source |
|-------|---------|--------|--------|
| `conflict_events.acled_events` * | ACLED | Incremental (ON CONFLICT) | ACLED API |
| `conflict_events.viina_events` * | VIINA | DELETE year + INSERT | GitHub ZIP |
| `equipment_losses.equipment_daily` * | Equipment | TRUNCATE + INSERT | PetroIvaniuk GitHub |
| `equipment_losses.personnel_daily` * | Equipment | TRUNCATE + INSERT | PetroIvaniuk GitHub |
| `economic_data.opensanctions_eu` * | OpenSanctions | TRUNCATE + INSERT | CSV download |
| `economic_data.crea_russia_fossil` * | CREA | Incremental (append) | CREA API |
| `economic_data.bruegel_gas_flows` * | Bruegel | Incremental (append) | Bruegel ZIP |
| `aerial_assaults.missile_attacks` * | Missiles | TRUNCATE + INSERT | Kaggle |

**HAPI humanitarian (8 tables, 1 updater, weekly refresh):**

| Table | Source | Rows |
|-------|--------|------|
| `humanitarian.hapi_idps` * | HDX CSV | ~1,170 |
| `humanitarian.hapi_refugees` * | HDX CSV | ~45,890 |
| `humanitarian.hapi_humanitarian_needs` * | HDX CSV | ~11,049 |
| `humanitarian.hapi_food_prices` * | HDX CSV | ~65,758 |
| `humanitarian.hapi_funding` * | HDX CSV | ~34 |
| `humanitarian.hapi_national_risk` * | HDX CSV | ~1 |
| `humanitarian.hapi_poverty_rate` * | HDX CSV | ~12 |
| `conflict_events.hapi_conflict_events` * | HDX CSV | ~40,866 |

**Annual check (2 tables):**

| Table | Updater | Method | Source |
|-------|---------|--------|--------|
| `economic_data.world_bank_gdp` * | WorldBank | UPSERT | World Bank API |
| `humanitarian.unhcr_population` * | UNHCR | TRUNCATE + INSERT | UNHCR API |

**GDELT (separate crons, not in default run):**

| Table | Cron |
|-------|------|
| `global_events.gdelt_events` | 06:00 UTC daily |
| `global_events.gdelt_gkg_coercive_quotations` | 07:00 UTC daily |
| `global_events.gdelt_gkg_redline_quotations` | 07:00 UTC daily |
| `global_events.gdelt_weekly_varx` | 08:00 UTC Mondays |

**Static / manual-upload (no auto-updater):**

| Table | Reason |
|-------|--------|
| `conflict_events.ucdp_events` | UCDP API requires token, updated infrequently |
| `conflict_events.bellingcat_harm` | Manual CSV upload |
| `economic_data.sipri_military_expenditure` | Annual SIPRI Excel import |
| `western_sabotage.eurepoc_cyber_incidents` | Manual CSV |
| `western_sabotage.euvsdisinfo_disinfo_cases` | Manual CSV |
| `western_sabotage.baltic_cable_incidents` | Manual CSV |

---

## 4. Dataset Updaters

### Architecture

All updaters live in `dataset-updater/updaters/` and inherit from `BaseUpdater`:

```
dataset-updater/
├── update_all_datasets.py          # CLI orchestrator (287 lines)
├── .env                            # DB credentials + API keys
├── updaters/
│   ├── base.py                     # BaseUpdater class (185 lines)
│   ├── equipment.py                # PetroIvaniuk GitHub JSON
│   ├── opensanctions.py            # OpenSanctions CSV
│   ├── acled.py                    # ACLED OAuth API (301 lines)
│   ├── viina.py                    # VIINA GitHub ZIP
│   ├── gdelt.py                    # GDELT subprocess wrapper
│   ├── crea.py                     # CREA fossil tracker API
│   ├── bruegel.py                  # Bruegel gas flows ZIP
│   ├── missiles.py                 # Kaggle missile attacks
│   ├── hapi.py                     # HDX humanitarian CSVs (8 datasets)
│   ├── worldbank.py                # World Bank GDP API
│   └── unhcr.py                    # UNHCR refugee API
```

### BaseUpdater (`updaters/base.py`)

Provides shared DB utilities used by all updaters:

```python
class BaseUpdater:
    def connect()                                    # psycopg2 connection
    def get_row_count(table)                         # SELECT COUNT(*)
    def get_last_date(table, date_col)               # SELECT MAX(date_col)
    def insert_batch(table, cols, rows, conflict_col) # Batch INSERT, optional ON CONFLICT
    def truncate_and_insert(table, cols, rows)        # TRUNCATE + batch INSERT
    def delete_and_insert(table, cols, rows, where)   # DELETE matching + batch INSERT
    def status()                                      # Row counts + staleness
    def run()                                         # Override in subclass
```

All batch inserts use `psycopg2.extras.execute_batch()` with `page_size=1000`.

### Updater Details

#### 1. Equipment (`equipment.py`)

| Field | Value |
|-------|-------|
| Source | PetroIvaniuk GitHub (raw JSON) |
| Tables | `equipment_losses.equipment_daily`, `equipment_losses.personnel_daily` |
| Method | TRUNCATE + INSERT (~1,500 rows each) |
| Columns (equipment) | date, day, aircraft, helicopter, tank, apc, field_artillery, mrl, anti_aircraft, drone, cruise_missiles, naval_ship, submarines, vehicles_fuel_tanks, special_equipment, military_auto, fuel_tank |
| Columns (personnel) | date, day, personnel, personnel_approx, pow |
| Runtime | ~5 seconds |

#### 2. OpenSanctions (`opensanctions.py`)

| Field | Value |
|-------|-------|
| Source | `data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv` |
| Table | `economic_data.opensanctions_eu` |
| Method | TRUNCATE + INSERT (~70,000 rows) |
| Columns | entity_id, schema_type, name, aliases, birth_date, countries, addresses, identifiers, sanctions, phones, emails, program_ids, dataset, first_seen, last_seen, last_change |
| Runtime | ~30 seconds |

#### 3. ACLED (`acled.py`)

| Field | Value |
|-------|-------|
| Source | ACLED API with OAuth authentication |
| Table | `conflict_events.acled_events` |
| Method | Incremental — fetch dates after MAX(event_date), ON CONFLICT DO NOTHING |
| Columns | 31 columns including event_id_cnty, event_date, disorder_type, event_type, sub_event_type, actor1/2, location, latitude, longitude, fatalities |
| Auth | OAuth token (ACLED_EMAIL + ACLED_PASSWORD), cached with 1-hour expiry |
| Pagination | 5,000 records/page, up to 1,000 pages |
| Fallback | Legacy API (`api.acleddata.com`) if OAuth fails |
| Limitation | Free/academic tier limited to 12-month rolling window |
| Runtime | 30-120 seconds |

#### 4. VIINA (`viina.py`)

| Field | Value |
|-------|-------|
| Source | GitHub ZIP (`zhukovyuri/VIINA` repo) |
| Table | `conflict_events.viina_events` |
| Method | DELETE current year + INSERT |
| Columns | 23 columns including viina_version, event_id, date (YYYYMMDD int), geonameid, longitude, latitude, source, url, text |
| Date format | Integer YYYYMMDD (e.g., 20260304) |
| Runtime | ~20 seconds |
| Known issue | 2026 ZIP may not exist yet early in the year → graceful 404 |

#### 5. CREA (`crea.py`)

| Field | Value |
|-------|-------|
| Source | `api.russiafossiltracker.com/v0/counter` (REST, no auth) |
| Table | `economic_data.crea_russia_fossil` |
| Method | Incremental — append rows after MAX(date) |
| Columns | destination_region, pricing_scenario, version, pricing_scenario_name, date, value_tonne, value_eur, value_usd |
| Regions | China, EU, India, Others, South Korea, Turkiye, UK, US (8 regions) |
| Chunking | 90-day fetches to avoid API limits |
| Aggregation | API returns per-country per-commodity; aggregated to per-region per-date |
| Runtime | 5-30 seconds |

#### 6. Bruegel (`bruegel.py`)

| Field | Value |
|-------|-------|
| Source | `bruegel.org/dataset/european-natural-gas-imports` (weekly ZIP) |
| Table | `economic_data.bruegel_gas_flows` |
| Method | Incremental — extract `daily_data*.csv` from ZIP, append new dates |
| Columns | date, norway, algeria, russia, azerbaijan, libya, uk_net_flows, lng, eu_total, nord_stream, ukraine_gas_transit, yamal_by_pl, turkstream |
| URL discovery | Regex scrape of Bruegel page → fallback to ISO week URL patterns |
| Known issue | Cloudflare blocks VPS IP with JS challenge → currently manual |
| Runtime | 10-20 seconds (when not blocked) |

#### 7. Missiles (`missiles.py`)

| Field | Value |
|-------|-------|
| Source | Kaggle dataset `piterfm/massive-missile-attacks-on-ukraine` |
| Table | `aerial_assaults.missile_attacks` |
| Method | TRUNCATE + INSERT (~3,500 rows) |
| Columns | 22 columns: time_start, time_end, model, launch_place, target, launched, destroyed, is_shahed, carrier, affected_region, source, etc. |
| Auth | Kaggle CLI (`~/.kaggle/kaggle.json`) or REST API fallback |
| Runtime | ~15 seconds |

#### 8. HAPI (`hapi.py`)

| Field | Value |
|-------|-------|
| Source | HDX (Humanitarian Data Exchange) direct CSV downloads |
| Tables | 8 tables (see database section above) |
| Method | TRUNCATE + INSERT per dataset |
| Total rows | ~165,000 across all 8 datasets |
| HXL handling | Strips HXL tag row (line 2 starting with `#`) from HDX CSVs |
| Type conversion | INT_COLS, FLOAT_COLS, DATE_COLS sets for automatic casting |
| Isolation | Each dataset independent — one failure doesn't block others |
| Runtime | ~30 seconds |

#### 9. World Bank GDP (`worldbank.py`)

| Field | Value |
|-------|-------|
| Source | `api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD` |
| Table | `economic_data.world_bank_gdp` |
| Method | UPSERT — INSERT ON CONFLICT (country, year) DO UPDATE |
| Columns | country, year, gdp_current_usd, iso3 |
| Countries | 40 ISO3 codes (Kiel/SIPRI donors + Russia + Ukraine) |
| Check logic | Queries MAX(year) in DB, targets `current_year - 1` from API |
| Runtime | ~5 seconds |

#### 10. UNHCR (`unhcr.py`)

| Field | Value |
|-------|-------|
| Source | `api.unhcr.org/population/v1/population/?coo=UKR` |
| Table | `humanitarian.unhcr_population` |
| Method | TRUNCATE + INSERT (only if new year detected) |
| Columns | year, origin_code, asylum_code, origin_name, asylum_name, refugees, asylum_seekers, oip, idps, stateless, others_of_concern, host_community |
| Filter | Country of origin = UKR |
| Pagination | 1,000 per page, iterates until all pages fetched |
| Runtime | ~10 seconds |

### CLI Usage

```bash
# Run all auto-updatable (10 daily + 2 annual, excludes GDELT)
python update_all_datasets.py

# Run specific updaters
python update_all_datasets.py --equipment
python update_all_datasets.py --acled --days 30    # Override lookback
python update_all_datasets.py --hapi
python update_all_datasets.py --missiles
python update_all_datasets.py --crea
python update_all_datasets.py --bruegel
python update_all_datasets.py --worldbank
python update_all_datasets.py --unhcr

# Include GDELT (opt-in)
python update_all_datasets.py --gdelt

# Show all table statuses with staleness
python update_all_datasets.py --status
```

The `--status` command outputs a table like:

```
================================================================================
  DATASET STATUS — war_datasets @ localhost
  2026-03-04 12:00:00
================================================================================

  Table                                               Rows   Last Date  Stale  Auto
  -------------------------------------------------- -------- ------------ ------  ----
  conflict_events.acled_events                         34,521   2026-02-25     7d  YES
  conflict_events.viina_events                         11,234   2025-12-31    63d  YES
  equipment_losses.equipment_daily                      1,467   2026-03-03     1d  YES
  ...
```

---

## 5. Data Export Pipeline

### Script: `export_all_dashboard_data.py` (~2,000 lines)

Queries PostgreSQL and writes 70+ JSON files for the dashboard.

**Environment-variable-driven** for portability between local Docker DB and VPS:

```python
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '5433')),
    'dbname': os.environ.get('DB_NAME', 'russian_ukrainian_war'),
    'user': os.environ.get('DB_USER', 'isw'),
    'password': os.environ.get('DB_PASSWORD', 'isw2026'),
}
OUTPUT_DIR = Path(os.environ.get('EXPORT_OUTPUT_DIR', './dashboard/public/data'))
```

### Export Functions (16 major groups)

| Group | Function(s) | Output Files |
|-------|-------------|--------------|
| Overview | `export_overview_stats()` | `overview_stats.json` |
| Conflict | `export_daily_events()`, `export_events_by_type()`, `export_events_by_region()`, `export_monthly_events()` | 4 files |
| Aerial | `export_daily_aerial_threats()`, `export_weapon_types()` | 2 files |
| Equipment | `export_equipment_daily()`, `export_petroivaniuk_*()`, `export_oryx_*()`, `export_ukrdailyupdate()` | 6 files |
| Personnel | `export_personnel_daily()`, `export_kiu_officers()` | 3 files |
| Casualties | `export_casualties_ohchr()` | 1 file |
| Refugees | `export_refugees_by_country()`, `export_refugee_totals()` | 2 files |
| VIINA | `export_viina_events()`, `export_viina_aggregates()` | 9+ files |
| Bellingcat | `export_bellingcat_*()` | 5 files |
| Territory | `export_territory_data()` | daily_areas.json + GeoJSON dirs |
| HAPI | `export_hapi_data()` | 5 files |
| UCDP | `export_ucdp_by_violence_type()` | 2 files |
| GDELT | `export_gdelt_events()`, `export_gdelt_threats_directional()`, etc. | 10+ files |
| Economic | `export_economic_energy()`, `export_economic_aid()`, `export_economic_military()`, `export_world_bank_gdp()` | 6+ files |
| Sanctions | `export_economic_sanctions()` | 2 files |
| Sabotage | `export_sabotage_cyber()`, `export_sabotage_disinfo()`, `export_sabotage_infrastructure()`, `export_sabotage_hybrid()` | 6+ files |
| ACLED HDX | `export_acled_hdx()` | 4 files |

### Key JSON Files

| File | Size | Content |
|------|------|---------|
| `daily_events.json` | 414 KB | Daily event counts (ACLED + UCDP) |
| `equipment_daily.json` | 401 KB | Ukraine MOD equipment data |
| `daily_aerial_threats.json` | 188 KB | Missile/drone daily summary |
| `kiel_aid_donor_timeline.json` | 197 KB | Month × donor × aid type (45 donors) |
| `sipri_expenditure.json` | 227 KB | 44 countries, 1949-2024, incl GDP share |
| `viina_daily.json` | 57 KB | VIINA daily aggregates |
| `hapi_food_prices.json` | 554 KB | WFP food price monitoring |
| `gdelt_threats_by_direction.json` | 119 KB | Weekly directional threats |
| `daily_areas.json` | 300 KB | Territory by layer type |

### Static CSV-Based Files

These are generated from local CSV files (not DB queries) and copied to the VPS
during initial setup. They're merged with the exported files before build:

- `oryx_equipment_daily.json`, `oryx_by_category.json`
- `ukrdailyupdate_incidents.json`, `ukrdailyupdate_by_type.json`
- `kaggle_missile_daily.json`, `kaggle_missile_weapons.json`
- `kiu_officers_summary.json`
- `petroivaniuk_equipment_daily.json`, `petroivaniuk_personnel_daily.json`

---

## 6. Dashboard Application

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vite 6 + React 18 + TypeScript 5.6 |
| Primary charts | Plotly.js 3.3 (react-plotly.js) — drag-to-zoom |
| Secondary charts | Nivo 0.87 (heatmap, radar), ECharts 6, Recharts 2.13 |
| Maps | Leaflet 1.9 + react-leaflet 4.2 + CARTO dark basemap |
| State | React Context + useReducer |
| Styling | CSS custom properties, dark theme |
| Data | Static JSON files (no backend server needed) |
| Build | ~5 seconds, output to `dist/` |

### Tab Architecture

The dashboard has **8 main tabs**, with 2 tabs having **subtabs**:

```
1. Overview          — Key summary statistics
2. Conflict Events   — 6 subtabs:
   ├── ACLED         — Armed conflict events (event type filter)
   ├── UCDP          — Violence types (state-based, non-state, one-sided)
   ├── VIINA         — Ukrainian conflict events (by category/source/oblast)
   ├── Bellingcat    — Civilian harm incidents (by impact type)
   ├── Comparison    — All 4 datasets overlaid
   └── GDELT Threats — Directional threats, dyadic, CAMEO codes, VARX media
3. Aerial Assaults   — Missile/drone attacks with weapon type breakdown
4. Gains/Losses      — 5 subtabs:
   ├── Human         — Personnel casualties (Ukraine MOD + KIU officers)
   ├── Equipment     — Tanks/APCs/etc (Ukraine MOD, Oryx, UkrDailyUpdate)
   ├── Territory     — Area over time by layer type
   ├── Net Changes   — Daily/weekly/monthly territorial changes
   └── Aid & Exp.    — Kiel aid (donor timeline) + SIPRI expenditure
5. Humanitarian      — HAPI: IDPs, food prices, funding, needs
6. Military Events   — Timeline, heatmap, radar, scatter, decomposition
7. Territory Map     — Interactive Leaflet map with time slider
8. Sources           — Data source documentation
```

### Key TypeScript Interfaces

```typescript
// Types: src/types/index.ts (588 lines)

interface DailyEvent {
  date: string; acled_events: number; acled_fatalities: number;
  ucdp_events: number; ucdp_fatalities: number;
}

interface SipriExpenditure {
  country: string; year: number;
  expenditure_usd: number; gdp_share: number | null;
}

interface KielAidDonorTimeline {
  month: string; donor: string; aid_type_general: string;
  commitments: number; total_eur: number;
}

interface MissileAttack {
  date: string; model: string; launched: number; destroyed: number;
  intercept_rate: number; is_shahed: boolean; carrier: string;
  target: string; affected_region: string;
}

// 50+ more interfaces for all data types...
```

### Data Loading (`src/data/newLoader.ts`)

65+ async loader functions using a `fetchJson<T>()` wrapper with cache-busting:

```typescript
const BUILD_TS = import.meta.env.VITE_BUILD_TS || Date.now();

async function fetchJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${path}?v=${BUILD_TS}`);
  return resp.json();
}

export const loadEquipmentDaily = () => fetchJson<EquipmentDaily[]>('/data/equipment_daily.json');
export const loadSipriExpenditure = () => fetchJson<SipriExpenditure[]>('/data/sipri_expenditure.json');
// ... 63 more loaders
```

### State Management (`src/context/DashboardContext.tsx`)

Redux-like pattern with `useReducer`:

```typescript
interface DashboardState {
  dateRange: [Date, Date];
  fullDateRange: [Date, Date];
  selectedEvents: string[];
  activeTab: TabId;
  showInterpolation: boolean;
  highlightedEvent: string | null;
  isLoading: boolean;
  error: string | null;
}
```

URL hash-based routing (`#conflict-viina`, `#losses-aid`, etc.) for deep linking.

### Aid & Expenditure Subtab (notable complexity)

- Uses `kiel_aid_donor_timeline.json` for full cross-filtering (month × donor × aid_type)
- **45 donors** including aggregated "Europe (All)"
- Donor order: Europe (All) first, United States second, rest alphabetical
- **SIPRI** uses the same Donors filter (no separate sidebar)
- SIPRI always shows Russia + Ukraine as reference lines
- SIPRI expanded to all Kiel donors (~44 countries) with GDP share toggle
- Name mapping: US → "United States of America", South Korea → "Korea, South", Turkiye → "Turkiye"
- Europe vs USA comparison section at bottom

---

## 7. Daily Automation Pipeline

### Cron Schedule (VPS)

| Time (UTC) | Job | Script |
|------------|-----|--------|
| 03:00 | Red Lines Pipeline | `/stratbase/apps/webapps/red-lines-database/run_pipeline.sh` |
| 06:00 | GDELT Events | `/stratbase/apps/webapps/gdelt-updater/update_gdelt.py events` |
| 07:00 | GDELT GKG | `/stratbase/apps/webapps/gdelt-updater/update_gdelt.py gkg` |
| 08:00 Mon | GDELT VARX | `/stratbase/apps/webapps/gdelt-updater/update_gdelt.py varx` |
| 09:00 | Dataset Updater | `/stratbase/apps/webapps/dataset-updater/update_all_datasets.py` |
| 10:00 | Dashboard Pipeline | `/stratbase/apps/webapps/dashboard-pipeline/run_dashboard_pipeline.sh` |

### Dashboard Pipeline Steps (`run_dashboard_pipeline.sh`)

The master pipeline runs 6 steps in sequence:

**Step 1: Run dataset updaters** (incremental)
```bash
$UPDATER_DIR/env/bin/python $UPDATER_DIR/update_all_datasets.py
```

**Step 2: Refresh materialized view**
```sql
REFRESH MATERIALIZED VIEW public.daily_territory_area;
```

**Step 3: Export dashboard JSON**
```bash
DB_HOST=localhost DB_PORT=5432 DB_NAME=war_datasets \
DB_USER=postgres DB_PASSWORD=... EXPORT_OUTPUT_DIR=./data/export \
python export_all_dashboard_data.py
```
Outputs ~74 JSON files to the export directory.

**Step 4: Merge static + exported files**
```bash
cp static_data/*.json merged_data/    # Static CSV-based files first
cp export/*.json merged_data/          # Freshly exported files overwrite
```

**Step 5: Build dashboard**
```bash
cd dashboard && git pull --ff-only
VITE_BUILD_TS=$(date +%s) npx tsc && npx vite build
```

**Step 6: Deploy to GitHub Pages**
```bash
cp -r data/ dist/data/
npx gh-pages -d dist
```

Uses stored GitHub token for authentication.

### Logging

- Pipeline logs: `/stratbase/apps/webapps/dashboard-pipeline/logs/pipeline_YYYYMMDD_HHMMSS.log`
- Dataset updater logs: `/stratbase/apps/webapps/dataset-updater/update_logs/cron.log`
- Retains last 30 pipeline logs, auto-deletes older ones

---

## 8. Deployment & Operations

### VPS Directory Structure

```
/stratbase/apps/webapps/
├── dataset-updater/
│   ├── update_all_datasets.py
│   ├── export_all_dashboard_data.py
│   ├── .env
│   ├── env/ → ../gdelt-updater/env    # Shared venv (symlink)
│   ├── updaters/                       # 12 Python modules
│   └── update_logs/
├── dashboard-pipeline/
│   ├── run_dashboard_pipeline.sh
│   ├── data/
│   │   ├── static/                     # CSV-based JSON files
│   │   ├── export/                     # DB-exported JSON files
│   │   └── merged/                     # Combined for build
│   ├── dashboard/                      # Git clone of war-datasets-dashboard
│   └── logs/
├── gdelt-updater/
│   ├── update_gdelt.py
│   └── env/                            # Python venv (shared)
└── red-lines-database/
    ├── run_pipeline.sh
    └── .gh_token                       # GitHub auth token
```

### Deploying Code Changes

**Dataset updater changes** (from local):
```bash
cd "/mnt/g/My Drive/RuBase/Red lines/VPS/dataset-updater"
bash DEPLOY.sh
```
This copies all Python files to `/stratbase/apps/webapps/dataset-updater/` on the VPS.

**Dashboard source changes**:
```bash
# Push to GitHub main branch
cd /tmp/dashboard-build
git add . && git commit -m "..." && git push origin main

# VPS will auto-pull on next pipeline run (Step 5: git pull --ff-only)
# Or SSH in and manually: cd dashboard && git pull
```

### Manual Operations

```bash
# SSH to VPS
ssh root@138.201.62.161

# Run specific updater
cd /stratbase/apps/webapps/dataset-updater
./env/bin/python update_all_datasets.py --equipment

# Check all table staleness
./env/bin/python update_all_datasets.py --status

# Run entire pipeline manually
/stratbase/apps/webapps/dashboard-pipeline/run_dashboard_pipeline.sh

# Tail pipeline logs
tail -f /stratbase/apps/webapps/dashboard-pipeline/logs/pipeline_*.log
```

---

## 9. Known Issues & Workarounds

### Bruegel Cloudflare Block
**Issue**: Cloudflare blocks VPS IP with JavaScript challenge (403 Forbidden).
**Workaround**: Bruegel data currently requires manual download. The updater has User-Agent
headers and fallback URL patterns, but Cloudflare still blocks it from the VPS.
**Mitigation**: Bruegel updates weekly, so staleness is acceptable for a few days.

### VIINA 2026 ZIP Not Available
**Issue**: The `event_info_latest_2026.zip` file on GitHub may not exist early in the year.
**Workaround**: Graceful 404 handling — the updater logs a warning and continues. Data
from 2025 and earlier is already in the DB.

### ACLED 12-Month Rolling Window
**Issue**: Free/academic ACLED API tier returns only the last 12 months of data.
**Impact**: Historical backfill requires manual CSV import or upgraded API access.
**Workaround**: The updater correctly handles the boundary — it fetches what's available
and uses ON CONFLICT DO NOTHING to avoid duplicates.

### Google Drive Build Limitations
**Issue**: `npm install` fails on Google Drive (no symlink support).
**Workaround**: Always build in `/tmp/dashboard-build/` (local filesystem), then sync
source to Google Drive via tar archive. The `dist/` is deployed directly from VPS.

### GDELT Separate from Default Run
**Issue**: GDELT updates are heavy and have their own cron schedule (06:00-08:00 UTC).
**Design**: Excluded from default `update_all_datasets.py` run. Use `--gdelt` flag to
include, or rely on the separate cron jobs.

---

## Appendix: Complete JSON Data File Manifest

All files served from `/data/` on the live dashboard:

### Conflict Events
- `daily_events.json` — ACLED + UCDP daily counts/fatalities
- `events_by_type.json` — Event type breakdown
- `events_by_region.json` — Region breakdown
- `monthly_events.json` — Monthly aggregates
- `ucdp_by_violence_type.json` — UCDP violence type counts
- `ucdp_monthly_by_type.json` — UCDP monthly by violence type

### VIINA
- `viina_daily.json`, `viina_monthly.json`, `viina_weekly.json`
- `viina_by_source.json`, `viina_by_oblast.json`, `viina_by_event_type.json`
- `viina_monthly_by_source.json`, `viina_daily_by_source.json`
- `viina_monthly_by_event_type.json`

### Bellingcat
- `bellingcat_daily.json`, `bellingcat_monthly.json`
- `bellingcat_incidents.json` (with lat/lon)
- `bellingcat_by_impact.json`, `bellingcat_monthly_by_impact.json`

### Aerial Assaults
- `daily_aerial_threats.json`
- `weapon_types_summary.json`
- `kaggle_missile_daily.json`, `kaggle_missile_weapons.json`

### Equipment & Personnel
- `equipment_daily.json` — Ukraine MOD
- `personnel_daily.json` — Ukraine MOD
- `oryx_equipment_daily.json`, `oryx_by_category.json` — Oryx database
- `ukrdailyupdate_incidents.json`, `ukrdailyupdate_by_type.json`
- `petroivaniuk_equipment_daily.json`, `petroivaniuk_personnel_daily.json`
- `kiu_officers_summary.json` — KIU killed officers

### Territory
- `daily_areas.json` — Area by layer type over time
- `territory_geojson/` — GeoJSON files by date
- `kursk_geojson/` — Kursk-specific map data

### Humanitarian
- `casualties_ohchr.json` — OHCHR civilian casualties
- `hapi_idps.json`, `hapi_idps_total.json`
- `hapi_food_prices.json`, `hapi_funding.json`
- `hapi_humanitarian_needs.json`
- `refugees_by_country.json`, `refugee_totals.json`

### Economic & Aid
- `kiel_aid_by_donor.json` — 45 donors, aid type breakdown
- `kiel_aid_timeline.json` — Monthly timeline
- `kiel_aid_donor_timeline.json` — Month × donor × aid type cross-filter
- `sipri_expenditure.json` — 44 countries, 1949-2024, with GDP share
- `world_bank_gdp.json` — 40 countries GDP
- `energy_fossil_revenue.json` — CREA Russia fossil revenue
- `energy_gas_flows.json` — Bruegel European gas flows

### Sanctions
- `sanctions_eu_timeline.json`, `sanctions_eu_summary.json`

### GDELT
- `gdelt_events_daily.json`, `gdelt_events_monthly.json`
- `gdelt_coercive_daily.json`, `gdelt_coercive_monthly.json`
- `gdelt_redlines_daily.json`, `gdelt_redlines_monthly.json`
- `gdelt_threats_by_direction.json`, `gdelt_threats_by_country.json`
- `gdelt_threats_by_cameo.json`, `gdelt_threats_dyadic.json`
- `gdelt_varx_weekly.json`

### Sabotage & Hybrid
- `cyber_incidents_timeline.json`, `cyber_incidents_by_country.json`
- `disinfo_monthly.json`, `disinfo_by_language.json`
- `baltic_cable_incidents.json`
- `leiden_hybrid_events.json`

### ACLED HDX
- `acled_hdx_monthly.json`, `acled_hdx_by_region.json`
- `acled_hdx_by_event_type.json`, `acled_hdx_by_disorder_type.json`
