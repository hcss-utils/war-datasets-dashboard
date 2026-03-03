import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { loadGdeltRedlinesMonthly, loadGdeltRedlinesSources } from '../../data/newLoader';
import type { GdeltRedlinesMonthly, GdeltRedlinesSource } from '../../types';

import { PALETTE_20 } from '../../utils/colors';
const fmt = (n: number) => n.toLocaleString();

export default function RedLinesPanel() {
  const [monthly, setMonthly] = useState<GdeltRedlinesMonthly[]>([]);
  const [sources, setSources] = useState<GdeltRedlinesSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadGdeltRedlinesMonthly(), loadGdeltRedlinesSources()])
      .then(([m, s]) => { setMonthly(m); setSources(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading red lines data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  const topSources = sources.slice(0, 15);

  return (
    <div>
      <h3>Red Line Rhetoric</h3>
      <p className="tab-subtitle">GDELT GKG quotations mentioning "red line" in Russia-Ukraine context</p>

      <div className="chart-card">
        <h3>Monthly Red Line Quotations</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthly} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number) => [fmt(v), 'Records']} />
            <Line type="monotone" dataKey="records" name="Red Line Quotations" stroke="#dc2626" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Top 15 Sources for Red Line Discourse</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topSources} layout="vertical" margin={{ left: 150, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <YAxis dataKey="source" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={140} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Bar dataKey="count" name="Records">
              {topSources.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
