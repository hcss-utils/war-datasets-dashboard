import React, { useEffect, useState } from 'react';

interface DataSource {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  dateRange: string;
  records: string;
  spatialResolution: string;
  updateFrequency: string;
  strengths: string[];
  limitations: string[];
  tables: string[];
}

// Data sources sorted alphabetically by name
const DATA_SOURCES: DataSource[] = [
  {
    id: 'acled',
    name: 'ACLED',
    fullName: 'Armed Conflict Location & Event Data Project',
    url: 'https://acleddata.com',
    description: 'Global conflict event database with detailed event typing, actor identification, and fatality counts. Covers battles, explosions, protests, and violence against civilians.',
    dateRange: '2018 - Present',
    records: '187,740 Ukraine events',
    spatialResolution: 'Point-level (lat/lon) with precision indicator',
    updateFrequency: 'Weekly updates',
    strengths: [
      'Detailed event type taxonomy (battles, explosions, protests)',
      'Actor identification (military forces, rebel groups)',
      'Fatality counts (conservative, confirmed only)',
      'Global coverage with consistent methodology',
    ],
    limitations: [
      'Weapon types only in unstructured notes field',
      'No intercept/destruction data',
      'Conservative fatality counts',
    ],
    tables: ['conflict_events.acled_events'],
  },
  {
    id: 'bellingcat',
    name: 'Bellingcat',
    fullName: 'Bellingcat Ukraine TimeMap - Civilian Harm Database',
    url: 'https://ukraine.bellingcat.com',
    description: 'OSINT-verified civilian harm incidents with infrastructure impact categories and weapon system identification where possible.',
    dateRange: 'Feb 24, 2022 - Present',
    records: '2,514 verified incidents',
    spatialResolution: 'Point-level (752 unique locations)',
    updateFrequency: 'Continuous verification',
    strengths: [
      'OSINT-verified incidents',
      'Infrastructure impact categories (residential, healthcare, etc.)',
      'Source documentation with URLs',
      'Weapon system identification (when available)',
    ],
    limitations: [
      'Weapon unknown for 76% of records',
      'Biased toward events with media coverage',
      'No fatality counts',
    ],
    tables: ['conflict_events.bellingcat_harm'],
  },
  {
    id: 'deepstate',
    name: 'DeepState Map',
    fullName: 'DeepState - Territorial Control',
    url: 'https://deepstatemap.live',
    description: 'Community-sourced territorial control mapping with polygon geometries showing Ukrainian vs Russian-controlled areas.',
    dateRange: 'Feb 2022 - Present',
    records: '562 territorial snapshots',
    spatialResolution: 'Polygon geometries',
    updateFrequency: 'Regular updates',
    strengths: [
      'Community-sourced with rapid updates',
      'Clear territorial delineation',
      'GeoJSON format',
    ],
    limitations: [
      'Community-sourced (variable verification)',
    ],
    tables: ['territorial_control.deepstate_territory'],
  },
  {
    id: 'equipment',
    name: 'Equipment Losses',
    fullName: 'Ukrainian MoD & Oryx Equipment Tracking',
    url: 'https://www.kaggle.com/datasets/piterfm/2022-ukraine-russian-war',
    description: 'Daily cumulative equipment losses (tanks, aircraft, artillery, etc.) from Ukrainian Ministry of Defense reports, plus Oryx visual confirmation data.',
    dateRange: 'Feb 24, 2022 - Present',
    records: '1,432 daily records',
    spatialResolution: 'National-level',
    updateFrequency: 'Daily',
    strengths: [
      'Comprehensive equipment categories',
      'Daily tracking since war start',
      'Personnel estimates',
      'Oryx visual confirmation subset',
    ],
    limitations: [
      'Ukrainian official figures (may overestimate)',
      'No geographic breakdown',
    ],
    tables: [
      'equipment_losses.equipment_daily',
      'equipment_losses.personnel_daily',
      'equipment_losses.equipment_oryx',
    ],
  },
  {
    id: 'hapi',
    name: 'HDX HAPI',
    fullName: 'Humanitarian Data Exchange - HAPI Indicators',
    url: 'https://data.humdata.org',
    description: 'Humanitarian indicators including food prices, poverty rates, IDPs, funding, and humanitarian needs assessments.',
    dateRange: 'Varies by indicator',
    records: '133,000+ records',
    spatialResolution: 'Admin1/Admin2 level',
    updateFrequency: 'Varies',
    strengths: [
      'Comprehensive humanitarian indicators',
      'Standardized format',
      'Admin-level granularity',
    ],
    limitations: [
      'Variable update frequency',
      'Some indicators sparse',
    ],
    tables: [
      'humanitarian.hapi_food_prices',
      'humanitarian.hapi_refugees',
      'humanitarian.hapi_returnees',
      'humanitarian.hapi_idps',
      'humanitarian.hapi_humanitarian_needs',
      'humanitarian.hapi_conflict_events',
    ],
  },
  {
    id: 'kiel',
    name: 'Kiel Institute',
    fullName: 'Kiel Institute for the World Economy - Ukraine Support Tracker',
    url: 'https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/',
    description: 'Systematic tracking of bilateral aid commitments to Ukraine from governments worldwide, covering military, financial, and humanitarian assistance with EUR valuations.',
    dateRange: 'Jan 2022 - Oct 2025',
    records: '5,800+ commitments from 26 donors',
    spatialResolution: 'Country-level (donor)',
    updateFrequency: 'Monthly updates',
    strengths: [
      'Comprehensive coverage of 26 major donor countries',
      'Breakdown by aid type (Military, Financial, Humanitarian)',
      'EUR-normalized values for cross-country comparison',
      'Monthly timeline for trend analysis',
    ],
    limitations: [
      'Tracks commitments, not actual disbursements',
      'Some multi-year pledges allocated to announcement month',
      'May not capture all bilateral or in-kind contributions',
    ],
    tables: ['economic.kiel_aid_by_donor', 'economic.kiel_aid_timeline'],
  },
  {
    id: 'isw',
    name: 'ISW',
    fullName: 'Institute for the Study of War - Conflict Mapping',
    url: 'https://www.understandingwar.org',
    description: 'Daily territorial control shapefiles showing Russian-claimed areas, contested zones, Ukrainian counteroffensives, and front line positions.',
    dateRange: 'Nov 2023 - Present',
    records: '2.8M+ spatial features',
    spatialResolution: 'Polygon/line geometries',
    updateFrequency: 'Daily shapefiles',
    strengths: [
      'Precise territorial control polygons',
      'Multiple layer types (claimed, contested, etc.)',
      'Daily snapshots',
      'Professional military analysis',
    ],
    limitations: [
      'Interpretation-based (analyst judgment)',
      'Some days missing',
    ],
    tables: [
      'isw.events',
      'isw.control_polygons',
      'isw.shapefile_metadata',
    ],
  },
  {
    id: 'mdaa',
    name: 'MDAA Tracker',
    fullName: 'Missile Defense Advocacy Alliance - Air War Tracker',
    url: 'https://www.missiledefenseadvocacy.org/missile-threat-and-proliferation/todays-missile-threat/ukrainian-war-updates/',
    description: 'Daily tracking of aerial threats (missiles and UAVs) with intercept statistics. Provides national-level aggregates of attack and defense outcomes.',
    dateRange: 'Jan 2025 - Aug 2025',
    records: '234 daily records',
    spatialResolution: 'National-level',
    updateFrequency: 'Daily',
    strengths: [
      'Clear missile vs UAV breakdown',
      'Intercept success tracking',
      'Daily granularity',
    ],
    limitations: [
      'Limited date range (2025 only)',
      'No geographic breakdown',
      'National totals only',
    ],
    tables: ['aerial_assaults.mdaa_daily'],
  },
  {
    id: 'missile',
    name: 'Missile Attacks',
    fullName: 'PetroIvaniuk - Massive Missile Attacks on Ukraine',
    url: 'https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine',
    description: 'Detailed tracking of missile and drone attacks including weapon models, launch platforms, intercept rates, and affected regions. Based on Ukrainian Air Force reports.',
    dateRange: 'Sep 2022 - Present',
    records: '3,330 attack records',
    spatialResolution: 'Oblast-level',
    updateFrequency: 'Continuous on Kaggle',
    strengths: [
      'Detailed weapon model identification (64 types)',
      'Launch and intercept counts',
      'Carrier/platform information',
      'Weapon specifications database',
    ],
    limitations: [
      'Oblast-level only (no point coordinates)',
      'Based on official Ukrainian reports',
    ],
    tables: ['aerial_assaults.missile_attacks', 'aerial_assaults.weapon_types'],
  },
  {
    id: 'sipri',
    name: 'SIPRI',
    fullName: 'Stockholm International Peace Research Institute - Military Expenditure Database',
    url: 'https://www.sipri.org/databases/milex',
    description: 'Global military expenditure data covering 173 countries from 1949 onwards. Provides consistent, comparable data on military spending using open-source government budget information.',
    dateRange: '1949 - 2024',
    records: '9 key countries tracked (76 years)',
    spatialResolution: 'Country-level',
    updateFrequency: 'Annual release (April)',
    strengths: [
      'Longest-running military spending dataset globally',
      'Constant USD (2022) for inflation-adjusted comparison',
      'Consistent methodology across countries and time',
      'Peer-reviewed and widely cited',
    ],
    limitations: [
      'Annual data only (no sub-annual breakdown)',
      'Russia data may undercount off-budget military spending',
      'Some countries have gaps in reporting',
    ],
    tables: ['economic.sipri_expenditure'],
  },
  {
    id: 'ohchr',
    name: 'OHCHR',
    fullName: 'UN Office of the High Commissioner for Human Rights',
    url: 'https://www.ohchr.org/en/news/2024/09/ukraine-civilian-casualty-update',
    description: 'Official UN civilian casualty figures with regional breakdowns. Conservative methodology counting only verified casualties.',
    dateRange: 'Feb 2022 - Present',
    records: '71 monthly reports',
    spatialResolution: 'Oblast-level',
    updateFrequency: 'Monthly reports',
    strengths: [
      'UN verification standards',
      'Regional breakdown',
      'Killed/injured separation',
    ],
    limitations: [
      'Conservative (verified only)',
      'Monthly aggregates (no daily)',
      'Significant undercount acknowledged',
    ],
    tables: ['casualties.ohchr_casualties'],
  },
  {
    id: 'ucdp',
    name: 'UCDP GED',
    fullName: 'Uppsala Conflict Data Program - Georeferenced Event Dataset',
    url: 'https://ucdp.uu.se',
    description: 'Academic gold-standard conflict dataset with rigorous coding methodology, three-estimate fatality approach, and comprehensive source documentation.',
    dateRange: '1989 - Dec 2024',
    records: '31,547 Ukraine events',
    spatialResolution: '7-level precision scale',
    updateFrequency: 'Annual release',
    strengths: [
      'Academic rigor with transparent methodology',
      'Three-estimate fatality approach (low/best/high)',
      'Comprehensive source documentation',
      'Long historical coverage',
    ],
    limitations: [
      'No weapon-type classification',
      'Annual release cycle (no 2025 data yet)',
      'Requires documented fatalities for inclusion',
    ],
    tables: ['conflict_events.ucdp_events'],
  },
  {
    id: 'unhcr',
    name: 'UNHCR',
    fullName: 'UN High Commissioner for Refugees',
    url: 'https://data.unhcr.org/en/situations/ukraine',
    description: 'Refugee and displacement statistics including cross-border movements, asylum applications, and demographic breakdowns.',
    dateRange: 'Feb 2022 - Present',
    records: '56,000+ records',
    spatialResolution: 'Country/region-level',
    updateFrequency: 'Regular updates',
    strengths: [
      'Official refugee statistics',
      'Demographic breakdowns',
      'Asylum application tracking',
      'Multi-country coverage',
    ],
    limitations: [
      'Registration-based (may miss unregistered)',
    ],
    tables: [
      'humanitarian.unhcr_population',
      'humanitarian.unhcr_refugees',
      'humanitarian.unhcr_asylum_applications',
      'humanitarian.unhcr_asylum_decisions',
      'humanitarian.unhcr_demographics',
    ],
  },
  {
    id: 'viina',
    name: 'VIINA 2.0',
    fullName: 'Violent Incident Information from News Articles',
    url: 'https://github.com/zhukovyuri/VIINA',
    description: 'ML-classified conflict events from Ukrainian and Russian news sources. BERT-based transformer classifies 24 event types and 6 actor categories with daily territorial control tracking.',
    dateRange: 'Feb 24, 2022 - Present',
    records: '48M+ records (control + events)',
    spatialResolution: '33,141 Ukrainian populated places',
    updateFrequency: 'Daily updates',
    strengths: [
      'Near real-time coverage from 16 news outlets',
      'ML classification of 24 event types',
      'Daily territorial control status',
      'Both Ukrainian and Russian sources',
    ],
    limitations: [
      'ML classification (probabilities, not ground truth)',
      'No fatality counts',
      'News bias toward urban areas',
    ],
    tables: [
      'conflict_events.viina_events',
      'conflict_events.viina_labels',
      'conflict_events.viina_events_1pd',
      'conflict_events.viina_control',
    ],
  },
];

