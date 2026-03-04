import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { CorrelationInfo, DualPaneInfo } from './InfoModal';
import { loadDailyEvents, loadEventsByType, loadEventsByRegion, loadMonthlyEvents } from '../data/newLoader';
import type { DailyEvent, EventByType, EventByRegion, MonthlyEventData } from '../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'ACLED': 'acled',
  'UCDP': 'ucdp',
  'ACLED/UCDP': 'acled',
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

const PLOTLY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
];

// Calculate Pearson correlation coefficient
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
  const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
  const sumXY = x.slice(0, n).reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.slice(0, n).reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

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

const plotConfig = { displayModeBar: true, displaylogo: false, responsive: true };

export default function ConflictEventsTabPlotly() {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [eventsByType, setEventsByType] = useState<EventByType[]>([]);
  const [eventsByRegion, setEventsByRegion] = useState<EventByRegion[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadDailyEvents(),
      loadEventsByType(),
      loadEventsByRegion(),
      loadMonthlyEvents(),
    ])
      .then(([daily, types, regions, monthly]) => {
        setDailyEvents(daily);
        setEventsByType(types);
        setEventsByRegion(regions);
        setMonthlyEvents(monthly);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading conflict events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load conflict events</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Aggregate events by type for pie chart
  const typeAggregates = eventsByType.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + e.count;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typeAggregates).map(([name, value]) => ({ name, value }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // Top 10 regions - sorted alphabetically
  const topRegions = eventsByRegion.slice(0, 10).sort((a, b) => a.region.localeCompare(b.region));

  const recentEvents = dailyEvents.slice(-365);

  // Rate of change for both ACLED and UCDP (7-day rolling change rate)
  const dualRateData = recentEvents.slice(7).map((d, i) => {
    const acledCurrent = d.acled_events;
    const acledPrev = recentEvents[i].acled_events;
    const acledRate = acledPrev > 0 ? ((acledCurrent - acledPrev) / acledPrev) * 100 : 0;

    const ucdpCurrent = d.ucdp_events;
    const ucdpPrev = recentEvents[i].ucdp_events;
    const ucdpRate = ucdpPrev > 0 ? ((ucdpCurrent - ucdpPrev) / ucdpPrev) * 100 : 0;

    return {
      date: d.date,
      acled_events: acledCurrent,
      ucdp_events: ucdpCurrent,
      acled_rate: acledRate,
      ucdp_rate: ucdpRate,
    };
  });

  // Rate of change for fatalities (7-day rolling)
  const fatalitiesRateData = recentEvents.slice(7).map((d, i) => {
    const acledCurrent = d.acled_fatalities;
    const acledPrev = recentEvents[i].acled_fatalities;
    const acledRate = acledPrev > 0 ? ((acledCurrent - acledPrev) / acledPrev) * 100 : 0;

    const ucdpCurrent = d.ucdp_fatalities;
    const ucdpPrev = recentEvents[i].ucdp_fatalities;
    const ucdpRate = ucdpPrev > 0 ? ((ucdpCurrent - ucdpPrev) / ucdpPrev) * 100 : 0;

    return {
      date: d.date,
      acled_fatalities: acledCurrent,
      ucdp_fatalities: ucdpCurrent,
      acled_rate: acledRate,
      ucdp_rate: ucdpRate,
    };
  });

  // Monthly data for stacked bar chart
  const monthlyAggregated = monthlyEvents.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    acc[key][m.event_type] = ((acc[key][m.event_type] as number) || 0) + m.events;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);

  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  const eventTypes = [...new Set(monthlyEvents.map((m) => m.event_type))];
  const months = monthlyChartData.map(d => d.month as string);

  // Calculate correlations
  const eventsCorr = pearsonCorrelation(
    recentEvents.map(d => d.acled_events),
    recentEvents.map(d => d.ucdp_events)
  );
  const eventsRateCorr = pearsonCorrelation(
    dualRateData.map(d => d.acled_rate),
    dualRateData.map(d => d.ucdp_rate)
  );
  const fatalitiesCorr = pearsonCorrelation(
    recentEvents.map(d => d.acled_fatalities),
    recentEvents.map(d => d.ucdp_fatalities)
  );
  const fatalitiesRateCorr = pearsonCorrelation(
    fatalitiesRateData.map(d => d.acled_rate),
    fatalitiesRateData.map(d => d.ucdp_rate)
  );

  return (
    <div className="conflict-events-tab">
      <h2>Conflict Events Analysis</h2>
      <p className="tab-subtitle">Data from ACLED and UCDP conflict event databases</p>

      {/* Daily Event Count - Dual Pane */}
      <div className="chart-card">
        <h3>Daily Event Count <SourceLink source="ACLED/UCDP" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily event count | Bottom: 7-day rate of change (%). Drag to zoom.</p>
        <div className="correlation-stats">
          <div className="corr-stat">
            <span className="corr-stat-label">r (levels) <CorrelationInfo /></span>
            <span className="corr-stat-value">{eventsCorr.toFixed(3)}</span>
          </div>
          <div className="corr-stat">
            <span className="corr-stat-label">r (rates)</span>
            <span className="corr-stat-value">{eventsRateCorr.toFixed(3)}</span>
          </div>
        </div>
        <Plot
          data={[
            {
              x: dualRateData.map(d => d.date),
              y: dualRateData.map(d => d.acled_events),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'ACLED Events',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: dualRateData.map(d => d.date),
              y: dualRateData.map(d => d.ucdp_events),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'UCDP Events',
              line: { color: '#3b82f6', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 300,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <Plot
          data={[
            {
              x: dualRateData.map(d => d.date),
              y: dualRateData.map(d => d.acled_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'ACLED Rate',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: dualRateData.map(d => d.date),
              y: dualRateData.map(d => d.ucdp_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'UCDP Rate',
              line: { color: '#3b82f6', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 200,
            margin: { ...darkLayout.margin, t: 10 },
            yaxis: { ...darkLayout.yaxis, ticksuffix: '%', zeroline: true, zerolinecolor: '#888' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.2 },
            hovermode: 'x unified' as const,
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Pie chart for event types */}
        <div className="chart-card">
          <h3>Events by Type <SourceLink source="ACLED" /></h3>
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
              legend: { ...darkLayout.legend, orientation: 'v' as const, x: 1, y: 0.5 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Horizontal bar chart for regions */}
        <div className="chart-card">
          <h3>Top 10 Regions by Event Count <SourceLink source="ACLED" /></h3>
          <Plot
            data={[
              {
                x: topRegions.map(d => d.events),
                y: topRegions.map(d => d.region),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: { color: topRegions.map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]) },
                text: topRegions.map(d => fmt(d.events)),
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

      {/* Monthly Events by Type - Stacked Bar */}
      <div className="chart-card">
        <h3>Monthly Events by Type <SourceLink source="ACLED" /></h3>
        <p className="chart-note">Drag on chart to zoom. Click legend to toggle event types.</p>
        <Plot
          data={eventTypes.map((type, i) => ({
            x: months,
            y: monthlyChartData.map(d => (d[type] as number) || 0),
            type: 'bar' as const,
            name: type,
            marker: { color: PLOTLY_COLORS[i % PLOTLY_COLORS.length] },
            hoverlabel: { font: { color: '#fff' } },
          }))}
          layout={{
            ...darkLayout,
            barmode: 'stack',
            height: 400,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: -0.25 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Daily Fatalities - Dual Pane */}
      <div className="chart-card">
        <h3>Daily Fatalities <SourceLink source="ACLED/UCDP" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily fatalities | Bottom: 7-day rate of change (%). Drag to zoom.</p>
        <div className="correlation-stats">
          <div className="corr-stat">
            <span className="corr-stat-label">r (levels) <CorrelationInfo /></span>
            <span className="corr-stat-value">{fatalitiesCorr.toFixed(3)}</span>
          </div>
          <div className="corr-stat">
            <span className="corr-stat-label">r (rates)</span>
            <span className="corr-stat-value">{fatalitiesRateCorr.toFixed(3)}</span>
          </div>
        </div>
        <Plot
          data={[
            {
              x: fatalitiesRateData.map(d => d.date),
              y: fatalitiesRateData.map(d => d.acled_fatalities),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'ACLED Fatalities',
              line: { color: '#dc2626', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: fatalitiesRateData.map(d => d.date),
              y: fatalitiesRateData.map(d => d.ucdp_fatalities),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'UCDP Fatalities',
              line: { color: '#2563eb', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 300,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <Plot
          data={[
            {
              x: fatalitiesRateData.map(d => d.date),
              y: fatalitiesRateData.map(d => d.acled_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'ACLED Rate',
              line: { color: '#dc2626', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: fatalitiesRateData.map(d => d.date),
              y: fatalitiesRateData.map(d => d.ucdp_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'UCDP Rate',
              line: { color: '#2563eb', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 200,
            margin: { ...darkLayout.margin, t: 10 },
            yaxis: { ...darkLayout.yaxis, ticksuffix: '%', range: [-500, 500], zeroline: true, zerolinecolor: '#888' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.2 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
