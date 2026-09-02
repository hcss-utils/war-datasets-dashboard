import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import {
  loadGsdbOverview,
  loadGsdbCasesByYear,
  loadGsdbInstrumentsByYear,
  loadGsdbObjectives,
  loadGsdbFinancialSubtypes,
  loadGsdbTopTargets,
  loadGsdbTopSenders,
  loadGsdbRussia,
} from '../data/newLoader';
import type {
  GsdbOverview,
  GsdbCasesByYear,
  GsdbInstrumentsByYear,
  GsdbNamed,
  GsdbFinancialSubtype,
  GsdbState,
  GsdbRussia,
} from '../data/newLoader';

const fmt = (n: number) => n.toLocaleString();

const INSTRUMENT_LABELS: Record<string, string> = {
  trade: 'Trade',
  financial: 'Financial',
  travel: 'Travel',
  arms: 'Arms embargo',
  military: 'Military-aid ban',
  other: 'Other',
};

const OBJECTIVE_LABELS: Record<string, string> = {
  policy_change: 'Policy change',
  destab_regime: 'Destabilise regime / influence',
  territorial_conflict: 'Territorial conflict (party)',
  prevent_war: 'Prevent war / keep the peace',
  terrorism: 'Counter-terrorism',
  end_war: 'End war',
  human_rights: 'Human rights',
  democracy: 'Restore democracy',
  other: 'Other (crime, corruption)',
};

const SUBTYPE_LABELS: Record<string, string> = {
  asset_freeze: 'Asset freeze',
  financial_services: 'Financial-services ban',
  aid: 'Aid withdrawal',
  investment_restrictions: 'Investment restrictions',
  payment_service_infrastructure: 'Payment infrastructure (e.g. SWIFT)',
  other: 'Other',
};

const INSTRUMENT_COLORS: Record<string, string> = {
  trade: '#3b82f6',
  financial: '#22c55e',
  travel: '#f59e0b',
  arms: '#ef4444',
  military: '#8b5cf6',
  other: '#7f7f7f',
};

const PLOTLY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

const darkLayout = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#b0b0b0', size: 11 },
  margin: { l: 60, r: 20, t: 40, b: 80 },
  xaxis: { gridcolor: '#333', linecolor: '#333' },
  yaxis: { gridcolor: '#333', linecolor: '#333' },
  legend: {
    bgcolor: 'transparent',
    font: { color: '#fff', size: 10 },
    itemclick: 'toggleothers' as const,
    itemdoubleclick: 'toggle' as const,
  },
  hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#333', font: { color: '#fff', size: 12 } },
  hovermode: 'x unified' as const,
};

const plotConfig = { displayModeBar: false, responsive: true };

const SourceLink = () => (
  <a href="#sources-gsdb" className="source-link-inline">(GSDB)</a>
);

function instrumentBars(instr: Record<string, number>, title: string, height = 300) {
  const keys = ['trade', 'financial', 'travel', 'arms', 'military', 'other'];
  return (
    <Plot
      data={[
        {
          type: 'bar' as const,
          orientation: 'h' as const,
          x: keys.map((k) => instr[k] || 0),
          y: keys.map((k) => INSTRUMENT_LABELS[k]),
          marker: { color: keys.map((k) => INSTRUMENT_COLORS[k]) },
          text: keys.map((k) => fmt(instr[k] || 0)),
          textposition: 'outside' as const,
          textfont: { color: '#888', size: 10 },
          hovertemplate: '%{y}: %{x:,} cases<extra></extra>',
        } as any,
      ]}
      layout={{ ...darkLayout, title, height, margin: { l: 130, r: 50, t: 40, b: 40 }, hovermode: 'closest' as const } as any}
      config={plotConfig}
      style={{ width: '100%' }}
    />
  );
}