function SourceCard({ source, highlighted }: { source: DataSource; highlighted: boolean }) {
  return (
    <div className={`source-card ${highlighted ? 'highlighted' : ''}`} id={`source-${source.id}`}>
      <div className="source-header">
        <h3>{source.name}</h3>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-link">
          Visit Source
        </a>
      </div>
      <p className="source-fullname">{source.fullName}</p>
      <p className="source-description">{source.description}</p>

      <div className="source-meta">
        <div className="meta-item">
          <span className="meta-label">Date Range</span>
          <span className="meta-value">{source.dateRange}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Records</span>
          <span className="meta-value">{source.records}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Resolution</span>
          <span className="meta-value">{source.spatialResolution}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Updates</span>
          <span className="meta-value">{source.updateFrequency}</span>
        </div>
      </div>

      <div className="source-details">
        <div className="detail-section">
          <h4>Strengths</h4>
          <ul>
            {source.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="detail-section">
          <h4>Limitations</h4>
          <ul>
            {source.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="source-tables">
        <span className="tables-label">Database Tables:</span>
        {source.tables.map((t, i) => (
          <code key={i} className="table-name">{t}</code>
        ))}
      </div>
    </div>
  );
}

export default function SourcesTab() {
  const [highlightedSource, setHighlightedSource] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      // Handle both #source-{id} and #sources-{id} formats
      let sourceId: string | null = null;
      if (hash.startsWith('#sources-')) {
        sourceId = hash.replace('#sources-', '');
      } else if (hash.startsWith('#source-')) {
        sourceId = hash.replace('#source-', '');
      }

      if (sourceId) {
        setHighlightedSource(sourceId);
        // Scroll to the source card
        const element = document.getElementById(`source-${sourceId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightedSource(null), 3000);
      }
    };

    // Check on mount
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="sources-tab">
      <div className="sources-intro">
        <h2>Data Sources</h2>
        <p>
          This dashboard integrates data from {DATA_SOURCES.length} primary sources covering conflict events,
          territorial control, aerial assaults, equipment losses, casualties, and humanitarian indicators.
          All data is stored in a unified PostgreSQL database with PostGIS spatial extensions.
        </p>
        <div className="sources-summary">
          <div className="summary-stat">
            <span className="stat-value">52M+</span>
            <span className="stat-label">Total Records</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">48</span>
            <span className="stat-label">Database Tables</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">8</span>
            <span className="stat-label">Schemas</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">7.2 GB</span>
            <span className="stat-label">Database Size</span>
          </div>
        </div>
      </div>

      <div className="sources-grid">
        {DATA_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} highlighted={highlightedSource === source.id} />
        ))}
      </div>

      <div className="sources-footer">
        <h3>Cross-Dataset Analysis</h3>
        <p>
          The database includes standardized views (v_std_*) that normalize column names across datasets,
          enabling cross-dataset queries. The v_unified_timeline view provides a single interface to
          query all conflict events regardless of source.
        </p>
        <p>
          <strong>Connection:</strong>{' '}
          <code>postgresql://postgres:***@138.201.62.161:5432/war_datasets</code>
        </p>
      </div>
    </div>
  );
}
