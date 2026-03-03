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
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import {
  loadViinaDaily,
  loadViinaMonthly,
  loadViinaBySource,
  loadViinaByOblast,
  loadViinaMonthlyBySource,
} from '../data/newLoader';
import type {
  ViinaDaily,
  ViinaMonthly,
  ViinaBySource,
  ViinaByOblast,
  ViinaMonthlyBySource,
} from '../types';

const fmt = (n: number) => n.toLocaleString();

import { PALETTE_20 } from '../utils/colors';

const OBLAST_RENAME: Record<string, string> = {
  'Kiev City': 'Kyiv City',
  'Kiev': 'Kyiv Oblast',
  'Odessa': 'Odesa',
  'Zaporizhzhya': 'Zaporizhzhia',
};

// Source name mapping for better labels
const SOURCE_LABELS: Record<string, string> = {
  'nv': 'NV (UA)',
  'ria': 'RIA (RU)',
  'interfax': 'Interfax',
  'tass': 'TASS (RU)',
  'pravda': 'Pravda (UA)',
  'unian': 'UNIAN (UA)',
  'kp': 'KP (RU)',
  'rbc': 'RBC (RU)',
  'focus': 'Focus (UA)',
  'comments': 'Comments (UA)',
  'lenta': 'Lenta (RU)',
  'gazeta': 'Gazeta (RU)',
  'hromadske': 'Hromadske (UA)',
  'ukrinform': 'Ukrinform (UA)',
  'donday': 'Donday',
  'ura': 'URA (RU)',
};

export default function ViinaTab() {
  const [daily, setDaily] = useState<ViinaDaily[]>([]);
  const [monthly, setMonthly] = useState<ViinaMonthly[]>([]);
  const [bySource, setBySource] = useState<ViinaBySource[]>([]);
  const [byOblast, setByOblast] = useState<ViinaByOblast[]>([]);
  const [monthlyBySource, setMonthlyBySource] = useState<ViinaMonthlyBySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadViinaDaily(),
      loadViinaMonthly(),
      loadViinaBySource(),
      loadViinaByOblast(),
      loadViinaMonthlyBySource(),
    ])
      .then(([d, m, s, o, ms]) => {
        setDaily(d);
        setMonthly(m);
        setBySource(s);
        setByOblast(o);
        setMonthlyBySource(ms);
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
        <span className="loading-text">Loading VIINA data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load VIINA data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Process monthly by source for stacked chart
  const monthlyAggregated = monthlyBySource.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    const label = SOURCE_LABELS[m.source] || m.source;
    acc[key][label] = ((acc[key][label] as number) || 0) + m.events;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);

  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  const sources = [...new Set(bySource.map(s => SOURCE_LABELS[s.source] || s.source))];

  // Top 10 oblasts (with normalized names)
  const topOblasts = byOblast.slice(0, 10).map(o => ({
    ...o,
    oblast: OBLAST_RENAME[o.oblast] || o.oblast,
  })).sort((a, b) => a.oblast.localeCompare(b.oblast));

  // Pie data for sources
  const sourceTotal = bySource.reduce((s, d) => s + d.events, 0);
  const pieData = bySource.slice(0, 8).map(d => ({
    name: SOURCE_LABELS[d.source] || d.source,
    value: d.events,
    pct: ((d.events / sourceTotal) * 100).toFixed(1),
  }));

  const handleLegendClick = (dataKey: string) => {
    setSelectedSource(prev => prev === dataKey ? null : dataKey);
  };

  return (
    <div className="viina-tab">
      <h2>VIINA 2.0 - News-Based Event Tracking</h2>
      <p className="tab-subtitle">
        ML-classified conflict events from 16 Ukrainian and Russian news sources (552K+ events)
      </p>

      <div className="chart-card">
        <h3>Daily Events Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
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
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(value: number) => [fmt(value), 'Events']}
            />
            <Line type="monotone" dataKey="events" stroke="#22c55e" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by News Source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                dataKey="value"
                paddingAngle={2}
                label={({ pct }) => `${pct}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE_20[index % PALETTE_20.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value: string) => {
                  const item = pieData.find(d => d.name === value);
                  return `${value} (${item?.pct || 0}%)`;
                }}
                wrapperStyle={{ fontSize: 11, paddingLeft: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top 10 Oblasts by Event Count</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topOblasts} layout="vertical" margin={{ right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
              <YAxis
                dataKey="oblast"
                type="category"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="events" name="Events">
                {topOblasts.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE_20[index % PALETTE_20.length]} />
                ))}
                <LabelList dataKey="events" position="right" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Monthly Events by Source</h3>
        <p className="chart-note">Click a legend item to show only that source; click again to show all</p>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="month"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={2}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(value: number) => fmt(value)}
            />
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey as string)}
              formatter={(value: string) => (
                <span style={{
                  color: selectedSource === null || selectedSource === value ? '#fff' : '#666',
                  fontWeight: selectedSource === value ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}>
                  {value}
                </span>
              )}
            />
            {sources.map((source, i) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="a"
                fill={PALETTE_20[i % PALETTE_20.length]}
                hide={selectedSource !== null && selectedSource !== source}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Monthly Event Totals</h3>
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
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(value: number) => [fmt(value), 'Events']}
            />
            <Bar dataKey="events" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
