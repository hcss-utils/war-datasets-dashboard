# Ukraine War Data Dashboard - Development Changelog

## 2026-01-31 - Unified Conflict Events Tab with Category Breakdowns

### Added
- **Unified Conflict Events Tab** - Restructured all conflict datasets into subtabs:
  - ACLED - Event type filters (6 types: Battles, Explosions/Remote violence, Protests, Riots, Strategic developments, Violence against civilians)
  - UCDP - Violence type filters (3 types: State-based, Non-state, One-sided)
  - VIINA - News source filters (16 sources) with ML-classified event types
  - Bellingcat - Impact type filters (13 types: Residential, Commercial, Healthcare, Military, etc.)
  - Comparison - Cross-dataset comparison view

- **Sidebar filters** for all conflict subtabs with All/None toggle buttons
- **Stacked bar charts** showing category breakdowns over time for each dataset
- **Pie charts** for category distributions
- **Horizontal bar charts** for top categories
- **URL hash deep linking** - Navigate directly via #conflict-acled, #conflict-ucdp, etc.
- **Source link highlighting** - Clicking source links navigates to Sources tab and highlights the card

- **New data exports** for category breakdowns:
  - `ucdp_by_violence_type.json` - UCDP totals by violence type
  - `ucdp_monthly_by_type.json` - Monthly UCDP by violence type
  - `bellingcat_by_impact.json` - Bellingcat totals by impact category
  - `bellingcat_monthly_by_impact.json` - Monthly Bellingcat by impact
  - `viina_by_event_type.json` - VIINA totals by ML event type
  - `viina_monthly_by_event_type.json` - Monthly VIINA by event type

### Fixed
- **MDAA external URL** - Fixed 404 error on MDAA Tracker source link

### Technical
- New components: `UnifiedConflictEventsTab.tsx`, `SubtabNavigation.tsx`, `ACLEDSubtab.tsx`, `UCDPSubtab.tsx`, `VIINASubtab.tsx`, `BellingcatSubtab.tsx`, `ComparisonSubtab.tsx`
- New types: `UCDPByViolenceType`, `UCDPMonthlyByType`, `BellingcatByImpact`, `BellingcatMonthlyByImpact`, `ViinaByEventType`, `ViinaMonthlyByEventType`
- Updated `export_all_dashboard_data.py` with category breakdown exports

---

## Repository Information

| Location | Path / URL |
|----------|------------|
| **GitHub** | https://github.com/sdspieg/war-datasets-dashboard.git |
| **Live Site** | https://sdspieg.github.io/war-datasets-dashboard/ |
| **Working Dir** | `/tmp/dashboard-build` |
| **Backup** | `C:\Apps\dashboard-build` |
| **Google Drive** | `G:\My Drive\RuBase\Red lines\Datasets\dashboard` |

**Git Branches:**
- `main` — Full source code (Plotly version)
- `gh-pages` — Built `dist/` folder (deployed to GitHub Pages)

**Dev Server:** `http://localhost:3000/war-datasets-dashboard/`

**Last deployed to gh-pages:** 2026-01-31 22:31:27 +0100

---

## 2026-01-31 - Plotly Migration and Enhanced Interactivity

### Changed
- **Migrated all tabs from Recharts to Plotly.js** for true drag-to-zoom functionality:
  - VIINA tab → `ViinaTabPlotly.tsx`
  - Conflict Events tab → `ConflictEventsTabPlotly.tsx`
  - Aerial Assaults tab → `AerialAssaultsTabPlotly.tsx`
  - Equipment tab → `EquipmentTabPlotly.tsx`
  - Bellingcat tab → `BellingcatTabPlotly.tsx`
  - Humanitarian tab → `HumanitarianTabPlotly.tsx`

### Added
- **Native drag-to-zoom** on all charts - drag a region to zoom, double-click to reset
- **Range sliders** on time series charts for quick date range navigation
- **Consistent dark theme** across all Plotly charts:
  - Dark tooltips with white text (`#1a1a2e` background, `#fff` text)
  - Improved axis label visibility (`#b0b0b0` instead of `#888`)
  - Transparent chart backgrounds for seamless integration
