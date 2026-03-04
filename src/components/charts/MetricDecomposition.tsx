import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useDashboard } from '../../context/DashboardContext';
import type { MilitaryEvent } from '../../types';

interface Props {
  events: MilitaryEvent[];
}

function DecompTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="tooltip-date">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="tooltip-value">{p.value}</span>
        </div>
      ))}
      <div className="tooltip-row" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 4, marginTop: 4 }}>
        <span>Total:</span>
        <span className="tooltip-value">{payload.reduce((s, p) => s + p.value, 0)}</span>
      </div>
    </div>
  );
}

export default function MetricDecomposition({ events }: Props) {
  const { state } = useDashboard();

  const chartData = useMemo(() => {
    const startStr = state.dateRange[0].toISOString().substring(0, 10);
    const endStr = state.dateRange[1].toISOString().substring(0, 10);
    return events
      .filter((e) => e.date >= startStr && e.date <= endStr)
      .sort((a, b) => b.importance - a.importance)
      .map((e) => ({
        name: e.name.length > 18 ? e.name.substring(0, 16) + '...' : e.name,
        fullName: e.name,
        Territorial: e.territorial,
        Strategic: e.strategic,
        Cascade: e.cascade,
      }));
  }, [events, state.dateRange]);

  return (
    <div className="chart-card">
      <h2>Event Metric Decomposition</h2>
      <p className="subtitle">Stacked T/S/C scores per event, sorted by importance</p>
      <ResponsiveContainer width="100%" height={Math.max(350, chartData.length * 24 + 80)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 10]}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            label={{ value: 'Score', position: 'insideBottom', fill: 'var(--text-secondary)', fontSize: 11, offset: -10 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            width={130}
          />
          <Tooltip content={<DecompTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
          />
          <Bar dataKey="Territorial" stackId="a" fill="var(--color-territorial)" isAnimationActive={false} />
          <Bar dataKey="Strategic" stackId="a" fill="var(--color-strategic)" isAnimationActive={false} />
          <Bar dataKey="Cascade" stackId="a" fill="var(--color-cascade)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
