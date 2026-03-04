import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Cell,
} from 'recharts';
import { useDashboard } from '../../context/DashboardContext';
import { getEventColor } from './shared/EventOverlay';
import type { MilitaryEvent } from '../../types';

interface Props {
  events: MilitaryEvent[];
}

function EvtTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MilitaryEvent }> }) {
  if (!active || !payload?.length) return null;
  const e = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.name}</div>
      <div className="tooltip-row"><span>Strategic:</span> <span className="tooltip-value">{e.strategic}</span></div>
      <div className="tooltip-row"><span>Territorial:</span> <span className="tooltip-value">{e.territorial}</span></div>
      <div className="tooltip-row"><span>Cascade:</span> <span className="tooltip-value">{e.cascade}</span></div>
      <div className="tooltip-row"><span>Importance:</span> <span className="tooltip-value">{e.importance}</span></div>
    </div>
  );
}

export default function EventScatterChart({ events }: Props) {
  const { state } = useDashboard();

  const filtered = useMemo(() => {
    const startStr = state.dateRange[0].toISOString().substring(0, 10);
    const endStr = state.dateRange[1].toISOString().substring(0, 10);
    return events.filter((e) => e.date >= startStr && e.date <= endStr);
  }, [events, state.dateRange]);

  return (
    <div className="chart-card">
      <h2>Strategic vs Territorial Impact</h2>
      <p className="subtitle">Bubble size = cascade score, color = importance</p>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="strategic"
            type="number"
            domain={[0, 4]}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            name="Strategic"
            label={{ value: 'Strategic Score', position: 'insideBottom', fill: 'var(--text-secondary)', fontSize: 11, offset: -10 }}
          />
          <YAxis
            dataKey="territorial"
            type="number"
            domain={[0, 4]}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            name="Territorial"
            label={{ value: 'Territorial Score', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <ZAxis dataKey="cascade" range={[60, 500]} name="Cascade" />
          <Tooltip content={<EvtTooltip />} />
          <Scatter data={filtered} isAnimationActive={false}>
            {filtered.map((e) => (
              <Cell
                key={e.name}
                fill={getEventColor(e.importance)}
                opacity={0.8}
                stroke={state.highlightedEvent === e.name ? '#fff' : 'none'}
                strokeWidth={state.highlightedEvent === e.name ? 2 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
