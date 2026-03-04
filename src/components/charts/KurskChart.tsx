import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useDashboard } from '../../context/DashboardContext';
import EventOverlay from './shared/EventOverlay';
import ChartTooltip from './shared/ChartTooltip';
import ChartLegend from './shared/ChartLegend';
import { filterByDateRange, getLayerData } from '../../data/processing';
import type { DailyArea, MilitaryEvent } from '../../types';

const SOURCE_ID_MAP: Record<string, string> = {
  'ACLED': 'acled',
  'UCDP': 'ucdp',
  'ACLED/UCDP': 'acled',
  'VIINA': 'viina',
  'Bellingcat': 'bellingcat',
  'MDAA Tracker': 'mdaa',
  'Ukraine MOD': 'equipment',
  'DeepState': 'deepstate',
  'OHCHR': 'ohchr',
  'UNHCR': 'unhcr',
  'HDX HAPI': 'hapi',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a
      href={`#source-${sourceId}`}
      className="source-link-inline"
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = 'sources';
        setTimeout(() => {
          const el = document.getElementById(`source-${sourceId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }}
    >
      ({source})
    </a>
  );
};

interface Props {
  dailyAreas: DailyArea[];
  events: MilitaryEvent[];
}

const KURSK_PHASES = [
  { date: '2024-08-06', label: 'Phase 1: UKR Incursion' },
  { date: '2024-10-01', label: 'Phase 2: RU Counter' },
  { date: '2024-12-01', label: 'Phase 3: RU Advance' },
  { date: '2025-03-01', label: 'Phase 4: Consolidation' },
  { date: '2025-06-01', label: 'Phase 5: Full Recapture' },
];

export default function KurskChart({ dailyAreas, events }: Props) {
  const { state, dispatch } = useDashboard();

  const chartData = useMemo(() => {
    const filtered = filterByDateRange(dailyAreas, state.dateRange[0], state.dateRange[1]);
    const layer = getLayerData(filtered, 'kursk_russian_advances');
    const values = state.showInterpolation ? layer.interpolated : layer.raw;

    return layer.dates.map((date, i) => ({
      date,
      area: values[i],
    }));
  }, [dailyAreas, state.dateRange, state.showInterpolation]);

  const visibleEvents = useMemo(
    () => events.filter((e) => state.selectedEvents.includes(e.name)),
    [events, state.selectedEvents],
  );

  return (
    <div className="chart-card">
      <h2>Kursk Region — Russian Recapture <SourceLink source="DeepState" /></h2>
      <p className="subtitle">Russian advances in Kursk Oblast (km²)</p>
      <ChartLegend items={[
        { label: 'Kursk territory', color: '#ff7f0e' },
        { label: 'Phase markers', color: 'var(--text-muted)', dashed: true },
      ]} />
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 30, right: 20, bottom: 20, left: 20 }}>
          <defs>
            <linearGradient id="fillKursk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff7f0e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ff7f0e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            tickFormatter={(d: string) => d.substring(0, 7)}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            domain={['auto', 'auto']}
            label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip events={visibleEvents} />} />
          <Area
            type="stepAfter"
            dataKey="area"
            stroke="#ff7f0e"
            fill="url(#fillKursk)"
            strokeWidth={1.5}
            name="Kursk Territory"
            isAnimationActive={false}
          />
          {KURSK_PHASES.map((phase) => (
            <ReferenceLine
              key={phase.label}
              x={phase.date}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{ value: phase.label, position: 'top', fill: 'var(--text-muted)', fontSize: 9, angle: -30, offset: 10 }}
            />
          ))}
          <EventOverlay
            events={visibleEvents}
            highlightedEvent={state.highlightedEvent}
            onEventClick={(n) => dispatch({ type: 'SET_HIGHLIGHTED_EVENT', payload: n })}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
