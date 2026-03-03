import { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { loadEnergyGasFlows, loadEnergyFossilRevenue } from '../../data/newLoader';
import type { EnergyGasFlow, EnergyFossilRevenue } from '../../types';

const fmt = (n: number) => n.toLocaleString();

export default function EnergyPanel() {
  const [gasFlows, setGasFlows] = useState<EnergyGasFlow[]>([]);
  const [fossil, setFossil] = useState<EnergyFossilRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadEnergyGasFlows(), loadEnergyFossilRevenue()])
      .then(([g, f]) => { setGasFlows(g); setFossil(f); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading energy data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  // Aggregate fossil revenue by month (sum across destinations)
  const fossilByMonth = fossil.reduce((acc, r) => {
    const key = r.month;
    if (!acc[key]) acc[key] = { month: key, total_eur: 0 };
    acc[key].total_eur += r.total_eur || 0;
    return acc;
  }, {} as Record<string, { month: string; total_eur: number }>);

  const fossilMonthly = Object.values(fossilByMonth).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div>
      <h3>Energy Flows &amp; Revenue</h3>
      <p className="tab-subtitle">EU gas pipeline flows (Bruegel) and Russia fossil fuel revenue (CREA)</p>

      <div className="chart-card">
        <h3>EU Gas Flows by Pipeline</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={gasFlows} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} label={{ value: 'GWh/day', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(v: number, name: string) => [v != null ? v.toFixed(1) : 'N/A', name]} />
            <Legend />
            <Area type="monotone" dataKey="nord_stream" name="Nord Stream" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.7} />
            <Area type="monotone" dataKey="ukraine_gas_transit" name="Ukraine Transit" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.7} />
            <Area type="monotone" dataKey="turkstream" name="TurkStream" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} />
            <Area type="monotone" dataKey="yamal_by_pl" name="Yamal" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.7} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>EU Total Gas Supply by Source</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={gasFlows} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(v: number, name: string) => [v != null ? v.toFixed(1) : 'N/A', name]} />
            <Legend />
            <Line type="monotone" dataKey="russia" name="Russia" stroke="#ef4444" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="norway" name="Norway" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="lng" name="LNG" stroke="#22c55e" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="algeria" name="Algeria" stroke="#f97316" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="azerbaijan" name="Azerbaijan" stroke="#8b5cf6" dot={false} strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
        <p className="chart-note">LNG = Liquefied Natural Gas imports (various origins including US, Qatar, Norway). Yamal pipeline flows near zero since May 2022 (reverse flow via Poland).</p>
      </div>

      <div className="chart-card">
        <h3>Russia Fossil Fuel Revenue (Monthly Total EUR)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={fossilMonthly} margin={{ top: 10, right: 20, bottom: 30, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="month" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              formatter={(v: number) => [`${(v / 1e6).toFixed(0)}M EUR`, 'Revenue']} />
            <Area type="monotone" dataKey="total_eur" name="Revenue (EUR)" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
