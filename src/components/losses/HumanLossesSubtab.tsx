import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadPersonnelDaily, loadKIUOfficersSummary, loadMilitaryCasualties } from '../../data/newLoader';
import type { MilitaryCasualties } from '../../data/newLoader';
import type { PersonnelDaily, KIUOfficersSummary } from '../../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'Ukraine MOD': 'equipment',
  'KIU': 'kiu',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

type CountryCode = 'ua' | 'ru';

const COUNTRY_NAMES: Record<CountryCode, string> = {
  ua: 'Ukraine',
  ru: 'Russia',
};

const FlagBadge = ({ country }: { country: CountryCode }) => (
  <span
    className={`country-flag country-flag-${country}`}
    role="img"
    aria-label={`${COUNTRY_NAMES[country]} flag`}
  />
);

const FlaggedLabel = ({ country, children }: { country: CountryCode; children: React.ReactNode }) => (
  <span className="label-with-flag">
    <FlagBadge country={country} />
    <span>{children}</span>
  </span>
);

// Plotly dark theme layout base
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

interface HumanLossesSubtabProps {
  selectedViews: Set<string>;
}

export default function HumanLossesSubtab({ selectedViews }: HumanLossesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [personnel, setPersonnel] = useState<PersonnelDaily[]>([]);
  const [officers, setOfficers] = useState<KIUOfficersSummary | null>(null);
  const [military, setMilitary] = useState<MilitaryCasualties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadPersonnelDaily(), loadKIUOfficersSummary()])
      .then(([pers, off]) => {
        setPersonnel(pers);
        setOfficers(off);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // Named, per-soldier casualty rosters — resilient (won't break the subtab if the JSON is absent)
    loadMilitaryCasualties().then(setMilitary).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading human losses data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load human losses data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const latestPersonnel = personnel[personnel.length - 1];

  // Calculate daily losses
  const dailyPersonnel = personnel.slice(1).map((d, i) => {
    const prev = personnel[i];
    return {
      date: d.date,
      daily_loss: d.personnel - prev.personnel,
      cumulative: d.personnel,
    };
  });

  // 7-day rolling average
  const rollingData = dailyPersonnel.map((d, i, arr) => {
    const window = arr.slice(Math.max(0, i - 6), i + 1);
    const avgLoss = window.reduce((s, x) => s + x.daily_loss, 0) / window.length;
    return {
      ...d,
      avg_loss: Math.round(avgLoss),
    };
  });

  // Officers breakdown for pie chart
  const officerData = officers ? [
    { label: 'Senior Officers', value: officers.senior_officers, color: '#ef4444' },
    { label: 'Junior Officers', value: officers.junior_officers, color: '#f97316' },
    { label: 'Other', value: officers.other, color: '#eab308' },
  ] : [];

  const showCumulative = selectedViews.has('cumulative');
  const showDaily = selectedViews.has('daily');

  return (
    <div className="conflict-subtab">
      <h2>Russian Human Losses</h2>
      <p className="tab-subtitle">Personnel and officer casualties from Ukrainian Ministry of Defense and KIU</p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card highlight-red">
          <span className="stat-value">{fmt(latestPersonnel?.personnel || 0)}</span>
          <span className="stat-label">Total Personnel</span>
        </div>
        {officers && (
          <>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.total_officers)}</span>
              <span className="stat-label">Officers (KIU)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.senior_officers)}</span>
              <span className="stat-label">Senior Officers</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.junior_officers)}</span>
              <span className="stat-label">Junior Officers</span>
            </div>
          </>
        )}
      </div>

      {showCumulative && (
        <div className="chart-card">
          <h3>Cumulative Personnel Losses <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: personnel.map(d => d.date),
                y: personnel.map(d => d.personnel),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Cumulative Losses',
                line: { color: '#ef4444', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(239, 68, 68, 0.2)',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 350,
              xaxis: {
                ...darkLayout.xaxis,
                ...(xaxisRange ? { range: xaxisRange } : {}),
                rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
              yaxis: {
                ...darkLayout.yaxis,
                tickformat: ',',
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
            onRelayout={onRelayout}
          />
        </div>
      )}

      {showDaily && (
        <div className="chart-card">
          <h3>Daily Personnel Losses (7-day Rolling Average) <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: rollingData.map(d => d.date),
                y: rollingData.map(d => d.daily_loss),
                type: 'bar' as const,
                name: 'Daily Losses',
                marker: { color: 'rgba(239, 68, 68, 0.5)' },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: rollingData.map(d => d.date),
                y: rollingData.map(d => d.avg_loss),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: '7-day Average',
                line: { color: '#ef4444', width: 2 },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 350,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {officers && (
        <div className="chart-grid-2">
          <div className="chart-card">
            <h3>Officers by Rank Category <SourceLink source="KIU" /></h3>
            <Plot
              data={[
                {
                  values: officerData.map(d => d.value),
                  labels: officerData.map(d => d.label),
                  type: 'pie' as const,
                  marker: { colors: officerData.map(d => d.color) },
                  textinfo: 'label+percent',
                  textposition: 'outside',
                  hovertemplate: '%{label}: %{value:,}<extra></extra>',
                  hoverlabel: { font: { color: '#fff' } },
                },
              ]}
              layout={{
                ...darkLayout,
                height: 300,
                margin: { l: 20, r: 20, t: 20, b: 20 },
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="chart-card">
            <h3>Officers Breakdown <SourceLink source="KIU" /></h3>
            <Plot
              data={[
                {
                  x: officerData.map(d => d.label),
                  y: officerData.map(d => d.value),
                  type: 'bar' as const,
                  marker: { color: officerData.map(d => d.color) },
                  text: officerData.map(d => fmt(d.value)),
                  textposition: 'outside' as const,
                  textfont: { color: '#b0b0b0', size: 11 },
                  hovertemplate: '%{x}: %{y:,}<extra></extra>',
                  hoverlabel: { font: { color: '#fff' } },
                },
              ]}
              layout={{
                ...darkLayout,
                height: 300,
                margin: { l: 60, r: 30, t: 20, b: 70 },
                xaxis: {
                  ...darkLayout.xaxis,
                  type: 'category' as const,
                  tickangle: -20,
                },
                yaxis: {
                  ...darkLayout.yaxis,
                  tickformat: ',',
                  range: [0, Math.max(...officerData.map(d => d.value)) * 1.18],
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {military && (
        <div className="military-casualties" style={{ marginTop: '2.5rem', borderTop: '1px solid #22304d', paddingTop: '1.5rem' }}>
          <h3>Named &amp; individually verified casualties</h3>
          <p className="tab-subtitle" style={{ marginTop: '-0.4rem' }}>
            Per-soldier, obituary-verified rosters — complementing the claimed/aggregate figures above.
            <strong> UA</strong> (UALosses) has per-record death dates &rarr; a real loss curve.
            <strong> RU</strong> (Mediazona/BBC) is a names/age/geography roster — its source has
            <em> no per-record death date</em>, so there is intentionally no RU loss curve (we do not fabricate one).
          </p>

          <div className="stat-cards conflict-stats">
            <div className="stat-card highlight-red">
              <span className="stat-value">{fmt(military.ualosses.confirmed_kia_total)}</span>
              <span className="stat-label">
                <FlaggedLabel country="ua">UA confirmed KIA (UALosses, named)</FlaggedLabel>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-value">&ge;{fmt(military.mediazona.total)}</span>
              <span className="stat-label">
                <FlaggedLabel country="ru">RU named killed (Mediazona) — a floor, no dates</FlaggedLabel>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-value">~{military.mediazona.probate_estimate ? fmt(military.mediazona.probate_estimate) : 'N/A'}</span>
              <span className="stat-label">
                <FlaggedLabel country="ru">RU est. toll (Probate Registry)</FlaggedLabel>
              </span>
            </div>
          </div>

          {military.mediazona.coverage_note && (
            <p className="chart-note" style={{ marginTop: '0.6rem', opacity: 0.85 }}>
              ⓘ RU named ({fmt(military.mediazona.total)}, mean age {military.mediazona.mean_age}) is a{' '}
              <strong>floor — Mediazona estimate it captures ~{military.mediazona.coverage_pct_range?.[0]}–
              {military.mediazona.coverage_pct_range?.[1]}%</strong> of the real toll; the fuller figure is the
              ~{military.mediazona.probate_estimate ? fmt(military.mediazona.probate_estimate) : ''} Probate-Registry
              estimate. No per-record death dates are published (volunteer security + lag-skewed timing).
            </p>
          )}

          {military.ualosses.monthly_kia.length > 0 && (
            <div className="chart-container" style={{ marginTop: '1rem' }}>
              <Plot
                data={[{
                  type: 'scatter', mode: 'lines', x: military.ualosses.monthly_kia.map((m) => m.month),
                  y: military.ualosses.monthly_kia.map((m) => m.kia),
                  line: { color: '#4da3ff', width: 2 }, fill: 'tozeroy',
                  fillcolor: 'rgba(77,163,255,0.15)', name: 'UA confirmed KIA',
                } as any]}
                layout={{
                  ...darkLayout,
                  title: 'Ukrainian confirmed KIA by month (UALosses, day-precision death dates)',
                  height: 340, margin: { t: 50, r: 20, b: 50, l: 60 },
                  yaxis: { ...darkLayout.yaxis, title: 'KIA / month' },
                } as any}
                config={{ displayModeBar: false, responsive: true } as any}
                style={{ width: '100%' }}
                onRelayout={onRelayout}
              />
              {military.ualosses.lag_note && (
                <p className="chart-note" style={{ opacity: 0.85 }}>⚠️ {military.ualosses.lag_note}</p>
              )}
            </div>
          )}

          {military.ucdp && military.ucdp.monthly.length > 0 && (
            <div className="chart-container" style={{ marginTop: '1.25rem' }}>
              <Plot
                data={[
                  { type: 'scatter', mode: 'lines', name: 'RU forces', x: military.ucdp.monthly.map((m) => m.month), y: military.ucdp.monthly.map((m) => m.ru_deaths), line: { color: '#ef4444', width: 2 } } as any,
                  { type: 'scatter', mode: 'lines', name: 'UA forces', x: military.ucdp.monthly.map((m) => m.month), y: military.ucdp.monthly.map((m) => m.ua_deaths), line: { color: '#4da3ff', width: 2 } } as any,
                  { type: 'scatter', mode: 'lines', name: 'Civilians', x: military.ucdp.monthly.map((m) => m.month), y: military.ucdp.monthly.map((m) => m.civilian_deaths), line: { color: '#eab308', width: 1.5, dash: 'dot' } } as any,
                ]}
                layout={{ ...darkLayout, title: 'Dated fatalities by month, both sides (UCDP GED — event-verified)', height: 360, margin: { t: 50, r: 20, b: 50, l: 60 }, yaxis: { ...darkLayout.yaxis, title: 'Deaths / month' } } as any}
                config={{ displayModeBar: false, responsive: true } as any}
                style={{ width: '100%' }}
                onRelayout={onRelayout}
              />
              <p className="chart-note" style={{ opacity: 0.85 }}>
                ⓘ The only <strong>dated, both-sides</strong> fatality series (fills the RU-timeline gap — Mediazona
                publishes no per-record dates). UCDP totals over the war: RU {fmt(military.ucdp.totals.ru)} ·
                UA {fmt(military.ucdp.totals.ua)} · civilian {fmt(military.ucdp.totals.civilian)}.
                These are <strong>event-verified CONSERVATIVE</strong> counts — well below the named/claimed figures
                above; use them for timing &amp; the RU/UA split, not absolute magnitude.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ flex: '1 1 280px' }}>
              <h4 className="section-title-with-flag" style={{ marginBottom: '0.4rem' }}>
                <FlaggedLabel country="ua">UA records by status</FlaggedLabel>
              </h4>
              <ul className="region-list">
                {Object.entries(military.ualosses.by_status).map(([s, n]) => (
                  <li key={s} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>{s}</span><strong>{fmt(n)}</strong></li>
                ))}
              </ul>
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <h4 className="section-title-with-flag" style={{ marginBottom: '0.4rem' }}>
                <FlaggedLabel country="ru">RU top home regions (origin)</FlaggedLabel>
              </h4>
              <ul className="region-list">
                {military.mediazona.top_regions.slice(0, 8).map((r) => (
                  <li key={r.region} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>{r.region}</span><strong>{fmt(r.n)}</strong></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
