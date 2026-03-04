# Technical Stack — War Datasets Dashboard

## Runtime Environment

| Component | Version |
|-----------|---------|
| Node.js | v20.19.0 |
| npm | lockfileVersion 3 |
| Python | 3.12 |
| TypeScript | 5.9.3 |
| OS | Linux (WSL2) 5.15.167.4-microsoft-standard-WSL2 |

---

## Production Dependencies (7 packages)

### React Core

| Package | Specified | Resolved | Purpose |
|---------|-----------|----------|---------|
| `react` | ^18.3.1 | 18.3.1 | UI framework — component model, hooks, context, lazy/suspense |
| `react-dom` | ^18.3.1 | 18.3.1 | DOM renderer — `createRoot`, event system |

**Used for:** All 29 TSX components. `useReducer` for global state, `useContext` for cross-component data flow, `useMemo`/`useCallback` for performance, `React.lazy` for code-splitting the map tab, `React.Suspense` for loading fallback, class-based `ErrorBoundary` for chart isolation.

---

### Recharts (7 charts)

| Package | Specified | Resolved | Purpose |
|---------|-----------|----------|---------|
| `recharts` | ^2.13.3 | 2.15.4 | Composable React charting library built on D3 |

**Components used:**
- `AreaChart` + `Area` — TerritoryControlChart, RateOfChangeChart (dual-panel), KurskChart
- `BarChart` + `Bar` — MonthlyChangesChart (conditional red/blue), MetricDecomposition (horizontal stacked)
- `ScatterChart` + `Scatter` + `ZAxis` — EventTimelineChart (bubble size = territorial), EventScatterChart (bubble = cascade)
- `ReferenceLine` — Event overlays (vertical dashed), average lines (horizontal), phase markers
- `XAxis` / `YAxis` — Custom tick formatters, dual-axis layout
- `CartesianGrid` — Dark-theme styled grid
- `Tooltip` — Custom `content` prop with `ChartTooltip` component
- `ResponsiveContainer` — Auto-sizing to parent
- `Legend` — Built-in for MetricDecomposition; custom `ChartLegend` elsewhere

**Why Recharts over alternatives:**
- React-native composition model (JSX, not imperative API)
- Built-in `ResponsiveContainer` for fluid sizing
- `ReferenceLine` component maps naturally to event overlays
- Step-function interpolation (`type="stepAfter"`) for raw ISW data
- Lighter than Victory; more React-idiomatic than D3 direct

**Transitive D3 dependencies pulled by Recharts:** `d3-array`, `d3-color`, `d3-ease`, `d3-format`, `d3-interpolate`, `d3-path`, `d3-scale`, `d3-scale-chromatic`, `d3-shape`, `d3-time`, `d3-time-format`, `d3-timer` (12 modules)

---

### Nivo (2 charts)

| Package | Specified | Resolved | Purpose |
|---------|-----------|----------|---------|
| `@nivo/heatmap` | ^0.87.0 | 0.87.0 | Heatmap chart for event T/S/C matrix |
| `@nivo/radar` | ^0.87.0 | 0.87.0 | Radar/spider chart for event profiles |

**Components used:**
- `ResponsiveHeatMap` — EventHeatmap: rows = events (sorted by date), columns = Territorial / Strategic / Cascade, sequential red color scale
- `ResponsiveRadar` — EventRadarChart: overlaid polygons for top-5 events by importance, 3 axes (T/S/C)

**Transitive Nivo core modules:** `@nivo/annotations`, `@nivo/axes`, `@nivo/colors`, `@nivo/core`, `@nivo/legends`, `@nivo/scales`, `@nivo/tooltip` (7 internal packages). Also pulls `@react-spring/web` (6 packages) for animations.

**Why Nivo for these 2 charts:**
- Recharts has no heatmap or radar component
- Nivo's heatmap has built-in cell labels, sequential color scales, and responsive sizing
- Nivo's radar handles multi-series polygon overlay with automatic axis scaling
- Both integrate with React (JSX API, responsive wrappers)
- Trade-off: Nivo adds ~9 scoped packages + react-spring; acceptable for 2 charts that Recharts can't do

---

### Leaflet + React-Leaflet (map tab)

| Package | Specified | Resolved | Purpose |
|---------|-----------|----------|---------|
| `leaflet` | ^1.9.4 | 1.9.4 | Core mapping library — tile layers, GeoJSON, controls |
| `react-leaflet` | ^4.2.1 | 4.2.1 | React wrapper — declarative Leaflet components |

