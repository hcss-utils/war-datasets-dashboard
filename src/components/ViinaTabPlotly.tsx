import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
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

// Color palette for sources
const PLOTLY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
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
  'VIINA': 'viina',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a
      href={`#sources-${sourceId}`}
      className="source-link-inline"
    >
      ({source})
    </a>
  );
};

// Plotly dark theme layout base
const darkLayout = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#b0b0b0', size: 11 },
  margin: { l: 60, r: 20, t: 40, b: 80 },
  xaxis: {
    gridcolor: '#333',
    linecolor: '#333',
    tickangle: -45,
  },
  yaxis: {
    gridcolor: '#333',
    linecolor: '#333',
  },
  legend: {
    bgcolor: 'transparent',
    font: { color: '#fff', size: 10 },
    itemclick: 'toggleothers' as const,
    itemdoubleclick: 'toggle' as const,
  },
  hoverlabel: {
    bgcolor: '#1a1a2e',
    bordercolor: '#333',
    font: { color: '#fff', size: 12 },
  },
  dragmode: 'zoom' as const,
  hovermode: 'x unified' as const,
};

export default function ViinaTabPlotly() {
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

  // Process data based on selected time unit for stacked bar
  const { stackedData, timelineData, sources } = useMemo(() => {
    let rawData: { date: string; source: string; events: number }[];
    let timeline: { date: string; events: number }[];

    switch (timeUnit) {
      case 'days':
        rawData = dailyBySource.map(d => ({ date: d.date, source: d.source, events: d.events }));
        timeline = daily.map(d => ({ date: d.date, events: d.events }));
        break;
      case 'weeks':
        rawData = weeklyBySource.map(d => ({ date: d.week, source: d.source, events: d.events }));
        timeline = weekly.map(d => ({ date: d.week, events: d.events }));
        break;
      case 'months':
      default:
        rawData = monthlyBySource.map(d => ({ date: d.month, source: d.source, events: d.events }));
        timeline = monthly.map(d => ({ date: d.month, events: d.events }));
        break;
    }

    // Get unique sources
    const uniqueSources = [...new Set(bySource.map(s => SOURCE_LABELS[s.source] || s.source))];

    // Aggregate data by date and source
    const aggregated: Record<string, Record<string, number>> = {};
    rawData.forEach(d => {
      const label = SOURCE_LABELS[d.source] || d.source;
      if (!aggregated[d.date]) aggregated[d.date] = {};
      aggregated[d.date][label] = (aggregated[d.date][label] || 0) + d.events;
    });

    const dates = Object.keys(aggregated).sort();
    const stackedData = {
      dates,
      bySource: uniqueSources.map(source => ({
        source,
        values: dates.map(date => aggregated[date]?.[source] || 0),
      })),
    };

    return { stackedData, timelineData: timeline, sources: uniqueSources };
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

  // Plotly dark theme layout base
  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#b0b0b0', size: 11 },
    margin: { l: 60, r: 20, t: 40, b: 80 },
    xaxis: {
      gridcolor: '#333',
      linecolor: '#333',
      tickangle: -45,
    },
    yaxis: {
      gridcolor: '#333',
      linecolor: '#333',
    },
    legend: {
      bgcolor: 'transparent',
      font: { color: '#fff', size: 10 },
    },
    hoverlabel: {
      bgcolor: '#1a1a2e',
      bordercolor: '#333',
      font: { color: '#fff', size: 12 },
    },
    dragmode: 'zoom' as const,
    hovermode: 'x unified' as const,
  };

  return (
    <div className="viina-tab">
      <h2>VIINA 2.0 - News-Based Event Tracking</h2>
      <p className="tab-subtitle">
        ML-classified conflict events from 16 Ukrainian and Russian news sources (552K+ events)
      </p>

      {/* Stacked bar chart with time unit picker */}
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
        <p className="chart-note">
          Drag on chart to zoom. Double-click to reset. Click legend to toggle sources.
        </p>
        <Plot
          data={stackedData.bySource.map((s, i) => ({
            x: stackedData.dates,
            y: s.values,
            type: 'bar' as const,
            name: s.source,
            marker: { color: PLOTLY_COLORS[i % PLOTLY_COLORS.length] },
            hoverlabel: { font: { color: '#fff' } },
          }))}
          layout={{
            ...darkLayout,
            barmode: 'stack',
            height: 450,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: {
              ...darkLayout.legend,
              orientation: 'h' as const,
              y: -0.3,
            },
          }}
          config={{ displayModeBar: true, displaylogo: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Daily events timeline */}
      <div className="chart-card">
        <h3>Daily Events Over Time <SourceLink source="VIINA" /></h3>
        <p className="chart-note">Drag to zoom. Use range buttons or slider. Double-click to reset.</p>
        <Plot
          data={[
            {
              x: daily.map(d => d.date),
              y: daily.map(d => d.events),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Events',
              line: { color: '#22c55e', width: 1.5 },
              fill: 'tozeroy',
              fillcolor: 'rgba(34, 197, 94, 0.2)',
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 350,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
              rangeselector: {
                buttons: [
                  { count: 1, label: '1M', step: 'month' as const, stepmode: 'backward' as const },
                  { count: 3, label: '3M', step: 'month' as const, stepmode: 'backward' as const },
                  { count: 6, label: '6M', step: 'month' as const, stepmode: 'backward' as const },
                  { count: 1, label: '1Y', step: 'year' as const, stepmode: 'backward' as const },
                  { step: 'all' as const, label: 'All' },
                ],
                bgcolor: '#1a1a2e',
                activecolor: '#22c55e',
                bordercolor: '#333',
                font: { color: '#fff', size: 10 },
              },
            },
          }}
          config={{ displayModeBar: true, displaylogo: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Pie chart for sources */}
        <div className="chart-card">
          <h3>Events by News Source <SourceLink source="VIINA" /></h3>
          <Plot
            data={[
              {
                values: pieData.map(d => d.value),
                labels: pieData.map(d => d.name),
                type: 'pie' as const,
                hole: 0.4,
                marker: { colors: PLOTLY_COLORS },
                textinfo: 'percent',
                textposition: 'inside',
                textfont: { color: '#fff', size: 11 },
                hovertemplate: '%{label}<br>%{value:,} events<br>%{percent}<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              margin: { l: 20, r: 20, t: 20, b: 20 },
              showlegend: true,
              legend: {
                ...darkLayout.legend,
                orientation: 'v' as const,
                x: 1,
                y: 0.5,
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Horizontal bar chart for oblasts */}
        <div className="chart-card">
          <h3>Top 10 Oblasts by Event Count <SourceLink source="VIINA" /></h3>
          <Plot
            data={[
              {
                x: topOblasts.map(d => d.events),
                y: topOblasts.map(d => d.oblast),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: {
                  color: topOblasts.map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]),
                },
                text: topOblasts.map(d => fmt(d.events)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 10 },
                hovertemplate: '%{y}<br>%{x:,} events<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              margin: { l: 120, r: 60, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, tickformat: ',' },
              yaxis: { ...darkLayout.yaxis, autorange: 'reversed' as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
