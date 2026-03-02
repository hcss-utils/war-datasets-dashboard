import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { loadCyberIncidentsTimeline, loadCyberIncidentsByCountry } from '../../data/newLoader';
import type { CyberIncidentTimeline, CyberIncidentByCountry } from '../../types';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const fmt = (n: number) => n.toLocaleString();

export default function CyberPanel() {
  const [timeline, setTimeline] = useState<CyberIncidentTimeline[]>([]);
  const [byCountry, setByCountry] = useState<CyberIncidentByCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCyberIncidentsTimeline(), loadCyberIncidentsByCountry()])
      .then(([t, c]) => { setTimeline(t); setByCountry(c); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading cyber incidents...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  const topCountries = byCountry.slice(0, 15);

  return (
    <div>
      <h3>Cyber Incidents (EURepoC)</h3>
      <p className="tab-subtitle">European Repository of Cyber Incidents — state-sponsored and politically motivated attacks</p>

      <div className="chart-card">
        <h3>Monthly Cyber Incidents</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeline} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number) => [fmt(v), 'Incidents']} />
            <Line type="monotone" dataKey="incidents" name="Cyber Incidents" stroke="#06b6d4" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Top Initiator Countries</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topCountries} layout="vertical" margin={{ left: 120, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <YAxis dataKey="country" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
            <Bar dataKey="incidents" name="Incidents">
              {topCountries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