**Components used:**
- `MapContainer` — Root map element, centered on 48.5°N 37.5°E (eastern Ukraine)
- `TileLayer` — CARTO dark basemap (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- `GeoJSON` — Red semi-transparent polygons for Russian-controlled territory, with `key` prop for re-rendering on date change

**External resource:** Leaflet CSS loaded from CDN in `index.html`:
```
https://unpkg.com/leaflet@1.9.4/dist/leaflet.css
```

**Code-split:** `TerritoryMap.tsx` is loaded via `React.lazy()` to avoid including Leaflet in the main bundle (saves 156 KB from initial load).

**Why React-Leaflet:**
- Only mature React-Leaflet integration for interactive maps
- GeoJSON overlay support with style callbacks
- Lightweight (Leaflet core is ~40 KB gzipped)
- Free tile layers (CARTO dark matches dashboard theme)
- Alternative considered: Mapbox GL JS — heavier, requires API key, overkill for polygon overlay

---

## Dev Dependencies (6 packages)

| Package | Specified | Resolved | Purpose |
|---------|-----------|----------|---------|
| `typescript` | ^5.6.3 | 5.9.3 | Type checking, compile-time safety |
| `vite` | ^6.0.3 | 6.4.1 | Build tool — dev server, HMR, production bundling |
| `@vitejs/plugin-react` | ^4.3.4 | 4.7.0 | React Fast Refresh, JSX transform via esbuild |
| `@types/react` | ^18.3.12 | 18.3.27 | React type definitions |
| `@types/react-dom` | ^18.3.1 | 18.3.7 | ReactDOM type definitions |
| `@types/leaflet` | ^1.9.12 | 1.9.21 | Leaflet type definitions |

**Why Vite over alternatives:**
- Sub-200ms dev server startup (ESM-native, no bundling in dev)
- esbuild-powered TypeScript transpilation (~100x faster than tsc)
- Built-in code splitting (`React.lazy` → separate chunk automatically)
- `public/` directory copied as-is to `dist/` (perfect for static JSON/GeoJSON data files)
- Alternative considered: Next.js — adds SSR complexity; this is a static SPA with no backend

---

## Transitive Dependency Summary

| Category | Count | Notable packages |
|----------|-------|------------------|
| @esbuild (platform binaries) | 26 | esbuild native binaries for all platforms |
| @rollup (platform binaries) | 25 | Rollup native binaries for production build |
| @types | 22 | TypeScript type definitions |
| @babel | 20 | Babel parser/helpers (used by Vite plugin) |
| @nivo | 9 | Nivo chart internals |
| @react-spring | 6 | Animation engine for Nivo |
| @jridgewell | 5 | Source map utilities |
| D3 modules | 12 | Data visualization primitives |
| Other | 56 | React internals, CSS utilities, etc. |
| **Total** | **181** | |

---

## Build Output

| File | Size | Gzipped | Contents |
|------|------|---------|----------|
| `index.html` | 0.62 KB | 0.40 KB | Entry point, CSS/JS references |
| `index-n3ft-oRV.css` | 10.14 KB | 2.52 KB | All styles (variables + components) |
| `index-CnTWx3l_.js` | 768 KB | 228 KB | Main bundle: React, Recharts, Nivo, all components |
| `TerritoryMap-BK7WtgKN.js` | 156 KB | 46 KB | Code-split chunk: Leaflet + React-Leaflet + map components |
| **Total** | **935 KB** | **277 KB** | |

**Note:** The main JS bundle exceeds Vite's 500 KB warning threshold. Recharts (190 KB) and Nivo + D3 (180 KB) account for most of it. For further optimization, `manualChunks` in `vite.config.ts` could split vendor libraries into a separate cacheable chunk.

---

## Python Dependencies (data export scripts)

| Package | Version | Purpose |
|---------|---------|---------|
| `psycopg2-binary` | 2.9.x | PostgreSQL database driver |
| `json` | stdlib | JSON serialization |
| `os` / `pathlib` | stdlib | File system operations |
| `datetime` | stdlib | Date handling |

**Database (remote):** `138.201.62.161:5432`, database `war_datasets`, user `postgres`
**Database (local):** `localhost:5433`, database `russian_ukrainian_war`, user `isw`

DB connection is configured via environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).

---

## CI/CD — GitHub Actions Daily Update Pipeline

