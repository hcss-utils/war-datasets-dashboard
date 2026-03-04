import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import {
  loadBellingcatDaily,
  loadBellingcatMonthly,
  loadBellingcatIncidents,
  loadBellingcatByImpact,
  loadBellingcatMonthlyByImpact,
} from '../../data/newLoader';
import type {
  BellingcatDaily,
  BellingcatMonthly,
  BellingcatIncident,
  BellingcatByImpact,
  BellingcatMonthlyByImpact,
} from '../../types';

const SourceLink = ({ source, sourceId }: { source: string; sourceId?: string }) => {
  const id = sourceId || source.toLowerCase();
  return (
    <a href={`#sources-${id}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const IMPACT_COLORS: Record<string, string> = {
  'Residential': '#ef4444',
  'Commercial': '#f97316',
  'School or childcare': '#eab308',
  'Roads/Highways/Transport': '#22c55e',
  'Industrial': '#06b6d4',
  'Healthcare': '#3b82f6',
  'Administrative': '#8b5cf6',
  'Cultural': '#ec4899',
  'Religious': '#14b8a6',
  'Food/Food Infrastructure': '#84cc16',
  'Humanitarian': '#a855f7',
  'Military': '#64748b',
  'Undefined': '#6b7280',
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

interface BellingcatSubtabProps {
  selectedImpacts: Set<string>;
}

export default function BellingcatSubtab({ selectedImpacts }: BellingcatSubtabProps) {
  const [daily, setDaily] = useState<BellingcatDaily[]>([]);
  const [monthly, setMonthly] = useState<BellingcatMonthly[]>([]);
  const [incidents, setIncidents] = useState<BellingcatIncident[]>([]);
  const [byImpact, setByImpact] = useState<BellingcatByImpact[]>([]);
  const [monthlyByImpact, setMonthlyByImpact] = useState<BellingcatMonthlyByImpact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { xaxisRange, onRelayout } = usePlotlyZoom();

  useEffect(() => {
    Promise.all([
      loadBellingcatDaily(),
      loadBellingcatMonthly(),
      loadBellingcatIncidents(),
      loadBellingcatByImpact(),
      loadBellingcatMonthlyByImpact(),
    ])
      .then(([d, m, i, impact, monthlyImpact]) => {
        setDaily(d);
        setMonthly(m);
        setIncidents(i);
        setByImpact(impact);
        setMonthlyByImpact(monthlyImpact);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter data based on selected impact types
  const filteredByImpact = useMemo(() =>
    byImpact.filter(i => selectedImpacts.has(i.impact_type)),
    [byImpact, selectedImpacts]
  );

  const filteredMonthlyByImpact = useMemo(() =>
    monthlyByImpact.filter(m => selectedImpacts.has(m.impact_type)),
    [monthlyByImpact, selectedImpacts]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading Bellingcat data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load Bellingcat data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Aggregate monthly data for stacked bars
  const monthlyAggregated = filteredMonthlyByImpact.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    acc[key][m.impact_type] = ((acc[key][m.impact_type] as number) || 0) + m.incidents;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);

  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  const visibleTypes = [...selectedImpacts];
  const months = monthlyChartData.map(d => d.month as string);

  // Stats
  const totalIncidents = filteredByImpact.reduce((s, i) => s + i.incidents, 0);

  // Pie data for impact types
  const pieData = filteredByImpact.slice(0, 10).map(i => ({
    name: i.impact_type,
    value: i.incidents,
  }));

  // Recent incidents for table
  const recentIncidents = incidents.slice(-20).reverse();

  return (
    <div className="conflict-subtab">
      <h2>Bellingcat - OSINT-Verified Civilian Harm</h2>
      <p className="tab-subtitle">
        Open-source verified civilian harm incidents by infrastructure type
      </p>

      {/* Stats row */}
      <div className="conflict-stats">
        <div className="stat-card">
          <span className="stat-value">{totalIncidents.toLocaleString()}</span>
          <span className="stat-label">Total Incidents</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{selectedImpacts.size}</span>
          <span className="stat-label">Impact Types Selected</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byImpact.length}</span>
          <span className="stat-label">Total Categories</span>
        </div>
      </div>

      {selectedImpacts.size === 0 ? (
        <div className="chart-card">
          <p className="no-data-msg">Select at least one impact type from the sidebar to view data.</p>
        </div>
      ) : (
        <>
          {/* Monthly Incidents by Impact Type - Stacked Bar (PRIMARY) */}
          <div className="chart-card">
            <h3>Monthly Incidents by Impact Type <SourceLink source="Bellingcat" /></h3>
            <p className="chart-note">Stacked bars show infrastructure impact breakdown. Drag to zoom. Click legend to toggle.</p>
            <Plot
              data={visibleTypes.map((type) => ({
                x: months,
                y: monthlyChartData.map(d => (d[type] as number) || 0),
                type: 'bar' as const,
                name: type,
                marker: { color: IMPACT_COLORS[type] || '#888' },
                hoverlabel: { font: { color: '#fff' } },
              }))}
              layout={{
                ...darkLayout,
                barmode: 'stack',
                height: 400,
                xaxis: {
                  ...darkLayout.xaxis,
                  ...(xaxisRange ? { range: xaxisRange } : {}),
                  rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
                },
                legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
              }}
              onRelayout={onRelayout}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>

          <div className="chart-grid-2">
            {/* Pie chart for impact types */}
            <div className="chart-card">
              <h3>Incidents by Impact Type <SourceLink source="Bellingcat" /></h3>
              <Plot
                data={[
                  {
                    values: pieData.map(d => d.value),
                    labels: pieData.map(d => d.name),
                    type: 'pie' as const,
                    hole: 0.4,
                    marker: { colors: pieData.map(d => IMPACT_COLORS[d.name] || '#888') },
                    textinfo: 'percent',
                    textposition: 'inside',
                    textfont: { color: '#fff', size: 10 },
                    hovertemplate: '%{label}<br>%{value:,} incidents<br>%{percent}<extra></extra>',
                    hoverlabel: { font: { color: '#fff' } },
                  },
                ]}
                layout={{
                  ...darkLayout,
                  height: 300,
                  margin: { l: 20, r: 20, t: 20, b: 20 },
                  showlegend: true,
                  legend: { ...darkLayout.legend, orientation: 'v' as const, x: 1, y: 0.5, font: { size: 9 } },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Horizontal bar chart for impact types */}
            <div className="chart-card">
              <h3>Top Impact Types <SourceLink source="Bellingcat" /></h3>
              <Plot
                data={[
                  {
                    x: pieData.map(d => d.value),
                    y: pieData.map(d => d.name),
                    type: 'bar' as const,
                    orientation: 'h' as const,
                    marker: { color: pieData.map(d => IMPACT_COLORS[d.name] || '#888') },
                    text: pieData.map(d => d.value.toLocaleString()),
                    textposition: 'outside' as const,
                    textfont: { color: '#888', size: 10 },
                    hovertemplate: '%{y}<br>%{x:,} incidents<extra></extra>',
                    hoverlabel: { font: { color: '#fff' } },
                  },
                ]}
                layout={{
                  ...darkLayout,
                  height: 300,
                  margin: { l: 150, r: 60, t: 20, b: 40 },
                  xaxis: { ...darkLayout.xaxis, tickformat: ',' },
                  yaxis: { ...darkLayout.yaxis, autorange: 'reversed' as const },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Recent Incidents Table */}
      <div className="chart-card">
        <h3>Recent Verified Incidents <SourceLink source="Bellingcat" /></h3>
        <div className="incidents-table-container">
          <table className="incidents-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {recentIncidents.map((inc, i) => (
                <tr key={i}>
                  <td className="date-cell">{new Date(inc.date).toLocaleDateString()}</td>
                  <td className="location-cell">{inc.location || 'Unknown'}</td>
                  <td className="desc-cell">{inc.description.slice(0, 150)}{inc.description.length > 150 ? '...' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
