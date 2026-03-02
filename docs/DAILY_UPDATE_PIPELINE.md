# Daily Incremental Data Update Pipeline

Automated daily pipeline that detects new data in the PostgreSQL database, selectively re-exports only changed datasets, rebuilds the dashboard, and deploys to GitHub Pages — all via GitHub Actions.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
  - [1. Change Detection](#1-change-detection)
  - [2. Selective Export](#2-selective-export)
  - [3. Build & Deploy](#3-build--deploy)
- [Tracked Datasets](#tracked-datasets)
- [Export Function Mapping](#export-function-mapping)
- [File Reference](#file-reference)
- [GitHub Actions Workflow](#github-actions-workflow)
- [GitHub Secrets](#github-secrets)
- [Metadata File](#metadata-file)
- [Workflow Behavior](#workflow-behavior)
  - [No Changes (Fast Exit)](#no-changes-fast-exit)
  - [Changes Detected (Full Pipeline)](#changes-detected-full-pipeline)
- [Manual Operations](#manual-operations)
  - [Trigger a Run Manually](#trigger-a-run-manually)
  - [Check Run Status](#check-run-status)
  - [View Logs](#view-logs)
  - [Force a Full Re-export](#force-a-full-re-export)
  - [Run Locally](#run-locally)
- [Troubleshooting](#troubleshooting)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     GitHub Actions (daily 6 AM UTC)              │
│                                                                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │  check_new_data  │───▶│  export_changed   │───▶│   vite     │  │
│  │     .py          │    │     .py           │    │   build    │  │
│  │                  │    │                   │    │            │  │
│  │ Queries 18 tables│    │ Runs only changed │    │ npm ci &&  │  │
│  │ MAX(date)+COUNT  │    │ export functions   │    │ npm run    │  │
│  │ vs _export_meta  │    │ from export_all   │    │ build      │  │
│  └────────┬─────────┘    └──────────────────┘    └─────┬──────┘  │
│           │                                            │         │
│     No changes?                                   Deploy dist/   │
│     Exit early (21s)                              to gh-pages     │
└──────────────────────────────────────────────────────────────────┘
                │                                        │
                ▼                                        ▼
    ┌───────────────────┐                  ┌─────────────────────┐
    │  PostgreSQL DB     │                  │  GitHub Pages       │
    │  138.201.62.161    │                  │  sdspieg.github.io/ │
    │  war_datasets      │                  │  war-datasets-      │
    │  12 schemas        │                  │  dashboard          │
    │  18 tracked tables │                  └─────────────────────┘
    └───────────────────┘
```

---

## How It Works

### 1. Change Detection

**Script:** `scripts/check_new_data.py`

The check script connects to the remote PostgreSQL database and queries each of the 18 tracked tables for:
- `MAX(date_column)` — the latest date in the dataset
- `COUNT(*)` — the total number of rows

It then compares these values against the stored metadata in `public/data/_export_meta.json`. If **either** the max date or the row count differs for **any** dataset, the script reports which datasets changed.

**Exit codes:**
| Code | Meaning | Workflow Effect |
|------|---------|-----------------|
| `0` | Changes detected | Proceeds to export, build, deploy |
| `1` | No changes | Skips everything (fast exit in ~21 seconds) |

The script writes the list of changed dataset keys to the `GITHUB_OUTPUT` file so subsequent workflow steps can access them.

### 2. Selective Export

**Script:** `scripts/export_changed.py`

Reads the `CHANGED_KEYS` environment variable (comma-separated dataset keys like `missiles,equipment,gdelt_events`) and maps each key to the specific export functions that need to run. This avoids re-exporting all 80+ JSON files when only one dataset changed.

The script imports individual export functions from `scripts/export_all_dashboard_data.py` and calls only those that are relevant to the changed datasets. It **always** re-exports `overview_stats.json` whenever any dataset changes, since that file aggregates counts from all datasets.

### 3. Build & Deploy

After the selective export writes fresh JSON files into `public/data/`:
1. **`npm ci && npm run build`** — Vite builds the React app, copying `public/data/*.json` into the `dist/` output
2. **`_export_meta.json` is committed** back to main so the next run has the updated baseline
3. **`dist/` is deployed** to the `gh-pages` branch via `peaceiris/actions-gh-pages`

The live site at `https://sdspieg.github.io/war-datasets-dashboard/` then serves the updated data.

---

## Tracked Datasets

The pipeline monitors 18 database tables across 7 schemas:

| Key | Schema.Table | Date Column | What It Tracks |
|-----|-------------|-------------|----------------|
| `acled` | `conflict_events.acled_events` | `event_date` | ACLED armed conflict events (224K) |
| `ucdp` | `conflict_events.ucdp_events` | `date_start` | UCDP georeferenced event data (31K) |
| `viina` | `conflict_events.viina_events` | `date` (int YYYYMMDD) | ML-classified news events from 16 outlets (557K) |
| `bellingcat` | `conflict_events.bellingcat_harm` | `date` | OSINT-verified civilian harm incidents (2.5K) |
| `missiles` | `aerial_assaults.missile_attacks` | `time_start` | Missile and drone strikes with intercept data (3.4K) |
| `equipment` | `equipment_losses.equipment_daily` | `date` | Daily Russian equipment losses (1.5K) |
| `personnel` | `equipment_losses.personnel_daily` | `date` | Daily Russian personnel losses (1.5K) |
| `ohchr` | `casualties.ohchr_casualties` | *(count only)* | UN-verified civilian casualties (71) |
| `gdelt_events` | `global_events.gdelt_events` | `sqldate` (int) | Russia-sourced THREATEN events (293K) |
| `gdelt_coercive` | `global_events.gdelt_gkg_coercive_quotations` | `date` (bigint) | Coercive discourse quotations (360K) |
| `gdelt_redlines` | `global_events.gdelt_gkg_redline_quotations` | `date` (bigint) | Red line discourse quotations (8.8K) |
| `gas_flows` | `economic_data.bruegel_gas_flows` | `date` | EU gas pipeline flows (1.9K) |
| `fossil_revenue` | `economic_data.crea_russia_fossil` | `date` | Russia fossil fuel revenue (11.5K) |
| `sanctions` | `economic_data.opensanctions_eu` | *(count only)* | EU sanctions entities (70.5K) |
| `cyber` | `western_sabotage.eurepoc_cyber_incidents` | *(count only)* | State-sponsored cyber incidents (3.4K) |
| `disinfo` | `western_sabotage.euvsdisinfo_disinfo_cases` | *(count only)* | Disinformation cases (14.5K) |
| `baltic` | `western_sabotage.baltic_cable_incidents` | *(count only)* | Undersea cable sabotage events (7) |
| `leiden` | `western_sabotage.leiden_events` | *(count only)* | Hybrid threat events (153) |

Datasets marked *(count only)* have no reliable date column, so change detection relies solely on row count changes.

---

## Export Function Mapping

When a dataset key is detected as changed, these export functions run:

| Changed Key | Export Functions | Output Files |
|-------------|-----------------|--------------|
| `acled` | `export_daily_events`, `export_events_by_type`, `export_events_by_region`, `export_monthly_events`, `export_acled_hdx` | `daily_events.json`, `events_by_type.json`, `events_by_region.json`, `monthly_events.json`, `acled_hdx_monthly.json`, `acled_hdx_by_region.json` |
| `ucdp` | `export_daily_events`, `export_ucdp_by_violence_type` | `daily_events.json`, `ucdp_by_violence_type.json`, `ucdp_monthly_by_type.json` |
| `viina` | `export_viina_events`, `export_viina_aggregates`, `export_viina_by_event_type` | `viina_events_*.json`, `viina_daily.json`, `viina_weekly.json`, `viina_monthly.json`, `viina_by_source.json`, `viina_by_oblast.json`, `viina_*_by_source.json`, `viina_by_event_type.json`, `viina_monthly_by_event_type.json` |
| `bellingcat` | `export_bellingcat_incidents`, `export_bellingcat_by_impact` | `bellingcat_incidents.json`, `bellingcat_daily.json`, `bellingcat_monthly.json`, `bellingcat_by_impact.json`, `bellingcat_monthly_by_impact.json` |
| `missiles` | `export_daily_aerial_threats`, `export_weapon_types` | `daily_aerial_threats.json`, `weapon_types_summary.json` |
| `equipment` | `export_equipment_daily` | `equipment_daily.json` |
| `personnel` | `export_personnel_daily` | `personnel_daily.json` |
| `ohchr` | `export_casualties_ohchr` | `casualties_ohchr.json` |
| `gdelt_events` | `export_gdelt_events`, `export_gdelt_varx` | `gdelt_events_daily.json`, `gdelt_events_monthly.json`, `gdelt_events_by_target.json`, `gdelt_goldstein.json`, `gdelt_varx_weekly.json` |
| `gdelt_coercive` | `export_gdelt_coercive`, `export_gdelt_varx` | `gdelt_coercive_daily.json`, `gdelt_coercive_monthly.json`, `gdelt_coercive_sources.json`, `gdelt_varx_weekly.json` |
| `gdelt_redlines` | `export_gdelt_redlines`, `export_gdelt_varx` | `gdelt_redlines_monthly.json`, `gdelt_redlines_sources.json`, `gdelt_varx_weekly.json` |
| `gas_flows` | `export_economic_energy` | `energy_gas_flows.json`, `energy_fossil_revenue.json` |
| `fossil_revenue` | `export_economic_energy` | `energy_gas_flows.json`, `energy_fossil_revenue.json` |
| `sanctions` | `export_economic_sanctions` | `sanctions_eu_summary.json`, `sanctions_eu_timeline.json` |
| `cyber` | `export_sabotage_cyber` | `cyber_incidents_timeline.json`, `cyber_incidents_by_country.json` |
| `disinfo` | `export_sabotage_disinfo` | `disinfo_monthly.json`, `disinfo_by_language.json` |
| `baltic` | `export_sabotage_infrastructure` | `baltic_cable_incidents.json` |
| `leiden` | `export_sabotage_hybrid` | `leiden_hybrid_events.json` |

**Always runs when any change is detected:** `export_overview_stats` → `overview_stats.json`

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/export_all_dashboard_data.py` | Core export library — 33 export functions that query PostgreSQL and write JSON files. DB connection configured via environment variables. |
| `scripts/check_new_data.py` | Change detection — queries 18 tables for `MAX(date)` + `COUNT(*)`, compares with stored metadata, outputs changed keys. |
| `scripts/export_changed.py` | Selective export wrapper — maps changed dataset keys to specific export functions, only runs what's needed. |
| `.github/workflows/daily-update.yml` | GitHub Actions workflow definition — schedule, steps, secrets, conditional logic. |
| `public/data/_export_meta.json` | Metadata baseline — stores last-known `max_date` and `count` for each tracked dataset. Updated after each successful check. |

---

## GitHub Actions Workflow

**File:** `.github/workflows/daily-update.yml`

**Schedule:** Daily at 6:00 AM UTC

**Trigger options:**
- Automatic via cron schedule
- Manual via GitHub UI (Actions tab → "Daily Data Update" → "Run workflow")
- Manual via CLI: `gh workflow run daily-update.yml`

**Steps:**

| Step | Condition | What It Does | Duration |
|------|-----------|-------------|----------|
| Checkout | Always | Checks out `main` branch | ~3s |
| Setup Python 3.11 | Always | Installs Python runtime | ~5s |
| Setup Node 20 | Always | Installs Node.js runtime | ~3s |
| Install dependencies | Always | `pip install psycopg2-binary` | ~3s |
| Check for new data | Always | Runs `check_new_data.py`, exit 0 = changes, exit 1 = no changes | ~5-10s |
| Export changed datasets | Only if changes | Runs `export_changed.py` with changed keys | ~30-120s |
| Build dashboard | Only if changes | `npm ci && npm run build` | ~30-60s |
| Commit metadata | Only if changes | Commits `_export_meta.json` to main | ~5s |
| Deploy to gh-pages | Only if changes | Pushes `dist/` to gh-pages branch | ~10s |

**Total time:** ~21 seconds (no changes) or ~2-4 minutes (with changes)

---

## GitHub Secrets

The following encrypted secrets must be set in the repository settings (Settings → Secrets and variables → Actions):

| Secret | Value | Description |
|--------|-------|-------------|
| `DB_HOST` | `138.201.62.161` | Hetzner VPS IP address |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `war_datasets` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | *(encrypted)* | Database password |

Set via CLI:
```bash
gh secret set DB_HOST --body "138.201.62.161"
gh secret set DB_PORT --body "5432"
gh secret set DB_NAME --body "war_datasets"
gh secret set DB_USER --body "postgres"
gh secret set DB_PASSWORD --body "<password>"
```

`GITHUB_TOKEN` is automatically provided by GitHub Actions and does not need to be set manually.

---

## Metadata File

**File:** `public/data/_export_meta.json`

This file is the "memory" of the pipeline — it stores the last-known state of each dataset so the next run can detect what changed.

**Structure:**
```json
{
  "acled": {
    "count": 224197,
    "max_date": "2025-03-01T00:00:00"
  },
  "missiles": {
    "count": 3442,
    "max_date": "2026-02-22"
  },
  "ohchr": {
    "count": 71
  }
}
```

- Datasets with a date column have both `count` and `max_date`
- Count-only datasets (like `ohchr`, `sanctions`, `cyber`) just have `count`
- The file is committed to `main` after each successful check, whether or not changes were found
- If this file is deleted, the next run will detect ALL datasets as changed and do a full re-export

---

## Workflow Behavior

### No Changes (Fast Exit)

```
6:00 AM UTC — Cron triggers workflow
  ├── Checkout, setup Python/Node, install deps (~15s)
  ├── check_new_data.py queries 18 tables
  │   └── All counts and max_dates match _export_meta.json
  │   └── Exit code 1 (no changes)
  ├── Export — SKIPPED
  ├── Build — SKIPPED
  ├── Commit — SKIPPED
  └── Deploy — SKIPPED
Total: ~21 seconds
```

### Changes Detected (Full Pipeline)

```
6:00 AM UTC — Cron triggers workflow
  ├── Checkout, setup Python/Node, install deps (~15s)
  ├── check_new_data.py queries 18 tables
  │   └── missiles: count 3442 -> 3450, max_date 2026-02-22 -> 2026-03-01
  │   └── equipment: count 1464 -> 1471, max_date 2026-02-27 -> 2026-03-01
  │   └── Exit code 0 (changes found)
  │   └── CHANGED_KEYS=missiles,equipment
  ├── export_changed.py
  │   ├── export_overview_stats() → overview_stats.json
  │   ├── export_daily_aerial_threats() → daily_aerial_threats.json
  │   ├── export_weapon_types() → weapon_types_summary.json
  │   └── export_equipment_daily() → equipment_daily.json
  ├── npm ci && npm run build → dist/
  ├── git commit _export_meta.json → main
  └── Deploy dist/ → gh-pages
Total: ~2-4 minutes
Live site updated with new missile and equipment data
```

---

## Manual Operations

### Trigger a Run Manually

```bash
gh workflow run daily-update.yml
```

Or via the GitHub UI: Actions tab → "Daily Data Update" → "Run workflow" button.

### Check Run Status

```bash
# List recent runs
gh run list --workflow=daily-update.yml --limit 5

# View specific run details
gh run view <run-id>

# View specific job details
gh run view --job=<job-id>
```

### View Logs

```bash
# Full logs for a job
gh run view --log --job=<job-id>

# Or view in browser
gh run view <run-id> --web
```

### Force a Full Re-export

Delete the metadata file to make the next run think everything has changed:

```bash
# Remove metadata, commit, push
rm public/data/_export_meta.json
git add -u public/data/_export_meta.json
git commit -m "chore: reset export metadata for full re-export"
git push origin main

# Trigger the workflow
gh workflow run daily-update.yml
```

Alternatively, edit `_export_meta.json` to set specific dataset counts to `0`:

```json
{
  "missiles": {"count": 0, "max_date": "2020-01-01"},
  "equipment": {"count": 0, "max_date": "2020-01-01"}
}
```

### Run Locally

The scripts work locally too, using environment variables to override defaults:

```bash
# Check for changes against remote DB
DB_HOST=138.201.62.161 DB_PORT=5432 DB_NAME=war_datasets \
DB_USER=postgres DB_PASSWORD=<password> OUTPUT_DIR=public/data \
python scripts/check_new_data.py

# Export specific changed datasets
CHANGED_KEYS=missiles,equipment \
DB_HOST=138.201.62.161 DB_PORT=5432 DB_NAME=war_datasets \
DB_USER=postgres DB_PASSWORD=<password> OUTPUT_DIR=public/data \
python scripts/export_changed.py

# Or pass changed keys as CLI argument
python scripts/export_changed.py "missiles,equipment"

# Full export (all datasets, ignores change detection)
DB_HOST=138.201.62.161 DB_PORT=5432 DB_NAME=war_datasets \
DB_USER=postgres DB_PASSWORD=<password> OUTPUT_DIR=public/data \
python scripts/export_all_dashboard_data.py
```

The default values in the scripts point to the local Docker database (`localhost:5433`, `russian_ukrainian_war`, `isw/isw2026`), so running without env vars uses the local DB.

---

## Troubleshooting

### Workflow shows "No changes detected" but data was added

- Check that the new data was inserted into one of the 18 tracked tables (see [Tracked Datasets](#tracked-datasets))
- Verify the `_export_meta.json` in the repo matches the state *before* the new data was added
- Some tables are count-only (no date column) — if you replaced rows without changing the total count, no change will be detected

### Database connection fails

- Verify the GitHub secrets are set correctly: `gh secret list`
- Check if the Hetzner VPS firewall allows connections from GitHub Actions IP ranges
- Test connectivity: `PGPASSWORD=<pw> psql -h 138.201.62.161 -p 5432 -U postgres -d war_datasets -c "SELECT 1"`

### Export succeeds but site doesn't update

- Check if the deploy step ran (look for "Deploy to gh-pages" in the job log)
- Verify the gh-pages branch was updated: `git log origin/gh-pages --oneline -3`
- GitHub Pages can take 1-2 minutes to propagate after a deploy
- Clear browser cache or check in an incognito window

### Build fails

- Check if `npm ci` succeeded (common issue: `package-lock.json` out of sync with `package.json`)
- Check TypeScript errors: the build runs `tsc && vite build`
- Exported JSON files might have unexpected structure if DB schema changed

### A specific export function fails

- The `export_changed.py` script catches errors per-function and continues with the rest
- Check the workflow log for `ERROR in <function_name>: <message>`
- The failed function's output files won't be updated, but other datasets will still export

---

## Environment Variables

| Variable | Default (local) | GitHub Actions | Description |
|----------|----------------|----------------|-------------|
| `DB_HOST` | `localhost` | From secret | Database host |
| `DB_PORT` | `5433` | From secret | Database port |
| `DB_NAME` | `russian_ukrainian_war` | From secret | Database name |
| `DB_USER` | `isw` | From secret | Database user |
| `DB_PASSWORD` | `isw2026` | From secret | Database password |
| `OUTPUT_DIR` | `<script_dir>/../public/data` | `public/data` | Where JSON files are written |
| `CHANGED_KEYS` | *(none)* | Set by check step | Comma-separated changed dataset keys |
| `GITHUB_OUTPUT` | *(none)* | Set by Actions | File path for writing step outputs |
