import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line, ReferenceLine,
} from 'recharts';
import { useDashboard } from '../../context/DashboardContext';
import EventOverlay from './shared/EventOverlay';
import ChartTooltip from './shared/ChartTooltip';
import ChartLegend from './shared/ChartLegend';
import { filterByDateRange, getLayerData, linearTrend } from '../../data/processing';
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

export default function TerritoryControlChart({ dailyAreas, events }: Props) {
  const { state, dispatch } = useDashboard();

  const chartData = useMemo(() => {
    const filtered = filterByDateRange(dailyAreas, state.dateRange[0], state.dateRange[1]);
    const layer = getLayerData(filtered, 'ukraine_control_map');
    const trend = linearTrend(state.showInterpolation ? layer.interpolated : layer.raw);

    return layer.dates.map((date, i) => ({
      date,
      raw: layer.raw[i],
      interpolated: layer.interpolated[i],
      smoothed: layer.smoothed[i],
      trend: trend.trendValues[i],
    }));
  }, [dailyAreas, state.dateRange, state.showInterpolation]);

  const visibleEvents = useMemo(
    () => events.filter((e) => state.selectedEvents.includes(e.name)),
    [events, state.selectedEvents],
  );

  const valueKey = state.showInterpolation ? 'interpolated' : 'raw';

  return (
    <div className="chart-card">
      <h2>Russian-Controlled Territory in Ukraine <SourceLink source="DeepState" /></h2>
      <p className="subtitle">Total area under Russian control (km²) with key military events</p>
      <ChartLegend items={[
        { label: state.showInterpolation ? 'Interpolated' : 'Raw', color: '#2ca02c' },
        { label: 'Linear Trend', color: '#d62728', dashed: true },
        { label: 'Events (I≥8)', color: 'var(--color-event-critical)', dashed: true },
      ]} />
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={chartData} margin={{ top: 30, right: 20, bottom: 20, left: 20 }}>
          <defs>
            <linearGradient id="fillTerritory" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2ca02c" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2ca02c" stopOpacity={0.05} />
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
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            domain={['auto', 'auto']}
            label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip events={visibleEvents} />} />
          <Area
            type="stepAfter"
            dataKey={valueKey}
            stroke="#2ca02c"
            fill="url(#fillTerritory)"
            strokeWidth={1.5}
            name="Territory"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#d62728"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
            name="Trend"
            isAnimationActive={false}
          />
          <EventOverlay
            events={visibleEvents}
            highlightedEvent={state.highlightedEvent}
            onEventClick={(name) => dispatch({ type: 'SET_HIGHLIGHTED_EVENT', payload: name })}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
