import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { loadDisinfoMonthly, loadDisinfoByLanguage } from '../../data/newLoader';
import type { DisinfoMonthly, DisinfoByLanguage } from '../../types';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const fmt = (n: number) => n.toLocaleString();

export default function DisinfoPanel() {
  const [monthly, setMonthly] = useState<DisinfoMonthly[]>([]);
  const [byLanguage, setByLanguage] = useState<DisinfoByLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadDisinfoMonthly(), loadDisinfoByLanguage()])
      .then(([m, l]) => { setMonthly(m); setByLanguage(l); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading disinformation data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  const topLanguages = byLanguage.slice(0, 15);

  return (
    <div>
      <h3>Disinformation (EUvsDisinfo)</h3>
      <p className="tab-subtitle">EU vs Disinformation project — debunked disinformation cases and articles</p>

      <div className="chart-card">
        <h3>Monthly Disinformation Cases</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthly} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number) => [fmt(v), 'Cases']} />
            <Line type="monotone" dataKey="cases" name="Disinfo Cases" stroke="#f97316" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Disinformation Articles by Language</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topLanguages} layout="vertical" margin={{ left: 100, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <YAxis dataKey="language" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={90} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Bar dataKey="count" name="Articles">
              {topLanguages.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
