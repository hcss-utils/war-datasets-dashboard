import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadKielAidByDonor, loadKielAidDonorTimeline, loadSipriExpenditure, loadWorldBankGDP } from '../../data/newLoader';
import type { KielAidByDonor, KielAidDonorTimeline, SipriExpenditure, WorldBankGDP } from '../../types';
import InfoModal from '../InfoModal';

const fmt = (n: number) => n.toLocaleString();
const fmtB = (n: number) => `${(n / 1e9).toFixed(1)}B`;

const SOURCE_ID_MAP: Record<string, string> = {
  'Kiel Institute': 'kiel',
  'SIPRI': 'sipri',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const AID_TYPE_COLORS: Record<string, string> = {
  Military: '#ef4444',
  Financial: '#3b82f6',
  Humanitarian: '#22c55e',
};

// Dynamic color palette for SIPRI countries
const SIPRI_COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6',
  '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#f43f5e',
  '#a855f7', '#84cc16', '#0ea5e9', '#d946ef', '#fb923c',
  '#64748b', '#2dd4bf', '#c084fc', '#fbbf24', '#4ade80',
  '#f472b6', '#38bdf8', '#a3e635', '#e879f9', '#34d399',
  '#facc15', '#60a5fa', '#fb7185', '#818cf8', '#2563eb',
  '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0891b2',
  '#ca8a04', '#db2777', '#0d9488', '#e11d48', '#9333ea',
  '#65a30d', '#0284c7', '#c026d3', '#f59e0b', '#10b981',
];

// Fixed colors for key countries
const SIPRI_FIXED_COLORS: Record<string, string> = {
  'Europe (All)': '#3b82f6',
  'United States': '#ef4444',
  Russia: '#f97316',
  Ukraine: '#facc15',
  China: '#22c55e',
};

function getSipriColor(country: string, index: number): string {
  return SIPRI_FIXED_COLORS[country] || SIPRI_COLOR_PALETTE[index % SIPRI_COLOR_PALETTE.length];
}

// EU institutions that have no SIPRI data
const EU_INSTITUTIONS = new Set(['EU (Commission and Council)', 'European Investment Bank', 'European Peace Facility']);

const darkLayout = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#b0b0b0', size: 11 },
  margin: { l: 60, r: 20, t: 40, b: 80 },
  xaxis: {
    gridcolor: '#333',
    linecolor: '#333',
    tickangle: -45,
  },
  yaxis: {
    gridcolor: '#333',
    linecolor: '#333',
  },
  legend: {
    bgcolor: 'transparent',
    font: { color: '#fff', size: 10 },
    itemclick: 'toggleothers' as const,
    itemdoubleclick: 'toggle' as const,
  },
  hoverlabel: {
    bgcolor: '#1a1a2e',
    bordercolor: '#333',
    font: { color: '#fff', size: 12 },
  },
  dragmode: 'zoom' as const,
  hovermode: 'x unified' as const,
};

const plotConfig = { displayModeBar: true, displaylogo: false, responsive: true };

function AidTimelineInfo() {
  return (
    <InfoModal title="Understanding Aid Timeline">
      <p>
        Data from the <strong>Kiel Institute for the World Economy</strong>'s Ukraine Support Tracker,
        which systematically tracks bilateral aid commitments from governments worldwide.
      </p>
      <h4>Aid Categories:</h4>
      <ul>
        <li><strong>Military</strong> - Weapons, ammunition, training, intelligence</li>
        <li><strong>Financial</strong> - Budget support, loans, guarantees, macro-financial assistance</li>
        <li><strong>Humanitarian</strong> - Food, shelter, medical aid, refugee support</li>
      </ul>
      <h4>Important Notes:</h4>
      <ul>
        <li>Values show <strong>commitments</strong>, not necessarily disbursed amounts</li>
        <li>All values converted to EUR for comparability</li>
        <li>Some commitments span multiple months (allocated to announcement month)</li>
      </ul>
    </InfoModal>
  );
}