export default function SanctionsTab() {
  const [overview, setOverview] = useState<GsdbOverview | null>(null);
  const [byYear, setByYear] = useState<GsdbCasesByYear[]>([]);
  const [instrByYear, setInstrByYear] = useState<GsdbInstrumentsByYear[]>([]);
  const [objectives, setObjectives] = useState<GsdbNamed[]>([]);
  const [subtypes, setSubtypes] = useState<GsdbFinancialSubtype[]>([]);
  const [topTargets, setTopTargets] = useState<GsdbState[]>([]);
  const [topSenders, setTopSenders] = useState<GsdbState[]>([]);
  const [russia, setRussia] = useState<GsdbRussia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadGsdbOverview(),
      loadGsdbCasesByYear(),
      loadGsdbInstrumentsByYear(),
      loadGsdbObjectives(),
      loadGsdbFinancialSubtypes(),
      loadGsdbTopTargets(),
      loadGsdbTopSenders(),
      loadGsdbRussia(),
    ])
      .then(([ov, yr, iby, obj, st, tt, ts, ru]) => {
        setOverview(ov);
        setByYear(yr);
        setInstrByYear(iby);
        setObjectives(obj);
        setSubtypes(st);
        setTopTargets(tt);
        setTopSenders(ts);
        setRussia(ru);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading sanctions data...</span>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="error-container">
        <h3>Failed to load sanctions data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const t = overview.totals;

  // instruments-by-year, decade-smoothed is overkill — plot yearly stacked bars from 1990
  const iby = instrByYear.filter((d) => d.year >= 1990);
  const instrKeys = ['trade', 'financial', 'travel', 'arms', 'military', 'other'] as const;

  const objSorted = [...objectives].sort((a, b) => a.cases - b.cases);
  const stSorted = [...subtypes].sort((a, b) => a.cases - b.cases);

  const rusByYear = (russia?.by_year ?? []).filter((d) => d.year >= 1990);

  return (
    <div className="sanctions-tab">
      <h2>Sanctions <SourceLink /></h2>
      <p className="tab-subtitle">
        The Global Sanctions Data Base (GSDB): the universe of {fmt(t.r5_cases)} sanction
        cases, {t.first_year}–{t.last_year}. A <em>case</em> = one sender, one target, one
        set of policy objectives. GSDB-R5 for the instruments and outcomes; GSDB-FS for the
        financial-sanction subtypes.
      </p>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{fmt(t.r5_cases)}</span>
          <span className="stat-label">Sanction cases ({t.first_year}–{t.last_year})</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(t.in_force)}</span>
          <span className="stat-label">Currently in force</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(t.fs_cases)}</span>
          <span className="stat-label">With a financial component</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(t.senders)} / {fmt(t.targets)}</span>
          <span className="stat-label">Senders / targets</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>Sanction cases over time <SourceLink /></h3>
        <Plot
          data={[
            {
              type: 'bar' as const,
              name: 'Newly imposed',
              x: byYear.map((d) => d.year),
              y: byYear.map((d) => d.new_cases),
              marker: { color: '#3b82f6' },
            } as any,
            {
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'In force',
              x: byYear.map((d) => d.year),
              y: byYear.map((d) => d.in_force),
              line: { color: '#f59e0b', width: 2 },
              yaxis: 'y2',
            } as any,
          ]}
          layout={{
            ...darkLayout,
            height: 360,
            barmode: 'group',
            yaxis: { ...darkLayout.yaxis, title: 'Newly imposed' },
            yaxis2: { ...darkLayout.yaxis, title: 'In force', overlaying: 'y', side: 'right' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.12 },
          } as any}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <p className="chart-note">
          Case counts measure recorded episodes, not intensity — a long escalating regime can
          generate several cases while a one-shot embargo is one.
        </p>
      </div>

      <div className="chart-card">
        <h3>Instruments used, by year imposed (1990–{t.last_year}) <SourceLink /></h3>
        <Plot
          data={instrKeys.map((k) => ({
            type: 'bar' as const,
            name: INSTRUMENT_LABELS[k],
            x: iby.map((d) => d.year),
            y: iby.map((d) => d[k]),
            marker: { color: INSTRUMENT_COLORS[k] },
          } as any))}
          layout={{
            ...darkLayout,
            height: 340,
            barmode: 'stack',
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.12 },
          } as any}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <p className="chart-note">A case can carry several instruments, so bars count instrument-uses, not cases.</p>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Declared policy objectives <SourceLink /></h3>
          <Plot
            data={[
              {
                type: 'bar' as const,
                orientation: 'h' as const,
                x: objSorted.map((d) => d.cases),
                y: objSorted.map((d) => OBJECTIVE_LABELS[d.objective] || d.objective),
                marker: { color: '#2ca02c' },
                text: objSorted.map((d) => fmt(d.cases)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 10 },
                hovertemplate: '%{y}: %{x:,} cases<extra></extra>',
              } as any,
            ]}
            layout={{ ...darkLayout, height: 360, margin: { l: 200, r: 50, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
            config={plotConfig}
            style={{ width: '100%' }}
          />
          <p className="chart-note">Up to 3 objectives per case, so the total exceeds {fmt(t.r5_cases)}.</p>
        </div>

        <div className="chart-card">
          <h3>Financial-sanction subtypes — GSDB-FS <SourceLink /></h3>
          <Plot
            data={[
              {
                type: 'bar' as const,
                orientation: 'h' as const,
                x: stSorted.map((d) => d.cases),
                y: stSorted.map((d) => SUBTYPE_LABELS[d.subtype] || d.subtype),
                marker: { color: '#22c55e' },
                text: stSorted.map((d) => `${fmt(d.cases)} (${d.share_pct}%)`),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 10 },
                hovertemplate: '%{y}: %{x:,} cases<extra></extra>',
              } as any,
            ]}
            layout={{ ...darkLayout, height: 360, margin: { l: 220, r: 60, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
            config={plotConfig}
            style={{ width: '100%' }}
          />
          <p className="chart-note">
            Share of the {fmt(t.fs_cases)} financial cases; subtypes are not exclusive.
          </p>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Most-sanctioned targets <SourceLink /></h3>
          <Plot
            data={[
              {
                type: 'bar' as const,
                orientation: 'h' as const,
                x: [...topTargets].reverse().map((d) => d.cases),
                y: [...topTargets].reverse().map((d) => d.state),
                marker: { color: [...topTargets].reverse().map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]) },
                text: [...topTargets].reverse().map((d) => fmt(d.cases)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 9 },
                hovertemplate: '%{y}: %{x:,} cases · %{customdata:,} dyad-years<extra></extra>',
                customdata: [...topTargets].reverse().map((d) => d.dyad_years),
              } as any,
            ]}
            layout={{ ...darkLayout, height: 440, margin: { l: 160, r: 50, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-card">
          <h3>Most-active senders <SourceLink /></h3>
          <Plot
            data={[
              {
                type: 'bar' as const,
                orientation: 'h' as const,
                x: [...topSenders].reverse().map((d) => d.cases),
                y: [...topSenders].reverse().map((d) => d.state),
                marker: { color: [...topSenders].reverse().map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]) },
                text: [...topSenders].reverse().map((d) => fmt(d.cases)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 9 },
                hovertemplate: '%{y}: %{x:,} cases · %{customdata:,} dyad-years<extra></extra>',
                customdata: [...topSenders].reverse().map((d) => d.dyad_years),
              } as any,
            ]}
            layout={{ ...darkLayout, height: 440, margin: { l: 160, r: 50, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
            config={plotConfig}
            style={{ width: '100%' }}
          />
          <p className="chart-note">
            Dyadic view: coalition senders (EU, UN…) expanded to member states.
          </p>
        </div>
      </div>

      {russia && (
        <section className="gsdb-russia" style={{ marginTop: '2rem' }}>
          <h3>Russia in focus</h3>
          <p className="tab-subtitle" style={{ marginTop: '-0.4rem' }}>
            {fmt(russia.instruments.cases)} GSDB cases target Russia (
            {rusByYear.length ? rusByYear.filter((d) => d.new_cases > 0)[0]?.year : ''}–{t.last_year}).
          </p>
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>Cases targeting Russia over time</h3>
              <Plot
                data={[
                  {
                    type: 'bar' as const,
                    name: 'Newly imposed',
                    x: rusByYear.map((d) => d.year),
                    y: rusByYear.map((d) => d.new_cases),
                    marker: { color: '#ef4444' },
                  } as any,
                  {
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: 'In force',
                    x: rusByYear.map((d) => d.year),
                    y: rusByYear.map((d) => d.in_force),
                    line: { color: '#f59e0b', width: 2 },
                    yaxis: 'y2',
                  } as any,
                ]}
                layout={{
                  ...darkLayout,
                  height: 320,
                  yaxis: { ...darkLayout.yaxis, title: 'Newly imposed' },
                  yaxis2: { ...darkLayout.yaxis, title: 'In force', overlaying: 'y', side: 'right' },
                  legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
                } as any}
                config={plotConfig}
                style={{ width: '100%' }}
              />
            </div>
            <div className="chart-card">
              <h3>Instruments used against Russia</h3>
              {instrumentBars(russia.instruments, '', 320)}
            </div>
          </div>
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>Top senders against Russia</h3>
              <Plot
                data={[
                  {
                    type: 'bar' as const,
                    orientation: 'h' as const,
                    x: [...russia.top_senders].reverse().map((d) => d.dyad_years),
                    y: [...russia.top_senders].reverse().map((d) => d.state),
                    marker: { color: '#8b5cf6' },
                    text: [...russia.top_senders].reverse().map((d) => fmt(d.dyad_years)),
                    textposition: 'outside' as const,
                    textfont: { color: '#888', size: 9 },
                    hovertemplate: '%{y}: %{x:,} sanctioned dyad-years<extra></extra>',
                  } as any,
                ]}
                layout={{ ...darkLayout, height: 380, margin: { l: 150, r: 50, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
                config={plotConfig}
                style={{ width: '100%' }}
              />
            </div>
            {russia.financial_subtypes.length > 0 && (
              <div className="chart-card">
                <h3>Financial subtypes against Russia — GSDB-FS</h3>
                <Plot
                  data={[
                    {
                      type: 'bar' as const,
                      orientation: 'h' as const,
                      x: [...russia.financial_subtypes].reverse().map((d) => d.cases),
                      y: [...russia.financial_subtypes].reverse().map((d) => SUBTYPE_LABELS[d.subtype] || d.subtype),
                      marker: { color: '#22c55e' },
                      text: [...russia.financial_subtypes].reverse().map((d) => fmt(d.cases)),
                      textposition: 'outside' as const,
                      textfont: { color: '#888', size: 10 },
                      hovertemplate: '%{y}: %{x:,} cases<extra></extra>',
                    } as any,
                  ]}
                  layout={{ ...darkLayout, height: 380, margin: { l: 220, r: 60, t: 20, b: 40 }, hovermode: 'closest' as const } as any}
                  config={plotConfig}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <p className="chart-note" style={{ marginTop: '1.5rem' }}>
        Source: Global Sanctions Data Base — Felbermayr, Kirilakha, Syropoulos, Yalcin &amp; Yotov
        (2020), <em>European Economic Review</em> 129; GSDB-FS: Yotov et al. (2026).
        globalsanctionsdatabase.com. Loaded into <code>war_datasets</code> schema <code>gsdb</code>.
      </p>
    </div>
  );
}
