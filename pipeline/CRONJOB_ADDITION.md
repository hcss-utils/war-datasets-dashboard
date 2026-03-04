# Unified Dataset Updater Cron

> **Add this section to CRONJOB.md after the existing GDELT cron entries.**

---

## Component 2 — Unified Dataset Updater (DB ingestion for non-GDELT datasets)

**Deployed:** 2026-03-02
**Location:** `/stratbase/apps/webapps/dataset-updater/` on VPS `138.201.62.161`
**Script:** `update_all_datasets.py`
**Venv:** Shared with GDELT updater (`../gdelt-updater/env`)

### Cron Schedule

```cron
# All non-GDELT datasets: daily at 09:00 UTC (after GDELT finishes at 06-08)
0 9 * * * /stratbase/apps/webapps/dataset-updater/env/bin/python /stratbase/apps/webapps/dataset-updater/update_all_datasets.py >> /stratbase/apps/webapps/dataset-updater/update_logs/cron.log 2>&1
```

### Datasets Updated

| Dataset | Table | Method | Typical Runtime |
|---------|-------|--------|-----------------|
| Equipment losses | `equipment_losses.equipment_daily` | TRUNCATE + INSERT from GitHub JSON | ~5s |
| Personnel losses | `equipment_losses.personnel_daily` | TRUNCATE + INSERT from GitHub JSON | ~2s |
| OpenSanctions EU | `economic_data.opensanctions_eu` | TRUNCATE + INSERT from CSV download | ~15s |
| ACLED events | `conflict_events.acled_events` | Incremental ON CONFLICT from OAuth API | ~30-120s |
| VIINA events | `conflict_events.viina_events` | DELETE year + INSERT from GitHub ZIP | ~20s |

### Manual Commands

```bash
cd /stratbase/apps/webapps/dataset-updater

# Run all auto-updatable datasets
./env/bin/python update_all_datasets.py

# Run individual datasets
./env/bin/python update_all_datasets.py --equipment
./env/bin/python update_all_datasets.py --opensanctions
./env/bin/python update_all_datasets.py --acled
./env/bin/python update_all_datasets.py --viina

# Check staleness of ALL 18 dashboard tables
./env/bin/python update_all_datasets.py --status

# Override ACLED lookback period
./env/bin/python update_all_datasets.py --acled --days 30

# Include GDELT (opt-in, normally handled by its own crons)
./env/bin/python update_all_datasets.py --gdelt
```

### Logs

- Cron output: `/stratbase/apps/webapps/dataset-updater/update_logs/cron.log`
- Each updater failure is independent — one failing does NOT block others

### Architecture

```
                    ┌──────────────────────────────┐
                    │  update_all_datasets.py       │
                    │  (orchestrator)                │
                    └──┬───┬───┬───┬───┬───────────┘
                       │   │   │   │   │
              ┌────────┘   │   │   │   └────────┐
              ▼            ▼   ▼   ▼            ▼
         equipment    opensanctions acled  viina    gdelt
         (GitHub      (CSV download) (OAuth (GitHub  (subprocess
          JSON)                      API)   ZIP)     wrapper)
              │            │   │   │            │
              └────────────┴───┴───┴────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  PostgreSQL         │
                    │  war_datasets DB    │
                    │  138.201.62.161     │
                    └────────────────────┘
```
