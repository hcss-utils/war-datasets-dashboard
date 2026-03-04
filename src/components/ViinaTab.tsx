import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
  Brush,
} from 'recharts';
import ViinaEChartsDemo from './charts/ViinaEChartsDemo';
import ViinaPlotlyDemo from './charts/ViinaPlotlyDemo';
import {
  loadViinaDaily,
  loadViinaMonthly,
  loadViinaBySource,
  loadViinaByOblast,
  loadViinaMonthlyBySource,
  loadViinaWeekly,
  loadViinaWeeklyBySource,
  loadViinaDailyBySource,
} from '../data/newLoader';
import type {
  ViinaDaily,
  ViinaMonthly,
  ViinaBySource,
  ViinaByOblast,
  ViinaMonthlyBySource,
  ViinaWeekly,
  ViinaWeeklyBySource,
  ViinaDailyBySource,
} from '../types';

const fmt = (n: number) => n.toLocaleString();

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const TAB20_COLORS = [
  '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
  '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
  '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
  '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
];

// Source name mapping for better labels
const SOURCE_LABELS: Record<string, string> = {
  'nv': 'NV (UA)',
  'ria': 'RIA (RU)',
  'interfax': 'Interfax',
  'tass': 'TASS (RU)',
  'pravda': 'Pravda (UA)',
  'unian': 'UNIAN (UA)',
  'kp': 'KP (RU)',
  'rbc': 'RBC (RU)',
  'focus': 'Focus (UA)',
  'comments': 'Comments (UA)',
  'lenta': 'Lenta (RU)',
  'gazeta': 'Gazeta (RU)',
  'hromadske': 'Hromadske (UA)',
  'ukrinform': 'Ukrinform (UA)',
  'donday': 'Donday',
  'ura': 'URA (RU)',
};

type TimeUnit = 'days' | 'weeks' | 'months';

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

