import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { loadDailyEvents, loadUcdpByViolenceType, loadUcdpMonthlyByType } from '../../data/newLoader';
import type { DailyEvent, UcdpByViolenceType, UcdpMonthlyByType } from '../../types';
import { PALETTE_20 } from '../../utils/colors';
import { smoothUcdpBatchSpikes } from '../../utils/smoothing';

const fmt = (n: number) => n.toLocaleString();
const VIOLENCE_COLORS: Record<string, string> = {
  'State-based': '#ef4444',
  'One-sided': '#f97316',
  'Non-state': '#eab308',
};

export default function UcdpPanel() {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [violenceTypes, setViolenceTypes] = useState<UcdpByViolenceType[]>([]);
  const [monthlyByType, setMonthlyByType] = useState<UcdpMonthlyByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smoothPeaks, setSmoothPeaks] = useState(false);
  const [excludeInvasion, setExcludeInvasion] = useState(false);

  useEffect(() => {
    Promise.all([loadDailyEvents(), loadUcdpByViolenceType(), loadUcdpMonthlyByType()])
      .then(([daily, vTypes, monthly]) => {
        setDailyEvents(daily);
        setViolenceTypes(vTypes);
        setMonthlyByType(monthly);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading UCDP data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load UCDP data</h3><p>{error}</p></div>;

  // Filter to only days with UCDP data
  const INVASION_START = '2022-02-24';
  const INVASION_END = '2022-03-31';
  const ucdpDays = dailyEvents.filter(d => {
    if (d.ucdp_events <= 0) return false;
    if (excludeInvasion && d.date >= INVASION_START && d.date <= INVASION_END) return false;
    return true;
  });
  const totalEvents = violenceTypes.reduce((s, v) => s + v.events, 0);
  const totalFatalities = violenceTypes.reduce((s, v) => s + v.fatalities, 0);

  // Last date with data
  const lastDate = ucdpDays.length > 0 ? new Date(ucdpDays[ucdpDays.length - 1].date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A';

  // Monthly aggregated (pivot violence types into columns)
  const monthlyPivoted: Record<string, Record<string, number | string>> = {};
  monthlyByType.forEach(m => {
    if (!monthlyPivoted[m.month]) monthlyPivoted[m.month] = { month: m.month };
    monthlyPivoted[m.month][`${m.violence_type_label}_events`] = m.events;
    monthlyPivoted[m.month][`${m.violence_type_label}_fatalities`] = m.fatalities;
  });
  const monthlyChart = Object.values(monthlyPivoted).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );
  const typeLabels = [...new Set(monthlyByType.map(m => m.violence_type_label))];

  return (
    <div>
      <h3>UCDP — Uppsala Conflict Data Program</h3>
      <p className="tab-subtitle">Fatality-verified conflict events from the Georeferenced Event Dataset (GED)</p>
      <p className="chart-note">UCDP requires at least one fatal casualty per event. Published in confirmed batches with several months lag. Last data: {lastDate}.</p>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{fmt(totalEvents)}</span>
          <span className="stat-label">Total Events</span>
        </div>
        <div className="stat-card highlight-red">
          <span className="stat-value">{fmt(totalFatalities)}</span>
          <span className="stat-label">Total Fatalities</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{ucdpDays.length}</span>
          <span className="stat-label">Days with Events</span>
        </div>
      </div>

      <div className="chart-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Daily UCDP Events & Fatalities</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setExcludeInvasion(p => !p)}
              style={{
                background: excludeInvasion ? '#f97316' : 'transparent',
                color: excludeInvasion ? '#fff' : '#888',
                border: `1px solid ${excludeInvasion ? '#f97316' : '#555'}`,
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s',
              }}
            >
              {excludeInvasion ? 'Invasion start excluded' : 'Exclude invasion start'}
            </button>
            <button
              onClick={() => setSmoothPeaks(p => !p)}
              style={{
                background: smoothPeaks ? '#3b82f6' : 'transparent',
                color: smoothPeaks ? '#fff' : '#888',
                border: `1px solid ${smoothPeaks ? '#3b82f6' : '#555'}`,
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s',
              }}
            >
              {smoothPeaks ? 'Smoothed (7-day avg)' : 'Smooth batch spikes'}
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={smoothPeaks ? smoothUcdpBatchSpikes(ucdpDays, ['ucdp_events', 'ucdp_fatalities']) : ucdpDays} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend />
            <Line type="monotone" dataKey="ucdp_events" name="Events" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="ucdp_fatalities" name="Fatalities" stroke="#2563eb" dot={false} strokeWidth={1} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by Violence Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={violenceTypes} margin={{ top: 10, right: 40, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="violence_type_label" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="events" name="Events">
                {violenceTypes.map((v, i) => <Cell key={i} fill={VIOLENCE_COLORS[v.violence_type_label] || PALETTE_20[i]} />)}
                <LabelList dataKey="events" position="top" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Fatalities by Violence Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={violenceTypes} margin={{ top: 10, right: 40, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="violence_type_label" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="fatalities" name="Fatalities">
                {violenceTypes.map((v, i) => <Cell key={i} fill={VIOLENCE_COLORS[v.violence_type_label] || PALETTE_20[i]} />)}
                <LabelList dataKey="fatalities" position="top" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Monthly Events by Violence Type</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={monthlyChart} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={60}
              interval={Math.max(1, Math.floor(monthlyChart.length / 15))}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Legend />
            {typeLabels.map(label => (
              <Area key={label} type="monotone" dataKey={`${label}_events`} name={label} stackId="1"
                stroke={VIOLENCE_COLORS[label] || '#888'} fill={VIOLENCE_COLORS[label] || '#888'} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Monthly Fatalities by Violence Type</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={monthlyChart} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={60}
              interval={Math.max(1, Math.floor(monthlyChart.length / 15))}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Legend />
            {typeLabels.map(label => (
              <Area key={label} type="monotone" dataKey={`${label}_fatalities`} name={label} stackId="1"
                stroke={VIOLENCE_COLORS[label] || '#888'} fill={VIOLENCE_COLORS[label] || '#888'} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
