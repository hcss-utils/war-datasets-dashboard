import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { loadGdeltEventsMonthly, loadGdeltEventsByTarget, loadGdeltGoldstein } from '../../data/newLoader';
import type { GdeltEventsMonthly, GdeltEventsByTarget, GdeltGoldstein } from '../../types';

import { PALETTE_20 } from '../../utils/colors';
import { useSeriesToggle } from '../../hooks/useSeriesToggle';

const MERGE_TARGETS: Record<string, string> = {
  'UKRAINE': 'UKR', 'UKRAINIAN': 'UKR', 'CRIMEA': 'UKR', 'KYIV': 'UKR',
  'RUSSIA': 'RUS', 'RUSSIAN': 'RUS', 'VLADIMIR PUTIN': 'RUS', 'MOSCOW': 'RUS',
  'EUROPE': 'EUR', 'EUROPEAN': 'EUR',
  'UNITED STATES': 'USA', 'AMERICAN': 'USA',
  'NORTH ATLANTIC': 'NATO',
};
const fmt = (n: number) => n.toLocaleString();

export default function ThreatEventsPanel() {
  const [monthly, setMonthly] = useState<GdeltEventsMonthly[]>([]);
  const [byTarget, setByTarget] = useState<GdeltEventsByTarget[]>([]);
  const [goldstein, setGoldstein] = useState<GdeltGoldstein[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadGdeltEventsMonthly(), loadGdeltEventsByTarget(), loadGdeltGoldstein()])
      .then(([m, t, g]) => { setMonthly(m); setByTarget(t); setGoldstein(g); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const threatToggle = useSeriesToggle();

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading threat events...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // Merge duplicate country variants before taking top 15
  const mergedTargets: Record<string, number> = {};
  byTarget.forEach(t => {
    const key = MERGE_TARGETS[t.country?.toUpperCase()] || t.country;
    mergedTargets[key] = (mergedTargets[key] || 0) + t.events;
  });
  const topTargets = Object.entries(mergedTargets)
    .map(([country, events]) => ({ country, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 15);

  return (
    <div>
      <h3>GDELT Threat Events (EventRootCode=13)</h3>
      <p className="tab-subtitle">Russian THREATEN events from GDELT — structured geopolitical event records</p>

      <div className="chart-card">
        <h3>Monthly Threat Event Count</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthly} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend onClick={(e: any) => threatToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: threatToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
            <Line type="monotone" dataKey="events" name="Threat Events" stroke="#ef4444" dot={false} strokeWidth={2} hide={!threatToggle.isVisible('events')} />
            <Line type="monotone" dataKey="total_mentions" name="Media Mentions" stroke="#3b82f6" dot={false} strokeWidth={1.5} yAxisId="right" hide={!threatToggle.isVisible('total_mentions')} />
            <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Top 15 Targets (Actor2)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topTargets} layout="vertical" margin={{ right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <YAxis dataKey="country" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={60} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="events" name="Threat Events">
                {topTargets.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Goldstein Scale Distribution</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={goldstein}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="goldstein_bin" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} label={{ value: 'Goldstein Scale', position: 'bottom', fill: '#888' }} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="count" name="Events" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
          <p className="chart-note">Negative = conflict/threat, Positive = cooperation. Most threat events cluster around -7 to -4.</p>
        </div>
      </div>
    </div>
  );
}
