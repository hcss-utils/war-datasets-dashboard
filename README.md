# War Datasets Dashboard

Interactive dashboard visualizing the Ukraine war through multiple data sources — conflict events, aerial assaults, threats & rhetoric, equipment losses, economic impact, sabotage & disinformation, humanitarian data, and territorial control.

**Live site:** https://sdspieg.github.io/war-datasets-dashboard

## Tabs

| Tab | Subtabs | Key Data |
|-----|---------|----------|
| **Overview** | — | KPI cards across all datasets with date ranges |
| **Conflict Events** | ACLED · UCDP · VIINA · Bellingcat · ACLED HDX · Comparison | 224K ACLED events, 31K UCDP events, 557K VIINA events, 2.5K Bellingcat incidents |
| **Aerial Assaults** | — | 1K+ attack waves, 88K missiles/drones launched, 70.7% intercept rate |
| **Threats & Rhetoric** | Threat Events · Coercive Discourse · Red Lines · Escalation Index | 293K GDELT threat events, 360K coercive quotations, 8.7K red line quotations, weekly VARX index |
| **Losses** | — | 1.26M personnel, 11.7K tanks, 435 aircraft (Ukraine MOD) |
| **Economic Impact** | Energy · Aid & Sanctions · Military Spending | EU gas flows, Russia fossil revenue, Kiel aid tracker, EU sanctions, SIPRI expenditure |
| **Sabotage & Disinfo** | Cyber Incidents · Disinformation · Infrastructure · Hybrid Events | 3.4K cyber incidents, 14.5K disinfo cases, Baltic cable incidents, Leiden hybrid events |
| **Humanitarian** | — | OHCHR civilian casualties, UNHCR refugee data |
| **Military Events** | — | ISW-based territory analysis with event scoring |
| **Map** | — | Interactive territorial control map (DeepState + Kursk) |

## Datasets

