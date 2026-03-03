import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { loadAcledHdxMonthly, loadAcledHdxByRegion } from '../../data/newLoader';
import type { AcledHdxMonthly, AcledHdxByRegion } from '../../types';

import { useSeriesToggle } from '../../hooks/useSeriesToggle';
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const fmt = (n: number) => n.toLocaleString();

export default function AcledHdxPanel() {
  const [monthly, setMonthly] = useState<AcledHdxMonthly[]>([]);
  const [byRegion, setByRegion] = useState<AcledHdxByRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadAcledHdxMonthly(), loadAcledHdxByRegion()])
      .then(([m, r]) => { setMonthly(m); setByRegion(r); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const lineToggle = useSeriesToggle();
  const barToggle = useSeriesToggle();

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading ACLED HDX data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // Convert text month names to month numbers
  const MONTH_MAP: Record<string, string> = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12',
  };

  // Aggregate monthly by data_type across all regions
  const monthlyByType: Record<string, Record<string, number>> = {};
  monthly.forEach(r => {
    const mm = MONTH_MAP[r.month] || '01';
    const key = `${r.year}-${mm}`;
    if (!monthlyByType[key]) monthlyByType[key] = { violence: 0, civilian: 0, demonstrations: 0 };
    monthlyByType[key][r.data_type] += r.events;
  });
  const monthlyChart = Object.entries(monthlyByType)
    .map(([month, counts]) => ({ month, ...counts }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const topRegions = byRegion.slice(0, 15);

  return (
    <div>
      <h3>ACLED HDX — Ukraine Regional Data</h3>
      <p className="tab-subtitle">ACLED Humanitarian Data Exchange — violence, civilian targeting, and demonstrations across Ukrainian oblasts</p>

      <div className="chart-card">
        <h3>Monthly Events by Type</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyChart} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50} interval={Math.max(1, Math.floor(monthlyChart.length / 12))}
              tickFormatter={(d) => {
                const [y, m] = d.split('-');
                return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend onClick={(e: any) => lineToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: lineToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
            <Line type="monotone" dataKey="violence" name="Violence" stroke="#ef4444" dot={false} strokeWidth={2} hide={!lineToggle.isVisible('violence')} />
            <Line type="monotone" dataKey="civilian" name="Civilian Targeting" stroke="#f97316" dot={false} strokeWidth={2} hide={!lineToggle.isVisible('civilian')} />
            <Line type="monotone" dataKey="demonstrations" name="Demonstrations" stroke="#3b82f6" dot={false} strokeWidth={1.5} hide={!lineToggle.isVisible('demonstrations')} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Top 15 Ukrainian Oblasts — Events by Type</h3>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={topRegions} layout="vertical" margin={{ left: 150, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <YAxis dataKey="admin1" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={140} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(v: number, name: string) => [v != null ? fmt(v) : 'N/A', name]} />
            <Legend onClick={(e: any) => barToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: barToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
            <Bar dataKey="violence_events" name="Violence Events" fill="#ef4444" hide={!barToggle.isVisible('violence_events')} />
            <Bar dataKey="civilian_events" name="Civilian Events" fill="#f97316" hide={!barToggle.isVisible('civilian_events')} />
            <Bar dataKey="demonstration_events" name="Demonstrations" fill="#3b82f6" hide={!barToggle.isVisible('demonstration_events')} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
