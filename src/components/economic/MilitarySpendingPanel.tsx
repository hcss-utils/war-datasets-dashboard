import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { loadSipriExpenditure } from '../../data/newLoader';
import type { SipriExpenditure } from '../../types';
import { useSeriesToggle } from '../../hooks/useSeriesToggle';

const COUNTRY_COLORS: Record<string, string> = {
  'Russia': '#ef4444',
  'Ukraine': '#eab308',
  'United States of America': '#3b82f6',
  'United Kingdom': '#06b6d4',
  'Germany': '#22c55e',
  'France': '#8b5cf6',
  'Poland': '#f97316',
  'China': '#ec4899',
  'Turkey': '#14b8a6',
  'India': '#f43f5e',
};

const fmt = (n: number) => n.toLocaleString();

export default function MilitarySpendingPanel() {
  const [data, setData] = useState<SipriExpenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSipriExpenditure()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const countryToggle = useSeriesToggle();

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading military spending...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // Pivot: year -> { year, Russia: x, Ukraine: y, ... }
  const countries = [...new Set(data.map(d => d.country))];
  const byYear: Record<number, Record<string, number | string>> = {};
  data.forEach(r => {
    if (!byYear[r.year]) byYear[r.year] = { year: r.year };
    byYear[r.year][r.country] = r.expenditure_usd;
  });
  const chartData = Object.values(byYear).sort((a, b) => Number(a.year) - Number(b.year));

  return (
    <div>
      <h3>Military Expenditure (SIPRI)</h3>
      <p className="tab-subtitle">Annual military spending in constant 2023 USD — key countries</p>

      <div className="chart-card">
        <h3>Military Expenditure Over Time</h3>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="year" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }}
              tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}B`} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(v: number, name: string) => [`$${(v / 1e3).toFixed(1)}B`, name]} />
            <Legend onClick={(e: any) => countryToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: countryToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
            {countries.map(c => (
              <Line key={c} type="monotone" dataKey={c} name={c}
                stroke={COUNTRY_COLORS[c] || '#888'} dot={false}
                strokeWidth={c === 'Russia' || c === 'Ukraine' ? 2.5 : 1.5}
                hide={!countryToggle.isVisible(c)} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="chart-note">Values in millions of constant 2023 USD</p>
      </div>
    </div>
  );
}
