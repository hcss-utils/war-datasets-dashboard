import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import {
  loadBellingcatDaily,
  loadBellingcatMonthly,
  loadBellingcatIncidents,
} from '../data/newLoader';
import type {
  BellingcatDaily,
  BellingcatMonthly,
  BellingcatIncident,
} from '../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'Bellingcat': 'bellingcat',
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

export default function BellingcatTabPlotly() {
  const [daily, setDaily] = useState<BellingcatDaily[]>([]);
  const [monthly, setMonthly] = useState<BellingcatMonthly[]>([]);
  const [incidents, setIncidents] = useState<BellingcatIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadBellingcatDaily(),
      loadBellingcatMonthly(),
      loadBellingcatIncidents(),
    ])
      .then(([d, m, i]) => {
        setDaily(d);
        setMonthly(m);
        setIncidents(i);
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

  // Calculate cumulative incidents
  let cumulative = 0;
  const cumulativeData = monthly.map(m => {
    cumulative += m.incidents;
    return {
      month: m.month,
      incidents: m.incidents,
      cumulative,
    };
  });

  // Recent incidents for table
  const recentIncidents = incidents.slice(-20).reverse();

  // Calculate 7-day rolling average
  const rollingData = daily.slice(7).map((d, i) => {
    const window = daily.slice(i, i + 7);
    const avg = window.reduce((s, w) => s + w.incidents, 0) / 7;
    return {
      date: d.date,
      incidents: d.incidents,
      rolling_avg: Number(avg.toFixed(2)),
    };
  });

  return (
    <div className="bellingcat-tab">
      <h2>Bellingcat - OSINT-Verified Civilian Harm</h2>
      <p className="tab-subtitle">
        Open-source verified civilian harm incidents from the Ukraine TimeMap (2,514 incidents)
      </p>

      {/* Daily Incidents with Rolling Average */}
      <div className="chart-card">
        <h3>Daily Incidents (with 7-day Rolling Average) <SourceLink source="Bellingcat" /></h3>
        <p className="chart-note">Drag on chart to zoom. Click legend to toggle series.</p>
        <Plot
          data={[
            {
              x: rollingData.map(d => d.date),
              y: rollingData.map(d => d.incidents),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Daily Incidents',
              line: { color: '#f97316', width: 1 },
              opacity: 0.5,
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: rollingData.map(d => d.date),
              y: rollingData.map(d => d.rolling_avg),
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
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Monthly Incidents */}
        <div className="chart-card">
          <h3>Monthly Incidents <SourceLink source="Bellingcat" /></h3>
          <Plot
            data={[
              {
                x: monthly.map(d => d.month),
                y: monthly.map(d => d.incidents),
                type: 'bar' as const,
                marker: { color: '#ef4444' },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Cumulative Incidents */}
        <div className="chart-card">
          <h3>Cumulative Incidents Over Time <SourceLink source="Bellingcat" /></h3>
          <Plot
            data={[
              {
                x: cumulativeData.map(d => d.month),
                y: cumulativeData.map(d => d.cumulative),
                type: 'scatter' as const,
                mode: 'lines' as const,
                fill: 'tozeroy',
                line: { color: '#ef4444', width: 1.5 },
                fillcolor: 'rgba(239, 68, 68, 0.3)',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>

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
