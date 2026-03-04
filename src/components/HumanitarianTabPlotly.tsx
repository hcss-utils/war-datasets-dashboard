import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../utils/usePlotlyZoom';
import {
  loadCasualties,
  loadRefugeesByCountry,
  loadRefugeeTotals,
  loadHapiIdpsTotal,
  loadHapiFunding,
} from '../data/newLoader';
import type {
  CasualtyData,
  RefugeeByCountry,
  RefugeeTotals,
  HapiIdpsTotal,
  HapiFunding,
} from '../types';

const fmt = (n: number) => n.toLocaleString();

const PLOTLY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

const SOURCE_ID_MAP: Record<string, string> = {
  'OHCHR': 'ohchr',
  'UNHCR': 'unhcr',
  'HDX HAPI': 'hapi',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

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

export default function HumanitarianTabPlotly() {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [casualties, setCasualties] = useState<CasualtyData[]>([]);
  const [refugeesByCountry, setRefugeesByCountry] = useState<RefugeeByCountry[]>([]);
  const [refugeeTotals, setRefugeeTotals] = useState<RefugeeTotals[]>([]);
  const [idpsTotal, setIdpsTotal] = useState<HapiIdpsTotal[]>([]);
  const [funding, setFunding] = useState<HapiFunding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadCasualties(),
      loadRefugeesByCountry(),
      loadRefugeeTotals(),
      loadHapiIdpsTotal(),
      loadHapiFunding(),
    ])
      .then(([cas, refCountry, refTotals, idps, fund]) => {
        setCasualties(cas);
        setRefugeesByCountry(refCountry);
        setRefugeeTotals(refTotals);
        setIdpsTotal(idps);
        setFunding(fund);
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
        <span className="loading-text">Loading humanitarian data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load humanitarian data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Aggregate casualties by month
  const monthlyTotals = casualties.reduce((acc, c) => {
    if (!c.year || !c.month || c.year < 2000) return acc;
    const key = `${c.year}-${String(c.month).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = { month: key, killed: 0, injured: 0 };
    acc[key].killed += c.killed || 0;
    acc[key].injured += c.injured || 0;
    return acc;
  }, {} as Record<string, { month: string; killed: number; injured: number }>);

  const monthlyData = Object.values(monthlyTotals).sort((a, b) => a.month.localeCompare(b.month));

  // Calculate rate of change
  const monthlyRateData = monthlyData.slice(1).map((d, i) => {
    const prev = monthlyData[i];
    const killedRate = prev.killed > 0 ? ((d.killed - prev.killed) / prev.killed) * 100 : 0;
    const injuredRate = prev.injured > 0 ? ((d.injured - prev.injured) / prev.injured) * 100 : 0;
    return { ...d, killed_rate: killedRate, injured_rate: injuredRate };
  });

  // Total casualties
  const totalKilled = casualties.reduce((s, c) => s + (c.killed || 0), 0);
  const totalInjured = casualties.reduce((s, c) => s + (c.injured || 0), 0);

  // Aggregate by region
  const byRegion = casualties.reduce((acc, c) => {
    if (!c.region) return acc;
    if (!acc[c.region]) acc[c.region] = { region: c.region, killed: 0, injured: 0 };
    acc[c.region].killed += c.killed || 0;
    acc[c.region].injured += c.injured || 0;
    return acc;
  }, {} as Record<string, { region: string; killed: number; injured: number }>);

  const regionData = Object.values(byRegion)
    .sort((a, b) => (b.killed + b.injured) - (a.killed + a.injured))
    .slice(0, 15);

  // Latest refugee totals
  const latestRefugees = refugeeTotals[refugeeTotals.length - 1];
  const latestYear = Math.max(...refugeesByCountry.map((r) => r.year));
  const topDestinations = refugeesByCountry
    .filter((r) => r.year === latestYear)
    .sort((a, b) => b.refugees - a.refugees)
    .slice(0, 10);

  const latestIdps = idpsTotal[idpsTotal.length - 1];

  // Format funding data - filter out entries without requirements
  const fundingData = funding
    .filter(f => f.requirements_usd && f.requirements_usd > 0)
    .map(f => ({
      date: f.date,
      requirements: f.requirements_usd / 1e9,
      funded: f.funding_usd / 1e9,
      gap: (f.requirements_usd - f.funding_usd) / 1e9,
      pct: f.funding_pct,
    }));

  return (
    <div className="humanitarian-tab">
      <h2>Humanitarian Impact</h2>
      <p className="tab-subtitle">Civilian casualties, refugees, IDPs, and humanitarian funding</p>

      <div className="stat-cards humanitarian-stats">
        <div className="stat-card highlight-red">
          <span className="stat-value">{totalKilled.toLocaleString()}</span>
          <span className="stat-label">Civilians Killed (OHCHR verified)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalInjured.toLocaleString()}</span>
          <span className="stat-label">Civilians Injured</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{latestRefugees?.total_refugees.toLocaleString() || 'N/A'}</span>
          <span className="stat-label">Refugees ({latestYear})</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{latestIdps?.total_idps?.toLocaleString() || 'N/A'}</span>
          <span className="stat-label">Internally Displaced</span>
        </div>
      </div>

      {/* Monthly Civilian Casualties - Dual Pane */}
      <div className="chart-card">
        <h3>Monthly Civilian Casualties <SourceLink source="OHCHR" /></h3>
        <p className="chart-note">Top: Monthly counts | Bottom: Month-over-month rate of change (%)</p>
        <Plot
          data={[
            {
              x: monthlyRateData.map(d => d.month),
              y: monthlyRateData.map(d => d.killed),
              type: 'scatter' as const,
              mode: 'lines' as const,
              fill: 'tozeroy',
              name: 'Killed',
              line: { color: '#ef4444', width: 1 },
              fillcolor: 'rgba(239, 68, 68, 0.5)',
              stackgroup: 'one',
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: monthlyRateData.map(d => d.month),
              y: monthlyRateData.map(d => d.injured),
              type: 'scatter' as const,
              mode: 'lines' as const,
              fill: 'tonexty',
              name: 'Injured',
              line: { color: '#f97316', width: 1 },
              fillcolor: 'rgba(249, 115, 22, 0.5)',
              stackgroup: 'one',
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 250,
            xaxis: { ...darkLayout.xaxis, ...(xaxisRange ? { range: xaxisRange } : {}), rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' } },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
          onRelayout={onRelayout}
        />
        <Plot
          data={[
            {
              x: monthlyRateData.map(d => d.month),
              y: monthlyRateData.map(d => d.killed_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Killed Rate',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: monthlyRateData.map(d => d.month),
              y: monthlyRateData.map(d => d.injured_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Injured Rate',
              line: { color: '#f97316', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 200,
            margin: { ...darkLayout.margin, t: 10 },
            yaxis: { ...darkLayout.yaxis, ticksuffix: '%', zeroline: true, zerolinecolor: '#888' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.2 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* IDPs */}
        <div className="chart-card">
          <h3>Internally Displaced Persons <SourceLink source="HDX HAPI" /></h3>
          <Plot
            data={[
              {
                x: idpsTotal.map(d => d.date),
                y: idpsTotal.map(d => d.total_idps),
                type: 'scatter' as const,
                mode: 'lines' as const,
                fill: 'tozeroy',
                line: { color: '#8b5cf6', width: 1.5 },
                fillcolor: 'rgba(139, 92, 246, 0.3)',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              yaxis: { ...darkLayout.yaxis, tickformat: '.2s' },
              xaxis: { ...darkLayout.xaxis, rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' } },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Funding Gap */}
        <div className="chart-card">
          <h3>Humanitarian Funding Gap <SourceLink source="HDX HAPI" /></h3>
          <Plot
            data={[
              {
                x: fundingData.map(d => d.date),
                y: fundingData.map(d => d.funded),
                type: 'bar' as const,
                name: 'Funded',
                marker: { color: '#22c55e' },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: fundingData.map(d => d.date),
                y: fundingData.map(d => d.gap),
                type: 'bar' as const,
                name: 'Gap',
                marker: { color: '#ef4444' },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              barmode: 'stack',
              yaxis: { ...darkLayout.yaxis, tickprefix: '$', ticksuffix: 'B' },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="chart-grid-2">
        {/* Casualties by Region */}
        <div className="chart-card">
          <h3>Casualties by Region <SourceLink source="OHCHR" /></h3>
          <Plot
            data={[
              {
                x: regionData.map(d => d.killed),
                y: regionData.map(d => d.region),
                type: 'bar' as const,
                orientation: 'h' as const,
                name: 'Killed',
                marker: { color: '#ef4444' },
                text: regionData.map(d => fmt(d.killed)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 9 },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: regionData.map(d => d.injured),
                y: regionData.map(d => d.region),
                type: 'bar' as const,
                orientation: 'h' as const,
                name: 'Injured',
                marker: { color: '#f97316' },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 400,
              barmode: 'group',
              margin: { l: 140, r: 60, t: 20, b: 40 },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.05 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Top Refugee Destinations */}
        <div className="chart-card">
          <h3>Top Refugee Destinations ({latestYear}) <SourceLink source="UNHCR" /></h3>
          <Plot
            data={[
              {
                x: topDestinations.map(d => d.refugees),
                y: topDestinations.map(d => d.country_of_asylum),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: { color: topDestinations.map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]) },
                text: topDestinations.map(d => fmt(d.refugees)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 9 },
                hovertemplate: '%{y}<br>%{x:,} refugees<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 400,
              margin: { l: 100, r: 80, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, tickformat: '.2s' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Refugee Totals by Year */}
      <div className="chart-card">
        <h3>Refugee Totals by Year <SourceLink source="UNHCR" /></h3>
        <Plot
          data={[
            {
              x: refugeeTotals.map(d => d.year),
              y: refugeeTotals.map(d => d.total_refugees),
              type: 'bar' as const,
              name: 'Refugees',
              marker: { color: '#3b82f6' },
              text: refugeeTotals.map(d => `${(d.total_refugees / 1e6).toFixed(1)}M`),
              textposition: 'outside' as const,
              textfont: { color: '#888', size: 9 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: refugeeTotals.map(d => d.year),
              y: refugeeTotals.map(d => d.total_asylum_seekers),
              type: 'bar' as const,
              name: 'Asylum Seekers',
              marker: { color: '#8b5cf6' },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 300,
            barmode: 'group',
            yaxis: { ...darkLayout.yaxis, tickformat: '.2s' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
