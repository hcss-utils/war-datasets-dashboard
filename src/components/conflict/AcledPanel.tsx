import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { loadDailyEvents, loadEventsByType, loadEventsByRegion, loadMonthlyEvents } from '../../data/newLoader';
import type { DailyEvent, EventByType, EventByRegion, MonthlyEventData } from '../../types';
import { PALETTE_20 } from '../../utils/colors';

const fmt = (n: number) => n.toLocaleString();

export default function AcledPanel() {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [eventsByType, setEventsByType] = useState<EventByType[]>([]);
  const [eventsByRegion, setEventsByRegion] = useState<EventByRegion[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadDailyEvents(), loadEventsByType(), loadEventsByRegion(), loadMonthlyEvents()])
      .then(([daily, types, regions, monthly]) => {
        setDailyEvents(daily);
        setEventsByType(types);
        setEventsByRegion(regions);
        setMonthlyEvents(monthly);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading ACLED data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load ACLED data</h3><p>{error}</p></div>;

  const recentEvents = dailyEvents.slice(-365);

  // Total stats
  const totalEvents = recentEvents.reduce((s, d) => s + d.acled_events, 0);
  const totalFatalities = recentEvents.reduce((s, d) => s + d.acled_fatalities, 0);

  // Events by type (pie chart)
  const typeAggregates = eventsByType.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + e.count;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(typeAggregates).map(([name, value]) => ({ name, value }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const pieDataWithPct = pieData
    .map(d => ({ ...d, pct: ((d.value / pieTotal) * 100).toFixed(0) }))
    .filter(d => parseFloat(d.pct) >= 1);

  // Top regions
  const topRegions = eventsByRegion.slice(0, 15).sort((a, b) => b.events - a.events);

  // Monthly aggregated
  const monthlyAggregated = monthlyEvents.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    acc[key][m.event_type] = ((acc[key][m.event_type] as number) || 0) + m.events;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);
  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );
  const eventTypes = [...new Set(monthlyEvents.map(m => m.event_type))];

  return (
    <div>
      <h3>ACLED — Armed Conflict Location & Event Data</h3>
      <p className="tab-subtitle">Weekly-updated conflict events including non-fatal incidents</p>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{fmt(totalEvents)}</span>
          <span className="stat-label">Events (last 365 days)</span>
        </div>
        <div className="stat-card highlight-red">
          <span className="stat-value">{fmt(totalFatalities)}</span>
          <span className="stat-label">Fatalities (last 365 days)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(pieTotal)}</span>
          <span className="stat-label">Total Events (all time)</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>Daily ACLED Events & Fatalities</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={recentEvents} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend />
            <Line type="monotone" dataKey="acled_events" name="Events" stroke="#ef4444" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="acled_fatalities" name="Fatalities" stroke="#dc2626" dot={false} strokeWidth={1} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by Type</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={pieDataWithPct} cx="50%" cy="50%" outerRadius={100} innerRadius={55} dataKey="value" paddingAngle={2}
                label={({ name, pct, cx: pieCx, cy: pieCy, midAngle, outerRadius: oR }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = (oR as number) + 20;
                  const x = (pieCx as number) + radius * Math.cos(-midAngle * RADIAN);
                  const y = (pieCy as number) + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="#ccc" fontSize={10} textAnchor={x > (pieCx as number) ? 'start' : 'end'} dominantBaseline="central">
                      {`${name} ${pct}%`}
                    </text>
                  );
                }}
                labelLine={{ stroke: '#666', strokeWidth: 1 }}>
                {pieDataWithPct.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                formatter={(v: number, name: string) => [fmt(v), name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top 15 Regions by Event Count</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topRegions} layout="vertical" margin={{ right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <YAxis dataKey="region" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="events" name="Events">
                {topRegions.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
                <LabelList dataKey="events" position="right" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Monthly Events by Type</h3>
        <p className="chart-note">Click a legend item to isolate; click again to show all</p>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyChartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={70}
              interval={Math.max(1, Math.floor(monthlyChartData.length / 15))}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Legend
              onClick={(e) => setSelectedType(prev => prev === (e.dataKey as string) ? null : (e.dataKey as string))}
              formatter={(value: string) => (
                <span style={{ color: selectedType === null || selectedType === value ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>
              )}
            />
            {eventTypes.map((type, i) => (
              <Bar key={type} dataKey={type} stackId="a" fill={PALETTE_20[i % PALETTE_20.length]}
                hide={selectedType !== null && selectedType !== type} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
