import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { loadCasualties, loadRefugeesByCountry, loadRefugeeTotals } from '../data/newLoader';
import type { CasualtyData, RefugeeByCountry, RefugeeTotals } from '../types';

// Format number with thousands separators
const fmt = (n: number) => n.toLocaleString();

// Tab20 color palette for distinctive bar colors
const TAB20_COLORS = [
  '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
  '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
  '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
  '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
];

export default function HumanitarianTab() {
  const [casualties, setCasualties] = useState<CasualtyData[]>([]);
  const [refugeesByCountry, setRefugeesByCountry] = useState<RefugeeByCountry[]>([]);
  const [refugeeTotals, setRefugeeTotals] = useState<RefugeeTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCasualties(), loadRefugeesByCountry(), loadRefugeeTotals()])
      .then(([cas, refCountry, refTotals]) => {
        setCasualties(cas);
        setRefugeesByCountry(refCountry);
        setRefugeeTotals(refTotals);
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

  // Aggregate casualties by month (filter out invalid dates)
  const monthlyTotals = casualties.reduce((acc, c) => {
    if (!c.year || !c.month || c.year < 2000) return acc; // Skip invalid entries
    const key = `${c.year}-${String(c.month).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = { month: key, killed: 0, injured: 0 };
    acc[key].killed += c.killed || 0;
    acc[key].injured += c.injured || 0;
    return acc;
  }, {} as Record<string, { month: string; killed: number; injured: number }>);

  const monthlyData = Object.values(monthlyTotals).sort((a, b) => a.month.localeCompare(b.month));

  // Calculate rate of change for monthly data
  const monthlyRateData = monthlyData.slice(1).map((d, i) => {
    const prev = monthlyData[i];
    const killedRate = prev.killed > 0 ? ((d.killed - prev.killed) / prev.killed) * 100 : 0;
    const injuredRate = prev.injured > 0 ? ((d.injured - prev.injured) / prev.injured) * 100 : 0;
    return {
      ...d,
      killed_rate: killedRate,
      injured_rate: injuredRate,
    };
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

  // Top destination countries (latest year)
  const latestYear = Math.max(...refugeesByCountry.map((r) => r.year));
  const topDestinations = refugeesByCountry
    .filter((r) => r.year === latestYear)
    .sort((a, b) => b.refugees - a.refugees)
    .slice(0, 10);

  return (
    <div className="humanitarian-tab">
      <h2>Humanitarian Impact</h2>
      <p className="tab-subtitle">Civilian casualties (OHCHR) and refugee data (UNHCR)</p>

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
          <span className="stat-value">{latestRefugees?.destination_countries || 'N/A'}</span>
          <span className="stat-label">Destination Countries</span>
        </div>
      </div>

      <p className="chart-note" style={{ background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)' }}>
        OHCHR verified figures represent confirmed minimums. Actual civilian casualties are likely considerably higher. Data may not reflect latest OHCHR monthly updates.
      </p>

      <div className="chart-card">
        <h3>Monthly Civilian Casualties (OHCHR)</h3>
        <p className="chart-note">Top: Monthly counts | Bottom: Month-over-month rate of change (%)</p>
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => {
                  const [y, m] = d.split('-');
                  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                }}
                formatter={(value: number) => fmt(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="killed"
                name="Killed"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
              />
              <Area
                type="monotone"
                dataKey="injured"
                name="Injured"
                stackId="1"
                stroke="#f97316"
                fill="#f97316"
              />
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="month"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={50}
                interval={2}
                tickFormatter={(d) => {
                  const [y, m] = d.split('-');
                  const year = parseInt(y);
                  const month = parseInt(m);
                  if (isNaN(year) || isNaN(month)) return '';
                  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                }}
              />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => {
                  const [y, m] = d.split('-');
                  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="killed_rate" name="Killed Rate" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="injured_rate" name="Injured Rate" stroke="#f97316" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Casualties by Region</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={regionData} layout="vertical" margin={{ right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis
                dataKey="region"
                type="category"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                width={140}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => fmt(value)}
              />
              <Legend />
              <Bar dataKey="killed" name="Killed" fill="#ef4444">
                <LabelList dataKey="killed" position="right" fill="#888" fontSize={9} formatter={(v: number) => fmt(v)} />
              </Bar>
              <Bar dataKey="injured" name="Injured" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top Refugee Destinations ({latestYear})</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topDestinations} layout="vertical" margin={{ right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <YAxis
                dataKey="country_of_asylum"
                type="category"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                width={100}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="refugees" name="Refugees">
                {topDestinations.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={TAB20_COLORS[index % TAB20_COLORS.length]} />
                ))}
                <LabelList dataKey="refugees" position="right" fill="#888" fontSize={9} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Refugee Totals by Year</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={refugeeTotals}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="year" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis
              stroke="#888"
              tick={{ fill: '#888', fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number) => fmt(value)}
            />
            <Legend />
            <Bar dataKey="total_refugees" name="Refugees" fill="#3b82f6">
              <LabelList dataKey="total_refugees" position="top" fill="#888" fontSize={9} formatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
            </Bar>
            <Bar dataKey="total_asylum_seekers" name="Asylum Seekers" fill="#8b5cf6">
              <LabelList dataKey="total_asylum_seekers" position="top" fill="#888" fontSize={9} formatter={(v: number) => v > 0 ? `${(v / 1000000).toFixed(1)}M` : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
