import { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { loadGdeltVarxWeekly } from '../../data/newLoader';
import type { GdeltVarxWeekly } from '../../types';

const fmt = (n: number) => n.toLocaleString();

export default function EscalationPanel() {
  const [data, setData] = useState<GdeltVarxWeekly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGdeltVarxWeekly()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading escalation index...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  return (
    <div>
      <h3>Weekly Escalation Index (GDELT VARX)</h3>
      <p className="tab-subtitle">Weekly media volume, tone, and keyword counts from GDELT — {data.length} weeks</p>

      <div className="chart-card">
        <h3>Media Volume &amp; Russia Share</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 60, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="week" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fill: '#888', fontSize: 10 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => `Week of ${new Date(d).toLocaleDateString()}`}
              formatter={(v: number, name: string) => [name.includes('Share') ? `${(v * 100).toFixed(1)}%` : fmt(v), name]} />
            <Legend />
            <Line type="monotone" dataKey="media_volume_all" name="Total Volume" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="media_volume_russia" name="Russia Volume" stroke="#ef4444" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="russia_share" name="Russia Share" stroke="#eab308" dot={false} strokeWidth={1.5} yAxisId="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Media Tone (Mean &amp; Negativity)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="week" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => `Week of ${new Date(d).toLocaleDateString()}`}
              formatter={(v: number, name: string) => [v.toFixed(2), name]} />
            <Legend />
            <Line type="monotone" dataKey="media_tone_mean" name="Tone Mean" stroke="#22c55e" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="media_negativity_mean" name="Negativity Mean" stroke="#ef4444" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Keyword Counts (Nuclear, Threat, Red Line, Escalation)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="week" stroke="#888" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => `Week of ${new Date(d).toLocaleDateString()}`}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend />
            <Area type="monotone" dataKey="nuclear_quote_count" name="Nuclear" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
            <Area type="monotone" dataKey="threat_quote_count" name="Threat" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
            <Area type="monotone" dataKey="redline_quote_count" name="Red Line" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} />
            <Area type="monotone" dataKey="escalation_quote_count" name="Escalation" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="ultimatum_quote_count" name="Ultimatum" stackId="1" stroke="#ec4899" fill="#ec4899" fillOpacity={0.6} />
            <Area type="monotone" dataKey="deter_quote_count" name="Deterrence" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
