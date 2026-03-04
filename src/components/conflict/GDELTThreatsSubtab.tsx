import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import {
  loadGdeltThreatsByDirection,
  loadGdeltThreatsByCountry,
  loadGdeltThreatsByCameo,
  loadGdeltThreatsDyadic,
  loadGdeltVarxWeekly,
} from '../../data/newLoader';
import type {
  GdeltThreatsByDirection,
  GdeltThreatsByCountry,
  GdeltThreatsByCameo,
  GdeltThreatsDyadic,
  GdeltVarxWeekly,
  GdeltDirection,
} from '../../types';
import { GDELT_DIRECTION_LABELS } from '../../types';

const fmt = (n: number) => n.toLocaleString();

const DIRECTION_COLORS: Record<string, string> = {
  rus_outbound: '#ef4444',
  inbound_to_rus: '#3b82f6',
  internal_rus: '#f97316',
  other: '#6b7280',
};

const VARX_COLORS: Record<string, string> = {
  nuclear: '#ef4444',
  redline: '#f97316',
  threat: '#eab308',
  ultimatum: '#22c55e',
  escalation: '#8b5cf6',
  deter: '#3b82f6',
};

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

// ISO2 -> country name mapping for display
const COUNTRY_NAMES: Record<string, string> = {
  UKR: 'Ukraine', USA: 'United States', EUR: 'Europe', GBR: 'United Kingdom',
  CHN: 'China', DEU: 'Germany', FRA: 'France', POL: 'Poland', FIN: 'Finland',
  SWE: 'Sweden', IRN: 'Iran', BLR: 'Belarus', ISR: 'Israel', CAN: 'Canada',
  JPN: 'Japan', TUR: 'Turkey', IND: 'India', KOR: 'South Korea', NOR: 'Norway',
  NLD: 'Netherlands', WST: 'West', RUS: 'Russia', ITA: 'Italy', AUS: 'Australia',
  GEO: 'Georgia', ROU: 'Romania', LTU: 'Lithuania', LVA: 'Latvia', EST: 'Estonia',
  BGR: 'Bulgaria', CZE: 'Czech Republic', MDA: 'Moldova', ARM: 'Armenia',
  AZE: 'Azerbaijan', KAZ: 'Kazakhstan', HUN: 'Hungary', NATO: 'NATO',
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

interface GDELTThreatsSubtabProps {
  selectedDirections: Set<GdeltDirection>;
}

export default function GDELTThreatsSubtab({ selectedDirections }: GDELTThreatsSubtabProps) {
  const [byDirection, setByDirection] = useState<GdeltThreatsByDirection[]>([]);
  const [byCountry, setByCountry] = useState<GdeltThreatsByCountry[]>([]);
  const [byCameo, setByCameo] = useState<GdeltThreatsByCameo[]>([]);
  const [dyadic, setDyadic] = useState<GdeltThreatsDyadic[]>([]);
  const [varx, setVarx] = useState<GdeltVarxWeekly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadGdeltThreatsByDirection(),
      loadGdeltThreatsByCountry(),
      loadGdeltThreatsByCameo(),
      loadGdeltThreatsDyadic(),
      loadGdeltVarxWeekly(),
    ])
      .then(([dir, cty, cameo, dya, vx]) => {
        setByDirection(dir);
        setByCountry(cty);
        setByCameo(cameo);
        setDyadic(dya);
        setVarx(vx);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ---- Chart 1: Coercive Rhetoric Index (VARX) ----
  const varxTraces = useMemo(() => {
    if (!varx.length) return [];
    const weeks = varx.map(d => d.week);
    const categories = [
      { key: 'nuclear_quote_count', label: 'Nuclear', color: VARX_COLORS.nuclear },
      { key: 'redline_quote_count', label: 'Red Line', color: VARX_COLORS.redline },
      { key: 'threat_quote_count', label: 'Threat', color: VARX_COLORS.threat },
      { key: 'ultimatum_quote_count', label: 'Ultimatum', color: VARX_COLORS.ultimatum },
      { key: 'escalation_quote_count', label: 'Escalation', color: VARX_COLORS.escalation },
      { key: 'deter_quote_count', label: 'Deterrence', color: VARX_COLORS.deter },
    ];
    return categories.map(cat => ({
      x: weeks,
      y: varx.map(d => (d as unknown as Record<string, number>)[cat.key] || 0),
      name: cat.label,
      type: 'scatter' as const,
      mode: 'lines' as const,
      stackgroup: 'one',
      line: { color: cat.color, width: 0 },
      fillcolor: cat.color + '80',
    }));
  }, [varx]);

  // ---- Chart 2: Threat Direction Timeline ----
  const directionTraces = useMemo(() => {
    if (!byDirection.length) return [];
    const directions = ['rus_outbound', 'inbound_to_rus'] as const;
    return directions
      .filter(dir => selectedDirections.has(dir))
      .map(dir => {
        const filtered = byDirection
          .filter(d => d.direction === dir && d.week >= '2022-01-01')
          .sort((a, b) => a.week.localeCompare(b.week));
        return {
          x: filtered.map(d => d.week),
          y: filtered.map(d => d.events),
          name: GDELT_DIRECTION_LABELS[dir],
          type: 'scatter' as const,
          mode: 'lines' as const,
          line: { color: DIRECTION_COLORS[dir], width: 2 },
        };
      });
  }, [byDirection, selectedDirections]);

  // ---- Chart 3: Top Threat Targets (Horizontal Bars) ----
  const countryTraces = useMemo(() => {
    if (!byCountry.length) return [];
    const top15 = byCountry.slice(0, 15).reverse();
    return [
      {
        y: top15.map(d => countryName(d.country)),
        x: top15.map(d => d.rus_to_country),
        name: 'Russia \u2192 Country',
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: '#ef4444' },
        text: top15.map(d => fmt(d.rus_to_country)),
        textposition: 'auto' as const,
      },
      {
        y: top15.map(d => countryName(d.country)),
        x: top15.map(d => d.country_to_rus),
        name: 'Country \u2192 Russia',
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: '#3b82f6' },
        text: top15.map(d => fmt(d.country_to_rus)),
        textposition: 'auto' as const,
      },
    ];
  }, [byCountry]);

  // ---- Chart 4: Threat Type (CAMEO) Breakdown ----
  const cameoTraces = useMemo(() => {
    if (!byCameo.length) return [];
    const topCameo = byCameo.filter(d => d.events >= 50).sort((a, b) => b.events - a.events);
    return [
      {
        y: topCameo.map(d => d.label).reverse(),
        x: topCameo.map(d => d.events).reverse(),
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: {
          color: topCameo.map(d => {
            const g = Math.abs(d.avg_goldstein);
            // More negative Goldstein = more red
            return g >= 6 ? '#ef4444' : g >= 5 ? '#f97316' : '#eab308';
          }).reverse(),
        },
        text: topCameo.map(d => `${fmt(d.events)} (${d.avg_goldstein.toFixed(1)})` ).reverse(),
        textposition: 'auto' as const,
        hovertemplate: '%{y}<br>Events: %{x:,}<br>Avg Goldstein: %{text}<extra></extra>',
      },
    ];
  }, [byCameo]);

  // ---- Chart 5: Media Tone & Volume ----
  const mediaTraces = useMemo(() => {
    if (!varx.length) return [];
    const weeks = varx.map(d => d.week);
    return [
      {
        x: weeks,
        y: varx.map(d => d.media_volume_russia),
        name: 'Russia Media Volume',
        type: 'scatter' as const,
        mode: 'lines' as const,
        fill: 'tozeroy' as const,
        fillcolor: 'rgba(59,130,246,0.15)',
        line: { color: '#3b82f6', width: 1.5 },
        yaxis: 'y' as const,
      },
      {
        x: weeks,
        y: varx.map(d => d.media_tone_mean),
        name: 'Mean Tone',
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: '#ef4444', width: 2 },
        yaxis: 'y2' as const,
      },
    ];
  }, [varx]);

  // ---- Chart 6: Dyadic Asymmetries ----
  const dyadicTraces = useMemo(() => {
    if (!dyadic.length) return [];
    // Sort by Goldstein asymmetry descending, show all
    const sorted = [...dyadic].sort((a, b) => b.goldstein_asymmetry - a.goldstein_asymmetry);
    const labels = sorted.map(d => `${countryName(d.country_a)} \u2194 ${countryName(d.country_b)}`).reverse();

    return [
      {
        y: labels,
        x: sorted.map(d => d.a_to_b_goldstein).reverse(),
        name: 'A \u2192 B Goldstein',
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: '#ef4444' },
        text: sorted.map(d => `${countryName(d.country_a)}\u2192${countryName(d.country_b)}: ${d.a_to_b_goldstein.toFixed(2)}`).reverse(),
        textposition: 'outside' as const,
        hovertemplate: '%{text}<extra></extra>',
      },
      {
        y: labels,
        x: sorted.map(d => d.b_to_a_goldstein).reverse(),
        name: 'B \u2192 A Goldstein',
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: '#3b82f6' },
        text: sorted.map(d => `${countryName(d.country_b)}\u2192${countryName(d.country_a)}: ${d.b_to_a_goldstein.toFixed(2)}`).reverse(),
        textposition: 'outside' as const,
        hovertemplate: '%{text}<extra></extra>',
      },
    ];
  }, [dyadic]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading GDELT threat data...</p>
      </div>
    );
  }
  if (error) {
    return <div className="error-message">Error loading data: {error}</div>;
  }

  const totalEvents = byDirection.reduce((sum, d) => sum + d.events, 0);
  const rusOutbound = byDirection.filter(d => d.direction === 'rus_outbound').reduce((s, d) => s + d.events, 0);
  const inboundToRus = byDirection.filter(d => d.direction === 'inbound_to_rus').reduce((s, d) => s + d.events, 0);

  return (
    <div className="subtab-charts">
      {/* Summary stats */}
      <div className="chart-section">
        <div className="stat-cards" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
            <div className="stat-value">{fmt(totalEvents)}</div>
            <div className="stat-label">Total Threat Events</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
            <div className="stat-value" style={{ color: '#ef4444' }}>{fmt(rusOutbound)}</div>
            <div className="stat-label">Russia → Others</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{fmt(inboundToRus)}</div>
            <div className="stat-label">Others → Russia</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
            <div className="stat-value">{varx.length > 0 ? varx[varx.length - 1].week : '—'}</div>
            <div className="stat-label">Latest VARX Week</div>
          </div>
        </div>
      </div>

      {/* Chart 1: Coercive Rhetoric Index */}
      <div className="chart-section">
        <h3>Coercive Rhetoric Index (Weekly Quotation Counts)</h3>
        <p className="chart-description">
          Stacked weekly counts of nuclear, red line, threat, ultimatum, escalation, and deterrence
          quotations from GDELT Global Knowledge Graph.
        </p>
        <Plot
          data={varxTraces}
          layout={{
            ...darkLayout,
            title: '',
            xaxis: { ...darkLayout.xaxis, title: '' },
            yaxis: { ...darkLayout.yaxis, title: 'Quotation Count' },
            height: 400,
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Chart 2: Threat Direction Timeline */}
      <div className="chart-section">
        <h3>Threat Event Volume by Direction (Weekly)</h3>
        <p className="chart-description">
          Weekly GDELT CAMEO code 13 (Threaten) events, split by direction:
          Russia threatening others vs. others threatening Russia.
        </p>
        <Plot
          data={directionTraces}
          layout={{
            ...darkLayout,
            title: '',
            xaxis: { ...darkLayout.xaxis, title: '' },
            yaxis: { ...darkLayout.yaxis, title: 'Events per Week' },
            height: 400,
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Chart 3: Top Threat Targets */}
      <div className="chart-section">
        <h3>Top Threat Targets (Country Pairs with Russia)</h3>
        <p className="chart-description">
          Total threat events by country pair. Red bars show Russia threatening that country;
          blue bars show that country threatening Russia.
        </p>
        <Plot
          data={countryTraces}
          layout={{
            ...darkLayout,
            title: '',
            barmode: 'group' as const,
            xaxis: { ...darkLayout.xaxis, title: 'Total Events' },
            yaxis: { ...darkLayout.yaxis, type: 'category' as const, autorange: true },
            height: 500,
            margin: { ...darkLayout.margin, l: 120 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Chart 4: CAMEO Threat Type Breakdown */}
      <div className="chart-section">
        <h3>Threat Type Breakdown (CAMEO Subcodes)</h3>
        <p className="chart-description">
          Distribution of threat types. Color intensity reflects average Goldstein scale severity
          (red = more hostile). Numbers show event count and average Goldstein score.
        </p>
        <Plot
          data={cameoTraces}
          layout={{
            ...darkLayout,
            title: '',
            showlegend: false,
            xaxis: { ...darkLayout.xaxis, title: 'Event Count', type: 'log' as const },
            yaxis: { ...darkLayout.yaxis, type: 'category' as const, autorange: true },
            height: 450,
            margin: { ...darkLayout.margin, l: 180 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Chart 5: Media Tone & Volume */}
      <div className="chart-section">
        <h3>Russia-Related Media Volume & Tone</h3>
        <p className="chart-description">
          Weekly Russia-related media volume (blue area, left axis) and average media tone
          (red line, right axis). More negative tone indicates more hostile coverage.
        </p>
        <Plot
          data={mediaTraces}
          layout={{
            ...darkLayout,
            title: '',
            xaxis: { ...darkLayout.xaxis, title: '' },
            yaxis: { ...darkLayout.yaxis, title: 'Media Volume', side: 'left' as const },
            yaxis2: {
              title: 'Mean Tone',
              titlefont: { color: '#ef4444' },
              tickfont: { color: '#ef4444' },
              overlaying: 'y' as const,
              side: 'right' as const,
              gridcolor: 'transparent',
            },
            height: 400,
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Chart 6: Dyadic Asymmetries */}
      <div className="chart-section">
        <h3>Dyadic Threat Asymmetries (Goldstein Score)</h3>
        <p className="chart-description">
          Pairs of countries with bidirectional threat flows. Bars show average Goldstein scale
          for each direction. Larger gaps indicate more asymmetric threat relationships.
          More negative = more hostile. Pairs sorted by asymmetry magnitude.
        </p>
        <Plot
          data={dyadicTraces}
          layout={{
            ...darkLayout,
            title: '',
            barmode: 'group' as const,
            xaxis: { ...darkLayout.xaxis, title: 'Average Goldstein Scale', range: [-8, 0] },
            yaxis: { ...darkLayout.yaxis, type: 'category' as const, autorange: true },
            height: 420,
            margin: { ...darkLayout.margin, l: 200 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
