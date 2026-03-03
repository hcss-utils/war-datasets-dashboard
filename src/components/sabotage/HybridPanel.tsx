import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { loadLeidenHybridEvents } from '../../data/newLoader';
import type { LeidenHybridEvent } from '../../types';
import { PALETTE_20 } from '../../utils/colors';
const fmt = (n: number) => n.toLocaleString();

export default function HybridPanel() {
  const [data, setData] = useState<LeidenHybridEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeidenHybridEvents()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading hybrid events...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // By category
  const categoryCount: Record<string, number> = {};
  data.forEach(d => {
    const cat = d.event_category || 'Unknown';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    if (d.event_category_2) categoryCount[d.event_category_2] = (categoryCount[d.event_category_2] || 0) + 1;
  });
  const byCategory = Object.entries(categoryCount)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // By year
  const yearCount: Record<number, number> = {};
  data.forEach(d => { yearCount[d.incident_year] = (yearCount[d.incident_year] || 0) + 1; });
  const byYear = Object.entries(yearCount)
    .map(([year, count]) => ({ year: String(year), count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  return (
    <div>
      <h3>Hybrid Threat Events (Leiden)</h3>
      <p className="tab-subtitle">Leiden University hybrid threat dataset — {data.length} events</p>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by Category</h3>
          <p className="chart-note">Events may appear in multiple categories.</p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 150, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
              <YAxis dataKey="category" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={140} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="count" name="Events">
                {byCategory.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Events by Year</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={byYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="year" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="count" name="Events" fill="#8b5cf6">
                <LabelList dataKey="count" position="top" fill="#888" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Recent Events</h3>
        <div className="incidents-timeline">
          {data.slice(-20).reverse().map((event) => (
            <div key={event.id} className="incident-card">
              <div className="incident-header">
                <span className="incident-date">{event.incident_year}{event.incident_month ? ` ${event.incident_month}` : ''}</span>
                <span className="incident-name">{event.event_category || 'Unknown category'}</span>
              </div>
              <div className="incident-detail"><strong>What:</strong> {event.what}</div>
              {event.where_location && <div className="incident-detail"><strong>Where:</strong> {event.where_location}</div>}
              {event.apparent_goal_1 && <div className="incident-detail"><strong>Goal:</strong> {event.apparent_goal_1}</div>}
              {event.target_type && <div className="incident-detail"><strong>Target:</strong> {event.target_type}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
