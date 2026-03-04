import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import {
  loadViinaDaily,
  loadViinaMonthly,
  loadViinaBySource,
  loadViinaByOblast,
  loadViinaMonthlyBySource,
  loadViinaWeekly,
  loadViinaWeeklyBySource,
  loadViinaDailyBySource,
} from '../../data/newLoader';
import type {
  ViinaDaily,
  ViinaMonthly,
  ViinaBySource,
  ViinaByOblast,
  ViinaMonthlyBySource,
  ViinaWeekly,
  ViinaWeeklyBySource,
  ViinaDailyBySource,
} from '../../types';

const fmt = (n: number) => n.toLocaleString();

const SourceLink = ({ source, sourceId }: { source: string; sourceId?: string }) => {
  const id = sourceId || source.toLowerCase();
  return (
    <a href={`#sources-${id}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const PLOTLY_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
];

const SOURCE_LABELS: Record<string, string> = {
  'liveuamap': 'LiveUAMap',
  'ria': 'RIA (RU)',
  'pravdaua': 'Pravda (UA)',
  'nv': 'NV (UA)',
  'unian': 'UNIAN (UA)',
  'espreso': 'Espreso (UA)',
  'interfaxua': 'Interfax UA',
  '24tvua': '24TV (UA)',
  'liga': 'Liga (UA)',
  'meduza': 'Meduza',
  'ntv': 'NTV (RU)',
  'ng': 'NG (RU)',
  'militarnyy': 'Militarnyy',
  'mz': 'MZ',
  'forbesua': 'Forbes UA',
  'kp': 'KP (RU)',
};

type TimeUnit = 'days' | 'weeks' | 'months';

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

const plotConfig = { displayModeBar: true, displaylogo: false, responsive: true };

interface VIINASubtabProps {
  selectedSources: Set<string>;
}

export default function VIINASubtab({ selectedSources }: VIINASubtabProps) {
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

  const { xaxisRange, onRelayout } = usePlotlyZoom();

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

  // Process and filter data based on selected sources
  const { stackedData, filteredBySource, totalFilteredEvents } = useMemo(() => {
    // Filter bySource based on selectedSources
    const filteredBySource = bySource.filter(s => selectedSources.has(s.source));
    const totalFilteredEvents = filteredBySource.reduce((sum, s) => sum + s.events, 0);

    let rawData: { date: string; source: string; events: number }[];

    switch (timeUnit) {
      case 'days':
        rawData = dailyBySource
          .filter(d => selectedSources.has(d.source))
          .map(d => ({ date: d.date, source: d.source, events: d.events }));
        break;
      case 'weeks':
        rawData = weeklyBySource
          .filter(d => selectedSources.has(d.source))
          .map(d => ({ date: d.week, source: d.source, events: d.events }));
        break;
      case 'months':
      default:
        rawData = monthlyBySource
          .filter(d => selectedSources.has(d.source))
          .map(d => ({ date: d.month, source: d.source, events: d.events }));
        break;
    }

    // Get unique sources that are selected
    const uniqueSources = [...selectedSources].map(s => SOURCE_LABELS[s] || s);

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

    return { stackedData, filteredBySource, totalFilteredEvents };
  }, [timeUnit, dailyBySource, weeklyBySource, monthlyBySource, bySource, selectedSources]);

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

  // Pie data for filtered sources
  const pieData = filteredBySource.slice(0, 8).map(d => ({
    name: SOURCE_LABELS[d.source] || d.source,
    value: d.events,
  }));

  // Calculate totals for timeline from filtered data
  const timelineTotals = stackedData.dates.map((date, i) => {
    const total = stackedData.bySource.reduce((sum, s) => sum + s.values[i], 0);
    return { date, total };
  });

  return (
    <div className="conflict-subtab">
      <h2>VIINA 2.0 - News-Based Event Tracking</h2>
      <p className="tab-subtitle">
        ML-classified conflict events from Ukrainian and Russian news sources
      </p>

      {/* Stats row */}
      <div className="conflict-stats">
        <div className="stat-card">
          <span className="stat-value">{totalFilteredEvents.toLocaleString()}</span>
          <span className="stat-label">Filtered Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{selectedSources.size}</span>
          <span className="stat-label">Sources Selected</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byOblast.length}</span>
          <span className="stat-label">Oblasts Covered</span>
        </div>
      </div>

      {selectedSources.size === 0 ? (
        <div className="chart-card">
          <p className="no-data-msg">Select at least one news source from the sidebar to view data.</p>
        </div>
      ) : (
        <>
          {/* Stacked bar chart with time unit picker (PRIMARY) */}
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
              Stacked bars show source breakdown. Drag to zoom. Click legend to toggle sources.
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
                height: 400,
                xaxis: {
                  ...darkLayout.xaxis,
                  ...(xaxisRange ? { range: xaxisRange } : {}),
                  rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
                },
                legend: {
                  ...darkLayout.legend,
                  orientation: 'h' as const,
                  y: 1.12,
                },
              }}
              onRelayout={onRelayout}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>

          <div className="chart-grid-2">
            {/* Pie chart for filtered sources */}
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
              <h3>Top 10 Oblasts <SourceLink source="VIINA" /></h3>
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
        </>
      )}
    </div>
  );
}
