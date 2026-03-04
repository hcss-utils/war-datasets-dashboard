import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Brush,
} from 'recharts';
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
  'ACLED': 'acled',
  'UCDP': 'ucdp',
  'ACLED/UCDP': 'acled',
  'VIINA': 'viina',
  'Bellingcat': 'bellingcat',
  'MDAA Tracker': 'mdaa',
  'Ukraine MOD': 'equipment',
  'DeepState': 'deepstate',
  'OHCHR': 'ohchr',
  'UNHCR': 'unhcr',
  'HDX HAPI': 'hapi',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a
      href={`#source-${sourceId}`}
      className="source-link-inline"
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = 'sources';
        setTimeout(() => {
          const el = document.getElementById(`source-${sourceId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }}
    >
      ({source})
    </a>
  );
};

export default function BellingcatTab() {
  const [daily, setDaily] = useState<BellingcatDaily[]>([]);
  const [monthly, setMonthly] = useState<BellingcatMonthly[]>([]);
  const [incidents, setIncidents] = useState<BellingcatIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  const handleLegendClick = (dataKey: string) => {
    setSelectedSeries(prev => prev === dataKey ? null : dataKey);
  };

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

      <div className="chart-card">
        <h3>Daily Incidents (with 7-day Rolling Average) <SourceLink source="Bellingcat" /></h3>
        <p className="chart-note">Drag the brush below to zoom. Click legend to filter series.</p>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={rollingData} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
            />
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey as string)}
              formatter={(value: string, entry: any) => (
                <span style={{
                  color: selectedSeries === null || selectedSeries === entry.dataKey ? '#fff' : '#666',
                  fontWeight: selectedSeries === entry.dataKey ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}>
                  {value}
                </span>
              )}
            />
            <Brush
              dataKey="date"
              height={30}
              stroke="#ef4444"
              fill="#1a1a2e"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <Line
              type="monotone"
              dataKey="incidents"
              name="Daily Incidents"
              stroke="#f97316"
              dot={false}
              strokeWidth={1}
              opacity={0.5}
              hide={selectedSeries !== null && selectedSeries !== 'incidents'}
            />
            <Line
              type="monotone"
              dataKey="rolling_avg"
              name="7-day Average"
              stroke="#ef4444"
              dot={false}
              strokeWidth={2}
              hide={selectedSeries !== null && selectedSeries !== 'rolling_avg'}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Monthly Incidents <SourceLink source="Bellingcat" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="month"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                formatter={(value: number) => [fmt(value), 'Incidents']}
              />
              <Bar dataKey="incidents" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Cumulative Incidents Over Time <SourceLink source="Bellingcat" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="month"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                formatter={(value: number, name: string) => [
                  fmt(value),
                  name === 'cumulative' ? 'Total to Date' : 'Monthly'
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

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