- **Instant source navigation** - Clicking source links (e.g., "(VIINA)") immediately jumps to the corresponding source card in the Sources tab
- **Orange pulsing highlight animation** - When navigating to a source, the card pulses orange 3 times to draw attention
- **Deep linking support** - URLs like `#sources-viina` link directly to specific source cards

### Technical
- Added `hoverlabel` configuration to all Plotly traces for consistent tooltip styling
- Added CSS-based Plotly tooltip styling in `components.css`
- Added `SOURCE_ID_MAP` pattern for mapping display names to element IDs
- Implemented hash-based deep linking with 150ms delay for React render timing
- Added `@keyframes source-pulse` animation for source card highlighting
- **Legend click behavior**: `itemclick: 'toggleothers'` - click to isolate one series, double-click to toggle
- Fixed funding gap chart to filter out records with null requirements

---

## 2026-01-31 - VIINA and Bellingcat Visualizations

### Added
- **VIINA Tab** - New visualization tab for 552K+ news-based conflict events
  - Daily events time series chart
  - Events by news source (pie chart - 16 Ukrainian/Russian outlets)
  - Top 10 oblasts by event count (bar chart)
  - Monthly events by source (stacked bar with clickable legend filtering)

- **Bellingcat Tab** - New visualization tab for 2,514 OSINT-verified civilian harm incidents
  - Daily incidents with 7-day rolling average
  - Monthly incidents bar chart
  - Cumulative incidents over time (area chart)
  - Recent incidents table (20 most recent)

- **New data exports** for aggregated VIINA and Bellingcat data:
  - `viina_daily.json` - Daily event counts
  - `viina_monthly.json` - Monthly event counts
  - `viina_by_source.json` - Events by news source
  - `viina_by_oblast.json` - Events by oblast
  - `viina_monthly_by_source.json` - Monthly events by source for stacked charts
  - `bellingcat_daily.json` - Daily incident counts
  - `bellingcat_monthly.json` - Monthly incident counts

### Changed
- Renamed "Conflict Events" tab to "ACLED/UCDP" for clarity
- Sorted Sources tab alphabetically by dataset name
- Added incidents table styling for Bellingcat tab

### Technical
- Added new types: `ViinaDaily`, `ViinaMonthly`, `ViinaBySource`, `ViinaByOblast`, `ViinaMonthlyBySource`, `BellingcatDaily`, `BellingcatMonthly`, `BellingcatIncident`
- Added new data loaders in `newLoader.ts`
- Updated `TabNavigation.tsx` with new tabs
- Updated `export_all_dashboard_data.py` with new export functions

---

## 2026-01-31 - Initial Dashboard Setup

### Added
- "Under development" banner at top of dashboard
- GitHub Pages deployment configuration
- Base path configuration for `/war-datasets-dashboard/`

### Data Sources Integrated
1. **ACLED** - Armed Conflict Location & Event Data (187,740 events)
2. **UCDP GED** - Uppsala Conflict Data Program (31,547 events)
3. **VIINA 2.0** - News-based event tracking (552,128 events)
4. **Bellingcat** - OSINT-verified civilian harm (2,514 incidents)
5. **Missile Attacks** - PetroIvaniuk dataset (3,330 attack records)
6. **MDAA Tracker** - Air war statistics (234 daily records)
7. **ISW** - Institute for Study of War maps (2.8M+ features)
8. **DeepState Map** - Territorial control (562 snapshots)
9. **Equipment Losses** - Ukrainian MoD & Oryx (1,432 daily records)
10. **OHCHR** - UN civilian casualties (71 monthly reports)
11. **UNHCR** - Refugee statistics (56,000+ records)
12. **HDX HAPI** - Humanitarian indicators (133,000+ records)