export default function ViinaTab() {
  const [daily, setDaily] = useState<ViinaDaily[]>([]);
  const [weekly, setWeekly] = useState<ViinaWeekly[]>([]);
  const [monthly, setMonthly] = useState<ViinaMonthly[]>([]);
  const [bySource, setBySource] = useState<ViinaBySource[]>([]);
  const [byOblast, setByOblast] = useState<ViinaByOblast[]>([]);
  const [monthlyBySource, setMonthlyBySource] = useState<ViinaMonthlyBySource[]>([]);
  const [weeklyBySource, setWeeklyBySource] = useState<ViinaWeeklyBySource[]>([]);
  const [dailyBySource, setDailyBySource] = useState<ViinaDailyBySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('months');

  useEffect(() => {
    Promise.all([
      loadViinaDaily(),
      loadViinaWeekly(),
      loadViinaMonthly(),
      loadViinaBySource(),
      loadViinaByOblast(),
      loadViinaMonthlyBySource(),
      loadViinaWeeklyBySource(),
      loadViinaDailyBySource(),
    ])
      .then(([d, w, m, s, o, ms, ws, ds]) => {
        setDaily(d);
        setWeekly(w);
        setMonthly(m);
        setBySource(s);
        setByOblast(o);
        setMonthlyBySource(ms);
        setWeeklyBySource(ws);
        setDailyBySource(ds);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Process data based on selected time unit
  const { chartData, dateKey, sources, timelineData } = useMemo(() => {
    let rawData: { date?: string; week?: string; month?: string; source: string; events: number }[];
    let key: string;
    let timeline: { date: string; events: number }[];

    switch (timeUnit) {
      case 'days':
        rawData = dailyBySource.map(d => ({ date: d.date, source: d.source, events: d.events }));
        key = 'date';
        timeline = daily.map(d => ({ date: d.date, events: d.events }));
        break;
      case 'weeks':
        rawData = weeklyBySource.map(d => ({ date: d.week, source: d.source, events: d.events }));
        key = 'date';
        timeline = weekly.map(d => ({ date: d.week, events: d.events }));
        break;
      case 'months':
      default:
        rawData = monthlyBySource.map(d => ({ date: d.month, source: d.source, events: d.events }));
        key = 'date';
        timeline = monthly.map(d => ({ date: d.month, events: d.events }));
        break;
    }

    // Aggregate for stacked chart
    const aggregated = rawData.reduce((acc, m) => {
      const dateVal = m.date || m.week || m.month || '';
      if (!acc[dateVal]) acc[dateVal] = { [key]: dateVal } as Record<string, string | number>;
      const label = SOURCE_LABELS[m.source] || m.source;
      acc[dateVal][label] = ((acc[dateVal][label] as number) || 0) + m.events;
      return acc;
    }, {} as Record<string, Record<string, number | string>>);

    const chartData = Object.values(aggregated).sort((a, b) =>
      String(a[key]).localeCompare(String(b[key]))
    );

    const sources = [...new Set(bySource.map(s => SOURCE_LABELS[s.source] || s.source))];

    return { chartData, dateKey: key, sources, timelineData: timeline };
  }, [timeUnit, daily, weekly, monthly, dailyBySource, weeklyBySource, monthlyBySource, bySource]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading VIINA data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load VIINA data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Top 10 oblasts
  const topOblasts = byOblast.slice(0, 10).sort((a, b) => a.oblast.localeCompare(b.oblast));

  // Pie data for sources
  const sourceTotal = bySource.reduce((s, d) => s + d.events, 0);
  const pieData = bySource.slice(0, 8).map(d => ({
    name: SOURCE_LABELS[d.source] || d.source,
    value: d.events,
    pct: ((d.events / sourceTotal) * 100).toFixed(1),
  }));

  const handleLegendClick = (dataKey: string) => {
    setSelectedSource(prev => prev === dataKey ? null : dataKey);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    switch (timeUnit) {
      case 'days':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'weeks':
        return `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`;
      case 'months':
      default:
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  return (
    <div className="viina-tab">
      <h2>VIINA 2.0 - News-Based Event Tracking</h2>
      <p className="tab-subtitle">
        ML-classified conflict events from 16 Ukrainian and Russian news sources (552K+ events)
      </p>

      {/* Stacked bar chart moved to top with time unit picker */}
      <div className="chart-card">
        <div className="chart-header-with-controls">
          <h3>Events by Source Over Time <SourceLink source="VIINA" /></h3>
          <div className="time-unit-picker">
            <label>Time unit:</label>
            <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>
        <p className="chart-note">Click a legend item to show only that source; click again to show all. Drag the brush below to zoom.</p>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey={dateKey}
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={timeUnit === 'days' ? 30 : timeUnit === 'weeks' ? 8 : 2}
              tickFormatter={formatDate}
            />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              formatter={(value: number) => fmt(value)}
              labelFormatter={formatDate}
            />
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey as string)}
              formatter={(value: string, entry: any) => (
                <span style={{
                  color: selectedSource === null || selectedSource === entry.dataKey ? '#fff' : '#666',
                  fontWeight: selectedSource === entry.dataKey ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}>
                  {value}
                </span>
              )}
            />
            <Brush
              dataKey={dateKey}
              height={30}
              stroke="#4b8bbe"
              fill="#1a1a2e"
              tickFormatter={formatDate}
            />
            {sources.map((source, i) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="a"
                fill={TAB20_COLORS[i % TAB20_COLORS.length]}
                hide={selectedSource !== null && selectedSource !== source}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Daily Events Over Time <SourceLink source="VIINA" /></h3>
        <p className="chart-note">Drag the brush below to zoom into a date range</p>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={daily} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={50}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(value: number) => [fmt(value), 'Events']}
            />
            <Brush
              dataKey="date"
              height={30}
              stroke="#22c55e"
              fill="#1a1a2e"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <Line type="monotone" dataKey="events" stroke="#22c55e" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ECharts Demo */}
      <ViinaEChartsDemo data={daily} />

      {/* Plotly Demo - True drag-to-zoom */}
      <ViinaPlotlyDemo data={daily} />

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by News Source <SourceLink source="VIINA" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="40%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                dataKey="value"
                paddingAngle={2}
                label={({ pct }) => `${pct}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value: string) => {
                  const item = pieData.find(d => d.name === value);
                  return `${value} (${item?.pct || 0}%)`;
                }}
                wrapperStyle={{ fontSize: 11, paddingLeft: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top 10 Oblasts by Event Count <SourceLink source="VIINA" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topOblasts} layout="vertical" margin={{ right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmt} />
              <YAxis
                dataKey="oblast"
                type="category"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="events" name="Events">
                {topOblasts.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={TAB20_COLORS[index % TAB20_COLORS.length]} />
                ))}
                <LabelList dataKey="events" position="right" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