| Source | Description | Records |
|--------|-------------|---------|
| [ACLED](https://acleddata.com/) | Armed Conflict Location & Event Data | 224K events |
| [ACLED HDX](https://data.humdata.org/) | Regional aggregated conflict data (violence, civilian, demonstrations) | 41K records |
| [UCDP GED](https://ucdp.uu.se/) | Uppsala Conflict Data Program | 31K events |
| [VIINA 2.0](https://github.com/zhukovyuri/VIINA) | ML-classified news events from 16 outlets | 557K events |
| [Bellingcat](https://ukraine.bellingcat.com/) | OSINT-verified civilian harm incidents | 2.5K incidents |
| [GDELT](https://www.gdeltproject.org/) | Global threat events, coercive rhetoric, red line discourse | 664K records |
| [Ukrainian MoD](https://www.mil.gov.ua/) | Equipment and personnel losses | 1.4K daily records |
| [Missile Attacks DB](https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset) | Missile/drone strikes with intercept rates | 3.3K records |
| [OHCHR](https://www.ohchr.org/) | UN-verified civilian casualties | 71 monthly reports |
| [UNHCR](https://www.unhcr.org/) | Refugee statistics and displacement | 56K records |
| [Bruegel](https://www.bruegel.org/) | EU gas pipeline flows | 1.9K records |
| [CREA](https://energyandcleanair.org/) | Russia fossil fuel revenue | 11.5K records |
| [Kiel Institute](https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/) | Ukraine aid commitments by donor | 5.2K records |
| [OpenSanctions](https://www.opensanctions.org/) | EU sanctions entities | 70.5K entities |
| [SIPRI](https://www.sipri.org/) | Military expenditure by country | 8.3K records |
| [EURepoC](https://eurepoc.eu/) | Cyber incidents (state-sponsored) | 3.4K incidents |
| [EUvsDisinfo](https://euvsdisinfo.eu/) | Disinformation cases | 14.5K cases |
| [Baltic Cable Incidents](https://en.wikipedia.org/wiki/Baltic_Sea_cable_sabotage) | Undersea cable sabotage events | 7 incidents |
| [Leiden University](https://www.universiteitleiden.nl/) | Hybrid threat events | 153 events |
| [DeepState](https://deepstatemap.live/) | Territorial control snapshots | 562 snapshots |
| [ISW](https://www.understandingwar.org/) | Institute for the Study of War analysis | 2.8M features |

## Project Structure

```
src/
├── components/
│   ├── OverviewTab.tsx
│   ├── UnifiedConflictEventsTab.tsx
│   ├── AerialAssaultsTab.tsx
│   ├── ThreatsTab.tsx
│   ├── EquipmentTab.tsx
│   ├── EconomicTab.tsx
│   ├── SabotageTab.tsx
│   ├── HumanitarianTab.tsx
│   ├── threats/          # Subtab panels (ThreatEvents, Coercive, RedLines, Escalation)
│   ├── economic/         # Subtab panels (Energy, AidSanctions, MilitarySpending)
│   ├── sabotage/         # Subtab panels (Cyber, Disinfo, Infrastructure, Hybrid)
│   ├── conflict/         # Subtab panels (AcledHdx, SubtabNavigation)
│   ├── charts/           # Chart components (Timeline, Heatmap, Radar, Scatter)
│   └── map/              # Leaflet map components
├── data/                 # Data loaders (newLoader.ts)
├── context/              # React Context state management
├── types/                # TypeScript interfaces
└── styles/               # CSS

public/data/              # JSON datasets (exported from PostgreSQL)
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Recharts (charts)
- Leaflet (maps)
- GitHub Pages (deployment via gh-pages branch)

## Changelog

### 2026-03-03 — Interactive Legend Toggle (All Charts)

Added click-to-isolate interactivity to all ~20 multi-series charts. Click any legend item to show only that series; click again to restore all. Dual-pane charts (levels + rates) share toggle state.

- New `useSeriesToggle` hook (`src/hooks/useSeriesToggle.ts`) with optional group mapping for paired charts
- **Conflict Events**: ACLED/UCDP events and fatalities dual-pane charts (4 legends)
- **Aerial Assaults**: launched/intercepted, drones/missiles, weapon types (4 legends)
- **Losses**: heavy equipment + rates, strategic air losses (3 legends)
- **Humanitarian**: casualties + rates, region breakdown, refugee totals (4 legends)
- **Energy**: pipeline flows, gas supply by source (2 legends)
- **Military Spending**: 10 country lines (1 legend)
- **ACLED HDX**: monthly events, regional breakdown (2 legends)
- **Threat Events**: events + media mentions (1 legend)
- **Military Events**: metric decomposition T/S/C bars (1 legend)

### 2026-03-03 — UI/UX Review Fixes

Comprehensive fixes from reviewer audit addressing ~40 issues across all tabs.

**Global**
- Extended color palette from 8 to 20 colors (`src/utils/colors.ts`) — eliminates duplicate colors in all bar/pie charts with >8 categories

**Conflict Events**
- UCDP lines now end at last real data point instead of dropping to zero (publication lag, not zero events)
- Added ACLED vs UCDP methodology note (fatality threshold, publication cadence, event scope)
- Pie chart filters out <1% event types to reduce noise
- Events rate Y-axis clamped to [-200, 200] to prevent single spikes from squashing all data
- Added UCDP batch reporting note for fatalities chart

**ACLED HDX**
- Fixed chart title: "Events by Type" (was "Violence Events & Fatalities" — no fatalities column exists)
- Fixed X-axis label crowding with `interval="preserveStartEnd"`

**VIINA**
- Oblast names normalized to Ukrainian: Kyiv (was Kiev), Odesa (was Odessa), Zaporizhzhia (was Zaporizhzhya)

**Aerial Assaults**
- Intercept rate bars sorted by rate descending (was alphabetical)
- Bars color-coded by weapon category: ballistic (red), cruise (blue), drone (orange)
- "Молнія" transliterated to "Molniya (drone)"
- Added color legend note

**Threats & Rhetoric**
- GDELT target countries merged: UKRAINE/UKRAINIAN/CRIMEA/KYIV → UKR, RUSSIA/RUSSIAN/PUTIN/MOSCOW → RUS, etc.
- All three subtab panels (ThreatEvents, Coercive, RedLines) use 20-color palette

**Losses**
- Split "Cumulative Air Losses" into two charts: "Strategic Air Losses" (Aircraft + Helicopters) and "Drone Losses" — drones at 160K were squashing aircraft/helicopters at ~400
- Daily tank chart title shows 180-day total

**Economic Impact**
- Gas chart title: "by Source" (was "by Source Country" — LNG is not a country)
- Added LNG explanation note and Yamal pipeline status note (near zero since May 2022)

**Aid & Sanctions**
- Sanctions entity types humanized: "PublicBody" → "Public Body", "LegalEntity" → "Legal Entity"
- Sanctions pie chart filters <1% entity types
- Donor bar chart uses 20-color palette

**Sabotage & Disinfo**
- Cyber: merged "Unknown;Unknown"/"unknown" variants into single "Unknown" entry
- Infrastructure: added summary stats card (total incidents + date range), incidents grouped by year
- Hybrid: added "Events may appear in multiple categories" note, year bar labels added
- All subtab panels use 20-color palette

**Humanitarian**
- Casualty chart X-axis interval reduced (was showing every month tick)
- Added prominent OHCHR caveat: verified figures are confirmed minimums
- Added labels on asylum seekers bars for readability

**Map**
- Added "Source: DeepState Map" attribution overlay

## Development

```bash
npm install
npm run dev
```

## Data Export

Data is exported from a PostgreSQL database using:

```bash
python export_all_dashboard_data.py
```

This generates ~80 JSON files in `public/data/` from schemas: `conflict_data`, `global_events`, `economic_data`, `western_sabotage`, `casualties`, and others.
