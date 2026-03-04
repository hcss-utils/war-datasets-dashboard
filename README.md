# Ukraine Territorial Control & Military Events Dashboard

Interactive React dashboard visualizing Russian-controlled territory in Ukraine, military events, and Kursk region dynamics from ISW (Institute for the Study of War) assessment data stored in PostGIS.

## Repository & Deployment

| Location | Path / URL |
|----------|------------|
| **GitHub** | https://github.com/sdspieg/war-datasets-dashboard.git |
| **Live Site** | https://sdspieg.github.io/war-datasets-dashboard/ |
| **Working Dir** | `/tmp/dashboard-build` (for builds) |
| **Backup** | `C:\Apps\dashboard-build` (local hard drive) |
| **Google Drive** | `G:\My Drive\RuBase\Red lines\Datasets\dashboard` |

### Git Branches

| Branch | Contents |
|--------|----------|
| `main` | Source code (Plotly version with all features) |
| `gh-pages` | Built `dist/` folder (auto-deployed to GitHub Pages) |

### Google Drive Limitations & Workarounds

Google Drive (mounted via rclone/FUSE) has several limitations:

| Operation | Works? | Notes |
|-----------|--------|-------|
| `npm install` | **NO** | Symlinks not supported |
| `cp -r` (many small files) | **SLOW** | Thousands of files = hours |
| `rsync` | **NO** | Temp files fail with "Operation not permitted" |
| `tar` copy + extract | **YES** | Single file transfer, then extract |
| `git clone` | **NO** | Use worktree pattern instead |
| File timestamps | **NO** | "Cannot utime" warnings (harmless) |

**Recommended workflow:**

```bash
# 1. Work in /tmp or C:\Apps (fast local storage)
cd /tmp/dashboard-build
npm install
npm run build

# 2. Sync to Google Drive using tar (excludes node_modules)
tar --exclude='node_modules' --exclude='.git' -cvf /tmp/dashboard.tar .
cp /tmp/dashboard.tar "/mnt/g/My Drive/RuBase/Red lines/Datasets/"
cd "/mnt/g/My Drive/RuBase/Red lines/Datasets/" && tar -xvf dashboard.tar -C dashboard/

# 3. If you need node_modules on Google Drive (slow but works)
cp -r /tmp/dashboard-build/node_modules "/mnt/g/.../dashboard/"  # Takes 30+ min
```

**Note:** The `.cache/gh-pages/` folder inside node_modules is just deployment cache - not needed. All actual data is in `public/data/`.

## Architecture

```
dashboard/
├── public/data/                ← Static JSON/GeoJSON exported from PostGIS
│   ├── daily_areas.json        ← 3,601 daily area records
│   ├── events.json             ← 39 scored military events
│   ├── metadata.json           ← Date range, layer types, export stats
│   ├── territory_geojson/      ← 39 GeoJSON files (ukraine_control_map change points)
│   └── kursk_geojson/          ← 37 GeoJSON files (kursk_russian_advances change points)
├── src/
│   ├── App.tsx                 ← Root component: data loading, error boundaries, tab routing
│   ├── main.tsx                ← React entry point
│   ├── types/index.ts          ← TypeScript interfaces (DailyArea, MilitaryEvent, DashboardState)
│   ├── data/
│   │   ├── loader.ts           ← Fetch functions for JSON/GeoJSON files
│   │   └── processing.ts       ← Interpolation, rolling median, monthly aggregation, trend
│   ├── context/
│   │   └── DashboardContext.tsx ← Global state via useReducer (date range, events, tab, etc.)
│   ├── components/
│   │   ├── Layout.tsx          ← CSS Grid layout: sidebar + header + main content
│   │   ├── Sidebar.tsx         ← Date range slider, summary stats, interpolation toggle, event filter
│   │   ├── TabNavigation.tsx   ← Territory | Events | Map tabs
│   │   ├── DateRangeSlider.tsx ← Dual-handle date range selector
│   │   ├── EventFilter.tsx     ← Grouped checkboxes by importance tier
│   │   ├── charts/
│   │   │   ├── TerritoryControlChart.tsx   ← Area chart: total Russian-controlled km²
│   │   │   ├── MonthlyChangesChart.tsx     ← Bar chart: monthly net change (red/blue)
│   │   │   ├── RateOfChangeChart.tsx       ← Dual-panel: territory + 30-day velocity
│   │   │   ├── KurskChart.tsx              ← Kursk recapture with phase annotations
│   │   │   ├── EventTimelineChart.tsx      ← Scatter: date × importance, size = territorial
│   │   │   ├── EventHeatmap.tsx            ← Nivo heatmap: T/S/C per event
│   │   │   ├── EventRadarChart.tsx         ← Nivo radar: top-N event profiles
│   │   │   ├── EventScatterChart.tsx       ← Bubble: strategic × territorial, size = cascade
│   │   │   ├── MetricDecomposition.tsx     ← Stacked horizontal bar: T/S/C decomposition
│   │   │   └── shared/
│   │   │       ├── EventOverlay.tsx        ← Vertical dashed reference lines for events
│   │   │       ├── ChartTooltip.tsx        ← Styled tooltip with nearby event details
│   │   │       └── ChartLegend.tsx         ← Consistent legend component
│   │   └── map/
│   │       ├── TerritoryMap.tsx            ← React-Leaflet + GeoJSON overlay
│   │       ├── TimeSlider.tsx              ← Play/pause animation with speed controls
│   │       └── MapLegend.tsx               ← Map legend overlay
│   └── styles/
│       ├── variables.css       ← CSS custom properties (dark theme palette)
│       └── components.css      ← Full component styles, responsive breakpoints
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack

| Layer        | Technology                                      |
|--------------|--------------------------------------------------|
| Framework    | Vite + React 18 + TypeScript                    |
| Charts       | **Plotly.js** (drag-to-zoom) + Nivo (heatmap, radar) |
| Map          | React-Leaflet + Leaflet + CARTO dark basemap    |
| State        | React Context + useReducer                       |
| Styling      | CSS custom properties, dark theme                |
| Data         | Static JSON/GeoJSON (no backend server needed)   |

> **Note:** Originally built with Recharts, migrated to Plotly.js on 2026-01-31 for native drag-to-zoom functionality.

## Automated Daily Updates

Data is updated automatically via a **GitHub Actions** workflow that runs daily at 6 AM UTC:

1. **Detects changes** — queries 18 DB tables for `MAX(date)` + `COUNT(*)`, compares with stored metadata
2. **Selectively exports** — only re-exports JSON files for datasets that changed
3. **Builds & deploys** — runs `npm run build` and pushes `dist/` to gh-pages

If no data changed, the workflow exits early in ~21 seconds (no build, no deploy).

Full documentation: [`docs/DAILY_UPDATE_PIPELINE.md`](docs/DAILY_UPDATE_PIPELINE.md) (also at `G:\My Drive\RuBase\Red lines\Datasets\DAILY_UPDATE_PIPELINE.md`)

### Manual trigger

```bash
gh workflow run daily-update.yml
gh run list --workflow=daily-update.yml --limit 3
```

### Manual data export (local)

```bash
# Full export against remote DB
DB_HOST=138.201.62.161 DB_PORT=5432 DB_NAME=war_datasets \
DB_USER=postgres DB_PASSWORD=<password> OUTPUT_DIR=public/data \
python scripts/export_all_dashboard_data.py