### Tabs
- Overview - Key statistics across all datasets
- ACLED/UCDP - Conflict event analysis
- VIINA - News-based event tracking
- Bellingcat - Civilian harm incidents
- Aerial Assaults - Missile and drone attacks
- Equipment - Russian equipment losses
- Humanitarian - Casualties and refugees
- Territory - Territorial control over time
- Military Events - Key event timeline
- Map - Interactive territory map
- Sources - Data source documentation

---

## 2026-01-31 - UI Improvements and HAPI Data

### Added
- **Time unit picker for VIINA** - Users can now switch between days, weeks, and months
- **Date range zoom (brush)** - Added brush component to VIINA charts for zooming
- **HAPI data visualizations** in Humanitarian tab:
  - Internally Displaced Persons (IDPs) over time
  - Humanitarian Funding Gap (requirements vs funded)
- **Source labels** - Blue hyperlinks to Sources tab on chart titles
- **New data exports**:
  - `viina_weekly.json` - Weekly event counts
  - `viina_weekly_by_source.json` - Weekly by source for stacked charts
  - `viina_daily_by_source.json` - Daily by source for stacked charts
  - `hapi_food_prices.json` - Food price data
  - `hapi_idps.json` - IDP data by oblast
  - `hapi_idps_total.json` - Total IDP counts
  - `hapi_humanitarian_needs.json` - Humanitarian needs data
  - `hapi_funding.json` - Funding requirements and received

### Changed
- Moved stacked bar chart to top of VIINA tab
- Added source labels (with hyperlinks) to Humanitarian tab charts
- Added IDPs count to Humanitarian tab summary stats

---

## 2026-01-31 - Source Labels, Zoom, and Clickable Legends Everywhere

### Added
- **Source labels with hyperlinks** - Added clickable "(SOURCE)" labels to ALL chart titles across all tabs:
  - ACLED/UCDP tab: All charts now link to Sources
  - Bellingcat tab: All charts now link to Sources
  - Aerial Assaults tab: All charts now link to Sources (MDAA Tracker)
  - Equipment tab: All charts now link to Sources (Ukraine MOD)
  - Territory tab: TerritoryControlChart and KurskChart now link to Sources (DeepState)
- **Date range zoom (brush)** - Added Brush component to Bellingcat daily incidents chart
- **SourceLink component** - Reusable component pattern for blue hyperlinks to Sources tab
- **Clickable legend filtering on ALL multi-series charts** - Click any legend item to show only that series:
  - ACLED/UCDP: Daily Event Count, Daily Fatalities, Monthly Events by Type
  - Bellingcat: Daily Incidents chart (filter Daily vs 7-day Average)
  - Aerial Assaults: Daily Aerial Threats, Drones vs Missiles
  - Equipment: Daily Heavy Equipment Losses, Cumulative Air Losses
  - VIINA: Events by Source stacked chart (already had this)

### Changed
- Converted all `<span className="chart-source">` to `<SourceLink source="..." />` for consistency
- Added chart zoom instructions to Bellingcat tab
- Added "Click legend to filter" instructions to relevant charts

---

## Pending Improvements

### Date Range Zoom
- [x] Add date range selector/brush to VIINA charts
- [x] Add brush to Bellingcat daily incidents chart
- [ ] Add brush to remaining time series charts (Aerial, Equipment, Humanitarian)

### Clickable Legends
- [x] VIINA stacked chart has clickable legends
- [x] ACLED/UCDP: Daily Event Count, Daily Fatalities, Monthly Events by Type
- [x] Bellingcat: Daily Incidents
- [x] Aerial Assaults: Daily Threats, Drones vs Missiles
- [x] Equipment: Heavy Equipment Losses, Air Losses
- [x] All multi-series line/area charts now support clickable legend filtering

### Source Labels
- [x] Added to VIINA tab charts
- [x] Added to Humanitarian tab charts
- [x] Added to ACLED/UCDP tab charts
- [x] Added to Bellingcat tab charts
- [x] Added to Aerial Assaults tab charts
- [x] Added to Equipment tab charts
- [x] Added to Territory tab charts (TerritoryControlChart, KurskChart)