| Component | Details |
|-----------|---------|
| **Workflow** | `.github/workflows/daily-update.yml` |
| **Schedule** | Daily at 6:00 AM UTC (cron) + manual trigger |
| **Runner** | `ubuntu-latest` |
| **Python** | 3.11 (via `actions/setup-python@v5`) |
| **Node** | 20 (via `actions/setup-node@v4`) |
| **DB secrets** | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| **Deploy** | `peaceiris/actions-gh-pages@v4` → `gh-pages` branch |

**Scripts:**
- `scripts/check_new_data.py` — queries 18 tables for `MAX(date)` + `COUNT(*)`, compares with `_export_meta.json`
- `scripts/export_changed.py` — maps changed dataset keys to export functions, runs selectively
- `scripts/export_all_dashboard_data.py` — 33 export functions, each writing 1–8 JSON files

Full documentation: `docs/DAILY_UPDATE_PIPELINE.md`

---

## Deployment Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **GitHub Pages** | Primary deployment | Auto-deployed via daily update workflow to `gh-pages` branch |
| `cloudflared` | Cloudflare quick tunnel | No account needed; temporary `trycloudflare.com` URL |
| `npx serve` | Static file server | Serves `dist/` folder on localhost |
| Netlify Drop | Alternative static hosting | Drag-and-drop `dist/` folder at app.netlify.com/drop |

---

## CSS Architecture

No CSS framework — custom properties + vanilla CSS.

**`variables.css`** defines the dark theme palette:
```css
--bg-primary: #0d1117        /* GitHub dark background */
--bg-card: #161b22           /* Card/chart background */
--color-territory: #2ca02c   /* Green — Ukrainian territory data */
--color-russian-gains: #d62728  /* Red — Russian gains */
--color-ukrainian-gains: #1f77b4  /* Blue — Ukrainian gains */
--color-kursk: #ff7f0e       /* Orange — Kursk data */
--color-trend: #d62728       /* Red — trend lines */
--color-territorial: #2ca02c /* Green — T score */
--color-strategic: #1f77b4   /* Blue — S score */
--color-cascade: #ff7f0e     /* Orange — C score */
```

Colors sourced from the original matplotlib charts (`visualize_with_events.py`) to maintain visual consistency.

**`components.css`** handles:
- CSS Grid layout (sidebar 280px + main content)
- Chart card styling with dark borders
- Custom tooltip styling
- Toggle switch component
- Event filter checkboxes with color-coded dots
- Responsive breakpoints (sidebar collapses at 768px)
- Loading spinner animation
- Map legend positioning

---

## State Management

**Pattern:** React Context + `useReducer` (no external state library)

**Actions:**
| Action | Payload | Effect |
|--------|---------|--------|
| `SET_DATE_RANGE` | `[Date, Date]` | Filters all charts to date window |
| `SET_FULL_DATE_RANGE` | `[Date, Date]` | Sets bounds from metadata on load |
| `TOGGLE_EVENT` | `string` (event name) | Toggles single event in overlay |
| `SET_SELECTED_EVENTS` | `string[]` | Bulk set (used for "All"/"None") |
| `SET_TAB` | `'territory' \| 'events' \| 'map'` | Tab navigation |
| `TOGGLE_INTERPOLATION` | — | Raw step-function vs interpolated |
| `SET_HIGHLIGHTED_EVENT` | `string \| null` | Cross-chart event highlight |
| `SET_LOADING` | `boolean` | Loading state |
| `SET_ERROR` | `string \| null` | Error state |

**Why not Redux/Zustand/Jotai:** 9 actions, single reducer, no middleware needed. Context + useReducer is sufficient and adds zero dependencies.

---

## Data Processing (ported from Python)

`src/data/processing.ts` contains 5 functions ported from `visualize_with_events.py`:

| Function | Python original | Purpose |
|----------|----------------|---------|
| `interpolateStepFunction()` | `interpolate_step_function()` | Distributes batch ISW updates evenly across days |
| `rollingMedian()` | `rolling_median()` | 7-day rolling median for noise smoothing |
| `computeMonthlyChanges()` | `compute_monthly_changes()` | End-of-month minus start-of-month per month |
| `computeRateOfChange()` | `compute_rate_of_change()` | 30-day rolling velocity in km²/month |
| `computeLinearTrend()` | numpy `polyfit` | Least-squares linear regression for trend line |

All functions operate on `DailyArea[]` arrays and return typed results. No external math libraries — all computations are vanilla TypeScript.