# Selective export (only specific datasets)
CHANGED_KEYS=missiles,equipment python scripts/export_changed.py
```

## Prerequisites

- **Node.js** >= 18
- **Python 3** with `psycopg2` (for data export only)
- **PostgreSQL database** — remote at `138.201.62.161:5432` (`war_datasets`) or local Docker at `localhost:5433` (`russian_ukrainian_war`)

## Local Development

```bash
cd /mnt/c/Apps/dashboard-build  # or /tmp/dashboard-build
npm install
npm run dev
```

## Build for Production

```bash
npm run build
# Output: dist/ folder (fully self-contained static site)
```

## Deployment

The live site is deployed via **GitHub Pages** from the `gh-pages` branch. Deployments happen automatically via the daily update workflow, or can be triggered manually.

For ad-hoc deployment alternatives (Cloudflare tunnel, Netlify, Vercel), see the [TECH_STACK.md](TECH_STACK.md).

## Dashboard Features

### Territory Tab (4 charts)
- **Russian-Controlled Territory** — Area chart with interpolated data, linear trend line, event overlay markers
- **Monthly Territorial Changes** — Bar chart with red (Russian gains) / blue (Ukrainian gains), average line, stats overlay
- **Rate of Territorial Change** — Dual-panel: territory area + 30-day rolling velocity (km²/month)
- **Kursk Region** — Russian recapture progress with 5 phase annotations

### Events Tab (5 charts)
- **Event Importance Timeline** — Scatter plot: date × importance, bubble size = territorial impact, opacity = confidence
- **Event Metric Heatmap** — Nivo heatmap: Territorial/Strategic/Cascade scores per event
- **Event Radar Profiles** — Nivo radar: top-N events overlaid on T/S/C axes
- **Strategic vs Territorial** — Bubble scatter: strategic × territorial, size = cascade, color = importance
- **Metric Decomposition** — Stacked horizontal bars: T/S/C breakdown per event, sorted by importance

### Map Tab
- **Interactive Leaflet map** centered on eastern Ukraine (48.5°N, 37.5°E)
- **CARTO dark basemap** with semi-transparent red GeoJSON polygons
- **Time slider** with play/pause, speed controls (1 day/s, 1 week/s, 1 month/s)
- **Legend** showing current date and loading state

### Cross-chart Interactions
- **Date range filtering** — Sidebar sliders filter all charts simultaneously
- **Event selection** — Checkbox groups (Critical I>=8, Significant I>=6, Other) toggle event overlays
- **Interpolation toggle** — Switch between raw step-function and interpolated data
- **Event highlighting** — Click an event on any chart to highlight it (via shared context)
- **URL hash sync** — Active tab encoded in URL hash for shareable links
- **Error boundaries** — Each chart wrapped in React error boundary with retry button

## Database Schema Reference

| Table/View           | Purpose                                              |
|----------------------|------------------------------------------------------|
| `clean_daily_areas`  | View: daily area totals per layer_type per conflict  |
| `shapefile_metadata` | Source shapefile metadata (date, type, conflict)     |
| `control_polygons`   | Polygon geometries with metadata_id foreign key      |

### Ukraine layer types
`ukraine_control_map`, `russian_advances`, `kursk_russian_advances`, `partisan_warfare`, `russian_claimed`, `russian_infiltration`, `ukraine_other`, `ukrainian_counteroffensives`

## Military Events (39 total)

Events are scored on three axes (0–4 each):
- **T (Territorial)** — Direct territorial impact
- **S (Strategic)** — Strategic significance
- **C (Cascade)** — Cascading/downstream effects

**Importance** = sum-based score (1–10). **Confidence** = High/Medium/Low.

Key events include: Avdiivka Falls (I=9), Pokrovsk Offensive (I=9), Luhansk Fully Captured (I=9), Op. Spiderweb (I=9), Vuhledar Falls (I=8), Kharkiv Offensive (I=8), Kursk Incursion (I=8), Chasiv Yar Falls (I=8), Toretsk Falls (I=8), Kupiansk Offensive (I=8), Dobropillia UKR Victory (I=8).
