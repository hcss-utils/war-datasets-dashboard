import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { loadKielAidByDonor, loadKielAidTimeline, loadSanctionsEuSummary, loadSanctionsEuTimeline } from '../../data/newLoader';
import type { KielAidByDonor, KielAidTimeline, SanctionsEuSummary, SanctionsEuTimeline } from '../../types';

import { PALETTE_20 } from '../../utils/colors';

const ENTITY_LABELS: Record<string, string> = {
  'Person': 'Person', 'Organization': 'Organization',
  'LegalEntity': 'Legal Entity', 'Company': 'Company',
  'PublicBody': 'Public Body', 'Vessel': 'Vessel',
};
const fmt = (n: number) => n.toLocaleString();

export default function AidSanctionsPanel() {
  const [aidByDonor, setAidByDonor] = useState<KielAidByDonor[]>([]);
  const [aidTimeline, setAidTimeline] = useState<KielAidTimeline[]>([]);
  const [sanctionsSummary, setSanctionsSummary] = useState<SanctionsEuSummary[]>([]);
  const [sanctionsTimeline, setSanctionsTimeline] = useState<SanctionsEuTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadKielAidByDonor(), loadKielAidTimeline(), loadSanctionsEuSummary(), loadSanctionsEuTimeline()])
      .then(([d, t, s, st]) => {
        setAidByDonor(d); setAidTimeline(t); setSanctionsSummary(s); setSanctionsTimeline(st);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading aid &amp; sanctions...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // Aggregate aid by donor (top 15, sum across aid types)
  const donorAgg: Record<string, number> = {};
  aidByDonor.forEach(r => { donorAgg[r.donor] = (donorAgg[r.donor] || 0) + (r.total_eur || 0); });
  const topDonors = Object.entries(donorAgg)
    .map(([donor, total_eur]) => ({ donor, total_eur }))
    .sort((a, b) => b.total_eur - a.total_eur)
    .slice(0, 15);

  // Monthly aid cumulative
  const monthlyAid: Record<string, number> = {};
  aidTimeline.forEach(r => { monthlyAid[r.month] = (monthlyAid[r.month] || 0) + (r.total_eur || 0); });
  let cumulative = 0;
  const cumulativeAid = Object.entries(monthlyAid)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total_eur]) => {
      cumulative += total_eur;
      return { month, monthly_eur: total_eur, cumulative_eur: cumulative };
    });

  // Sanctions cumulative by month
  const sanctionsMonthly: Record<string, number> = {};
  sanctionsTimeline.forEach(r => { sanctionsMonthly[r.month] = (sanctionsMonthly[r.month] || 0) + r.count; });
  let sanctionsCum = 0;
  const cumulativeSanctions = Object.entries(sanctionsMonthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => {
      sanctionsCum += count;
      return { month, new_sanctions: count, cumulative: sanctionsCum };
    });

  const sanctionsTotal = sanctionsSummary.reduce((s, r) => s + r.count, 0);
  const sanctionsPie = sanctionsSummary
    .map(r => ({
      name: ENTITY_LABELS[r.schema_type] || r.schema_type,
      value: r.count,
      pct: ((r.count / sanctionsTotal) * 100).toFixed(0),
    }))
    .filter(r => parseFloat(r.pct) >= 1);

  return (
    <div>
      <h3>Aid &amp; Sanctions</h3>
      <p className="tab-subtitle">Kiel Institute Ukraine aid tracker &amp; EU sanctions (OpenSanctions)</p>

      <div className="chart-card">
        <h3>Top 15 Donors (Kiel Aid Tracker, EUR)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topDonors} layout="vertical" margin={{ left: 120, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
            <YAxis dataKey="donor" type="category" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(v: number) => [`${(v / 1e6).toFixed(0)}M EUR`, 'Total']} />
            <Bar dataKey="total_eur" name="Aid (EUR)">
              {topDonors.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Cumulative Aid Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cumulativeAid} margin={{ top: 10, right: 20, bottom: 30, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${(v / 1e9).toFixed(0)}B`} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number, name: string) => [`${(v / 1e9).toFixed(2)}B EUR`, name]} />
            <Legend />
            <Line type="monotone" dataKey="cumulative_eur" name="Cumulative Aid (EUR)" stroke="#22c55e" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>EU Sanctions by Entity Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sanctionsPie} cx="40%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" paddingAngle={2}
                label={({ pct }) => `${pct}%`} labelLine={false}>
                {sanctionsPie.map((_, i) => <Cell key={i} fill={PALETTE_20[i % PALETTE_20.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                formatter={(v: number, name: string) => [fmt(v), name]} />
              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Cumulative Sanctions Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativeSanctions} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                formatter={(v: number, name: string) => [fmt(v), name]} />
              <Legend />
              <Line type="monotone" dataKey="cumulative" name="Cumulative Sanctions" stroke="#ef4444" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