function SipriInfo() {
  return (
    <InfoModal title="Understanding Military Expenditure">
      <p>
        Data from the <strong>Stockholm International Peace Research Institute (SIPRI)</strong>,
        which tracks military expenditure globally using consistent methodology.
      </p>
      <h4>What's Included:</h4>
      <ul>
        <li>Armed forces personnel and operations</li>
        <li>Weapons procurement and R&D</li>
        <li>Military construction and infrastructure</li>
        <li>Paramilitary forces (when under military command)</li>
      </ul>
      <h4>Methodology:</h4>
      <ul>
        <li>Values in constant 2022 USD (millions) for comparability</li>
        <li>Based on open-source government budget data</li>
        <li>Russia data may undercount due to off-budget spending</li>
      </ul>
    </InfoModal>
  );
}

interface AidDeliveriesSubtabProps {
  selectedDonors: Set<string>;
  selectedAidTypes: Set<string>;
}

export default function AidDeliveriesSubtab({
  selectedDonors,
  selectedAidTypes,
}: AidDeliveriesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [aidByDonor, setAidByDonor] = useState<KielAidByDonor[]>([]);
  const [donorTimeline, setDonorTimeline] = useState<KielAidDonorTimeline[]>([]);
  const [sipri, setSipri] = useState<SipriExpenditure[]>([]);
  const [gdpData, setGdpData] = useState<WorldBankGDP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sipriMode, setSipriMode] = useState<'absolute' | 'gdp_share' | 'gdp_pct'>('absolute');

  useEffect(() => {
    Promise.all([loadKielAidByDonor(), loadKielAidDonorTimeline(), loadSipriExpenditure(), loadWorldBankGDP()])
      .then(([donors, timeline, expenditure, gdp]) => {
        setAidByDonor(donors);
        setDonorTimeline(timeline);
        setSipri(expenditure);
        setGdpData(gdp);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter donor timeline by BOTH selected donors AND selected aid types
  const filteredTimeline = useMemo(() => {
    // Filter by both donors and aid types, then aggregate by month+type
    const filtered = donorTimeline.filter(
      d => selectedDonors.has(d.donor) && selectedAidTypes.has(d.aid_type_general.trim())
    );
    // Aggregate: group by (month, aid_type_general) → sum commitments + total_eur
    const agg = new Map<string, { month: string; aid_type_general: string; commitments: number; total_eur: number }>();
    for (const d of filtered) {
      const key = `${d.month}|${d.aid_type_general.trim()}`;
      const existing = agg.get(key);
      if (existing) {
        existing.commitments += d.commitments;
        existing.total_eur += d.total_eur;
      } else {
        agg.set(key, { month: d.month, aid_type_general: d.aid_type_general.trim(), commitments: d.commitments, total_eur: d.total_eur });
      }
    }
    return [...agg.values()];
  }, [donorTimeline, selectedDonors, selectedAidTypes]);

  // Filter donors by both country and type
  const filteredDonors = useMemo(() => {
    return aidByDonor.filter(
      d => selectedDonors.has(d.donor) && selectedAidTypes.has(d.aid_type_general.trim())
    );
  }, [aidByDonor, selectedDonors, selectedAidTypes]);

  // Filter SIPRI by selected donors (skip EU institutions, always include Russia+Ukraine)
  const filteredSipri = useMemo(() => {
    const sipriDonors = new Set<string>();
    for (const d of selectedDonors) {
      if (!EU_INSTITUTIONS.has(d)) sipriDonors.add(d);
    }
    // Always include Russia and Ukraine as reference countries
    sipriDonors.add('Russia');
    sipriDonors.add('Ukraine');
    return sipri.filter(d => sipriDonors.has(d.country));
  }, [sipri, selectedDonors]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading aid & expenditure data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load aid data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Compute stats from filtered data
  const totalAid = filteredDonors.reduce((s, d) => s + d.total_eur, 0);
  const totalCommitments = filteredDonors.reduce((s, d) => s + d.commitments, 0);
  const totalMilitary = filteredDonors
    .filter(d => d.aid_type_general.trim() === 'Military')
    .reduce((s, d) => s + d.total_eur, 0);
  const totalFinancial = filteredDonors
    .filter(d => d.aid_type_general.trim() === 'Financial')
    .reduce((s, d) => s + d.total_eur, 0);
  const totalHumanitarian = filteredDonors
    .filter(d => d.aid_type_general.trim() === 'Humanitarian')
    .reduce((s, d) => s + d.total_eur, 0);
  const donorCount = new Set(filteredDonors.map(d => d.donor)).size;

  // Monthly timeline: pivot by aid type for stacked area
  const months = [...new Set(filteredTimeline.map(d => d.month))].sort();
  const aidTypes = [...selectedAidTypes].sort();

  // Monthly stacked data traces
  const timelineTraces = aidTypes.map(type => {
    const typeData = filteredTimeline.filter(d => d.aid_type_general.trim() === type);
    const byMonth = new Map(typeData.map(d => [d.month, d.total_eur]));
    return {
      x: months,
      y: months.map(m => (byMonth.get(m) || 0) / 1e9),
      type: 'bar' as const,
      name: type,
      marker: { color: AID_TYPE_COLORS[type] || '#999' },
      hovertemplate: `${type}<br>%{x}<br>%{y:.1f}B EUR<extra></extra>`,
      hoverlabel: { font: { color: '#fff' } },
    };
  });

  // Cumulative timeline traces
  const cumulativeTraces = aidTypes.map(type => {
    const typeData = filteredTimeline.filter(d => d.aid_type_general.trim() === type);
    const byMonth = new Map(typeData.map(d => [d.month, d.total_eur]));
    let cumulative = 0;
    const cumValues = months.map(m => {
      cumulative += (byMonth.get(m) || 0) / 1e9;
      return cumulative;
    });
    return {
      x: months,
      y: cumValues,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: type,
      line: { color: AID_TYPE_COLORS[type] || '#999', width: 2 },
      fill: 'tonexty' as const,
      fillcolor: (AID_TYPE_COLORS[type] || '#999').replace(')', ', 0.2)').replace('rgb', 'rgba'),
      stackgroup: 'cumulative',
      hovertemplate: `${type}<br>%{x}<br>%{y:.1f}B EUR cumulative<extra></extra>`,
      hoverlabel: { font: { color: '#fff' } },
    };
  });

  // Top donors bar chart: aggregate by donor across selected types
  const donorTotals = new Map<string, Record<string, number>>();
  for (const d of filteredDonors) {
    const existing = donorTotals.get(d.donor) || {};
    existing[d.aid_type_general.trim()] = (existing[d.aid_type_general.trim()] || 0) + d.total_eur;
    donorTotals.set(d.donor, existing);
  }
  const donorSorted = [...donorTotals.entries()]
    .map(([donor, types]) => ({
      donor,
      total: Object.values(types).reduce((a, b) => a + b, 0),
      ...types,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const donorBarTraces = aidTypes.map(type => ({
    y: donorSorted.map(d => d.donor),
    x: donorSorted.map(d => ((d as any)[type] || 0) / 1e9),
    type: 'bar' as const,
    orientation: 'h' as const,
    name: type,
    marker: { color: AID_TYPE_COLORS[type] || '#999' },
    hovertemplate: `%{y}<br>${type}: %{x:.1f}B EUR<extra></extra>`,
    hoverlabel: { font: { color: '#fff' } },
  }));

  // Commitments count by donor
  const donorCommitmentTotals = new Map<string, number>();
  for (const d of filteredDonors) {
    donorCommitmentTotals.set(d.donor, (donorCommitmentTotals.get(d.donor) || 0) + d.commitments);
  }
  const commitmentSorted = [...donorCommitmentTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // SIPRI expenditure traces (post-2000 for relevance)
  const sipriCountries = [...new Set(filteredSipri.map(d => d.country))].sort((a, b) => {
    // Europe (All) first, United States second, Russia third, Ukraine fourth, rest alphabetical
    const order = ['Europe (All)', 'United States', 'Russia', 'Ukraine'];
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  // Build GDP lookup: country+year -> gdp_current_usd
  const gdpLookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gdpData) {
      m.set(`${g.country}|${g.year}`, g.gdp_current_usd);
    }
    return m;
  }, [gdpData]);

  const sipriTraces = sipriCountries.map((country, idx) => {
    const countryData = filteredSipri
      .filter(d => d.country === country && d.year >= 2000)
      .sort((a, b) => a.year - b.year);
    if (sipriMode === 'gdp_share') {
      return {
        x: countryData.map(d => d.year),
        y: countryData.map(d => d.gdp_share ?? null),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: country,
        line: { color: getSipriColor(country, idx), width: 2 },
        connectgaps: true,
        hovertemplate: `${country}<br>%{x}<br>%{y:.2f}% of GDP<extra></extra>`,
        hoverlabel: { font: { color: '#fff' } },
      };
    }
    if (sipriMode === 'gdp_pct') {
      // Normalize by World Bank GDP: (milex_usd_millions * 1e6) / gdp_current_usd * 100
      return {
        x: countryData.map(d => d.year),
        y: countryData.map(d => {
          const gdp = gdpLookup.get(`${country}|${d.year}`);
          if (!gdp || gdp === 0) return null;
          return (d.expenditure_usd * 1e6 / gdp) * 100;
        }),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: country,
        line: { color: getSipriColor(country, idx), width: 2 },
        connectgaps: true,
        hovertemplate: `${country}<br>%{x}<br>%{y:.2f}% of GDP (WB)<extra></extra>`,
        hoverlabel: { font: { color: '#fff' } },
      };
    }
    return {
      x: countryData.map(d => d.year),
      y: countryData.map(d => d.expenditure_usd / 1e3),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: country,
      line: { color: getSipriColor(country, idx), width: 2 },
      hovertemplate: `${country}<br>%{x}<br>$%{y:.1f}B USD<extra></extra>`,
      hoverlabel: { font: { color: '#fff' } },
    };
  });

  return (
    <div className="conflict-subtab">
      <h2>Aid & Military Expenditure</h2>
      <p className="tab-subtitle">
        International aid commitments to Ukraine and global military spending trends
        {selectedAidTypes.size < 3 && (
          <span style={{ color: 'var(--color-accent)', marginLeft: 8 }}>
            (Aid types: {[...selectedAidTypes].join(', ')})
          </span>
        )}
        {selectedDonors.size < 26 && (
          <span style={{ color: 'var(--color-accent)', marginLeft: 8 }}>
            ({selectedDonors.size} donor{selectedDonors.size !== 1 ? 's' : ''} selected)
          </span>
        )}
      </p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card highlight-blue">
          <span className="stat-value">{fmtB(totalAid)} EUR</span>
          <span className="stat-label">Total Aid</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(totalCommitments)}</span>
          <span className="stat-label">Commitments</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{donorCount}</span>
          <span className="stat-label">Donors</span>
        </div>
        {selectedAidTypes.has('Military') && (
          <div className="stat-card highlight-red">
            <span className="stat-value">{fmtB(totalMilitary)}</span>
            <span className="stat-label">Military</span>
          </div>
        )}
        {selectedAidTypes.has('Financial') && (
          <div className="stat-card">
            <span className="stat-value">{fmtB(totalFinancial)}</span>
            <span className="stat-label">Financial</span>
          </div>
        )}
        {selectedAidTypes.has('Humanitarian') && (
          <div className="stat-card highlight-green">
            <span className="stat-value">{fmtB(totalHumanitarian)}</span>
            <span className="stat-label">Humanitarian</span>
          </div>
        )}
      </div>

      {/* Monthly Aid Timeline - Stacked Bar */}
      <div className="chart-card">
        <h3>Monthly Aid Commitments by Type <SourceLink source="Kiel Institute" /> <AidTimelineInfo /></h3>
        <p className="chart-note">Monthly committed aid (EUR billions). Drag to zoom.</p>
        <Plot
          data={timelineTraces}
          layout={{
            ...darkLayout,
            height: 350,
            barmode: 'stack',
            xaxis: {
              ...darkLayout.xaxis,
              ...(xaxisRange ? { range: xaxisRange } : {}),
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: { ...darkLayout.yaxis, title: { text: 'EUR (billions)', standoff: 10 } },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
          onRelayout={onRelayout}
        />
      </div>

      {/* Cumulative Aid Timeline */}
      <div className="chart-card">
        <h3>Cumulative Aid Commitments <SourceLink source="Kiel Institute" /></h3>
        <p className="chart-note">Running total of committed aid (EUR billions).</p>
        <Plot
          data={cumulativeTraces}
          layout={{
            ...darkLayout,
            height: 350,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: { ...darkLayout.yaxis, title: { text: 'EUR (billions, cumulative)', standoff: 10 } },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Top Donors */}
        <div className="chart-card">
          <h3>Top Donors by Value <SourceLink source="Kiel Institute" /></h3>
          <Plot
            data={donorBarTraces}
            layout={{
              ...darkLayout,
              height: Math.max(400, donorSorted.length * 28),
              barmode: 'stack',
              margin: { l: 180, r: 60, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, title: { text: 'EUR (billions)', standoff: 10 } },
              yaxis: { ...darkLayout.yaxis, autorange: 'reversed' as const },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.05 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Top Donors by Commitments */}
        <div className="chart-card">
          <h3>Top Donors by Commitment Count <SourceLink source="Kiel Institute" /></h3>
          <Plot
            data={[
              {
                y: commitmentSorted.map(([d]) => d),
                x: commitmentSorted.map(([, c]) => c),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: { color: '#8b5cf6' },
                text: commitmentSorted.map(([, c]) => fmt(c)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 9 },
                hovertemplate: '%{y}<br>%{x} commitments<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: Math.max(400, commitmentSorted.length * 28),
              margin: { l: 180, r: 80, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, tickformat: ',' },
              yaxis: { ...darkLayout.yaxis, autorange: 'reversed' as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* SIPRI Military Expenditure */}
      {sipriTraces.length > 0 && (
        <div className="chart-card">
          <h3>
            Military Expenditure (2000-2024) <SourceLink source="SIPRI" /> <SipriInfo />
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
            <p className="chart-note" style={{ margin: 0 }}>
              {sipriMode === 'absolute' && 'Constant 2022 USD (billions). Russia & Ukraine always shown.'}
              {sipriMode === 'gdp_share' && 'SIPRI % of GDP. Russia & Ukraine always shown.'}
              {sipriMode === 'gdp_pct' && 'MilEx / GDP (World Bank, current USD). Russia & Ukraine always shown.'}
            </p>
            <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#b0b0b0' }}>
              {([
                ['absolute', 'USD'],
                ['gdp_share', '% GDP (SIPRI)'],
                ['gdp_pct', '% GDP (World Bank)'],
              ] as const).map(([mode, label]) => (
                <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="sipriMode"
                    checked={sipriMode === mode}
                    onChange={() => setSipriMode(mode)}
                    style={{ cursor: 'pointer' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Plot
            data={sipriTraces}
            layout={{
              ...darkLayout,
              height: 400,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
                dtick: 2,
              },
              yaxis: {
                ...darkLayout.yaxis,
                title: {
                  text: sipriMode === 'absolute' ? 'USD (billions, 2022)' : '% of GDP',
                  standoff: 10,
                },
              },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Europe (All) vs United States Comparison */}
      <EuropeVsUsaComparison donorTimeline={donorTimeline} sipri={sipri} gdpData={gdpData} />
    </div>
  );
}

/* ─── Europe vs USA Comparison Section ─── */
function EuropeVsUsaComparison({
  donorTimeline,
  sipri,
  gdpData,
}: {
  donorTimeline: KielAidDonorTimeline[];
  sipri: SipriExpenditure[];
  gdpData: WorldBankGDP[];
}) {
  // Aid comparison: Europe (All) vs United States by type over time
  const entities = ['Europe (All)', 'United States'] as const;
  const aidTypes = ['Military', 'Financial', 'Humanitarian'] as const;
  const entityColors = { 'Europe (All)': '#3b82f6', 'United States': '#ef4444' };

  const aidMonths = [...new Set(donorTimeline.filter(d => entities.includes(d.donor as any)).map(d => d.month))].sort();

  const aidTraces = entities.flatMap(entity =>
    aidTypes.map(type => {
      const data = donorTimeline.filter(d => d.donor === entity && d.aid_type_general.trim() === type);
      const byMonth = new Map(data.map(d => [d.month, d.total_eur]));
      const baseColor = entityColors[entity];
      const opacity = type === 'Military' ? 1 : type === 'Financial' ? 0.7 : 0.4;
      return {
        x: aidMonths,
        y: aidMonths.map(m => (byMonth.get(m) || 0) / 1e9),
        type: 'bar' as const,
        name: `${entity} — ${type}`,
        marker: { color: baseColor, opacity },
        hovertemplate: `${entity}<br>${type}<br>%{x}<br>%{y:.2f}B EUR<extra></extra>`,
        hoverlabel: { font: { color: '#fff' } },
      };
    })
  );

  // SIPRI comparison
  const sipriData = sipri.filter(d => (d.country === 'Europe (All)' || d.country === 'United States') && d.year >= 2000);
  const sipriTraces = entities.map(entity => {
    const data = sipriData.filter(d => d.country === entity).sort((a, b) => a.year - b.year);
    return {
      x: data.map(d => d.year),
      y: data.map(d => d.expenditure_usd / 1e3),
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: entity,
      line: { color: entityColors[entity], width: 3 },
      marker: { size: 5 },
      hovertemplate: `${entity}<br>%{x}<br>$%{y:.0f}B USD<extra></extra>`,
      hoverlabel: { font: { color: '#fff' } },
    };
  });

  // MilEx as % of GDP comparison
  const gdpLookup = new Map<string, number>();
  for (const g of gdpData) {
    gdpLookup.set(`${g.country}|${g.year}`, g.gdp_current_usd);
  }
  const milexGdpTraces = entities.map(entity => {
    const data = sipriData.filter(d => d.country === entity).sort((a, b) => a.year - b.year);
    return {
      x: data.map(d => d.year),
      y: data.map(d => {
        const gdp = gdpLookup.get(`${entity}|${d.year}`);
        if (!gdp || gdp === 0) return null;
        return (d.expenditure_usd * 1e6 / gdp) * 100;
      }),
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: entity,
      line: { color: entityColors[entity], width: 3 },
      marker: { size: 5 },
      connectgaps: true,
      hovertemplate: `${entity}<br>%{x}<br>%{y:.2f}% of GDP<extra></extra>`,
      hoverlabel: { font: { color: '#fff' } },
    };
  });

  return (
    <>
      <h3 style={{ marginTop: 32, color: '#e0e0e0', borderBottom: '1px solid #333', paddingBottom: 8 }}>
        Europe vs United States Comparison
      </h3>

      <div className="chart-grid-2">
        {/* Aid Comparison */}
        <div className="chart-card">
          <h3>Aid to Ukraine: Europe vs USA <SourceLink source="Kiel Institute" /></h3>
          <p className="chart-note">Monthly committed aid by type (EUR billions)</p>
          <Plot
            data={aidTraces}
            layout={{
              ...darkLayout,
              height: 400,
              barmode: 'group',
              xaxis: { ...darkLayout.xaxis },
              yaxis: { ...darkLayout.yaxis, title: { text: 'EUR (billions)', standoff: 10 } },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.2, font: { color: '#fff', size: 9 } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Military Expenditure Comparison */}
        <div className="chart-card">
          <h3>Military Spending: Europe vs USA <SourceLink source="SIPRI" /></h3>
          <p className="chart-note">Total military expenditure (constant 2022 USD, billions)</p>
          <Plot
            data={sipriTraces}
            layout={{
              ...darkLayout,
              height: 400,
              xaxis: { ...darkLayout.xaxis, dtick: 2 },
              yaxis: { ...darkLayout.yaxis, title: { text: 'USD (billions, 2022)', standoff: 10 } },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* MilEx as % of GDP */}
      <div className="chart-card">
        <h3>Military Spending as % of GDP: Europe vs USA <SourceLink source="SIPRI" /> / World Bank</h3>
        <p className="chart-note">SIPRI military expenditure divided by World Bank GDP (current USD)</p>
        <Plot
          data={milexGdpTraces}
          layout={{
            ...darkLayout,
            height: 350,
            xaxis: { ...darkLayout.xaxis, dtick: 2 },
            yaxis: { ...darkLayout.yaxis, title: { text: '% of GDP', standoff: 10 } },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>
    </>
  );
}
