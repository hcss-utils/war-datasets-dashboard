import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadEventsByType, loadEventsByRegion, loadMonthlyEvents } from '../../data/newLoader';
import type { EventByType, EventByRegion, MonthlyEventData, ACLEDEventType } from '../../types';

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
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  'Battles': '#ef4444',
  'Explosions/Remote violence': '#f97316',
  'Protests': '#eab308',
  'Riots': '#22c55e',
  'Strategic developments': '#3b82f6',
  'Violence against civilians': '#8b5cf6',
};

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

interface ACLEDSubtabProps {
  selectedTypes: Set<ACLEDEventType>;
}

export default function ACLEDSubtab({ selectedTypes }: ACLEDSubtabProps) {
  const [eventsByType, setEventsByType] = useState<EventByType[]>([]);
  const [eventsByRegion, setEventsByRegion] = useState<EventByRegion[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { xaxisRange, onRelayout } = usePlotlyZoom();

  useEffect(() => {
    Promise.all([
      loadEventsByType(),
      loadEventsByRegion(),
      loadMonthlyEvents(),
    ])
      .then(([types, regions, monthly]) => {
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

  // Filter data based on selected event types
  const filteredEventsByType = useMemo(() =>
    eventsByType.filter(e => selectedTypes.has(e.event_type as ACLEDEventType)),
    [eventsByType, selectedTypes]
  );

  const filteredMonthlyEvents = useMemo(() =>
    monthlyEvents.filter(m => selectedTypes.has(m.event_type as ACLEDEventType)),
    [monthlyEvents, selectedTypes]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading ACLED data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load ACLED data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Aggregate events by type for pie chart
  const typeAggregates = filteredEventsByType.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + e.count;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typeAggregates).map(([name, value]) => ({ name, value }));
  const totalEvents = pieData.reduce((s, d) => s + d.value, 0);
  const totalFatalities = filteredEventsByType.reduce((s, e) => s + e.fatalities, 0);

  // Top 10 regions
  const topRegions = eventsByRegion.slice(0, 10).sort((a, b) => a.region.localeCompare(b.region));

  // Monthly data for stacked bar chart
  const monthlyAggregated = filteredMonthlyEvents.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    acc[key][m.event_type] = ((acc[key][m.event_type] as number) || 0) + m.events;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);

  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  const visibleEventTypes = [...selectedTypes];
  const months = monthlyChartData.map(d => d.month as string);

  // Calculate monthly totals for the timeline
  const monthlyTotals = monthlyChartData.map(d => {
    const total = visibleEventTypes.reduce((sum, type) => sum + ((d[type] as number) || 0), 0);
    return { month: d.month as string, total };
  });

  return (
    <div className="conflict-subtab">
      <h2>ACLED - Armed Conflict Events</h2>
      <p className="tab-subtitle">
        Real-time data on political violence and protest events
      </p>

      {/* Stats row */}
      <div className="conflict-stats">
        <div className="stat-card">
          <span className="stat-value">{fmt(totalEvents)}</span>
          <span className="stat-label">Total Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(totalFatalities)}</span>
          <span className="stat-label">Total Fatalities</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{selectedTypes.size}</span>
          <span className="stat-label">Event Types Selected</span>
        </div>
      </div>

      {selectedTypes.size === 0 ? (
        <div className="chart-card">
          <p className="no-data-msg">Select at least one event type from the sidebar to view data.</p>
        </div>
      ) : (
        <>
          {/* Monthly Events by Type - Stacked Bar (PRIMARY) */}
          <div className="chart-card">
            <h3>Monthly Events by Type <SourceLink source="ACLED" /></h3>
            <p className="chart-note">Stacked bars show event type breakdown. Drag to zoom. Click legend to toggle.</p>
            <Plot
              data={visibleEventTypes.map((type, i) => ({
                x: months,
                y: monthlyChartData.map(d => (d[type] as number) || 0),
                type: 'bar' as const,
                name: type,
                marker: { color: EVENT_TYPE_COLORS[type] || PLOTLY_COLORS[i % PLOTLY_COLORS.length] },
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
                legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
              }}
              onRelayout={onRelayout}
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
                    marker: { colors: pieData.map(d => EVENT_TYPE_COLORS[d.name] || '#888') },
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
              <h3>Top 10 Regions <SourceLink source="ACLED" /></h3>
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
        </>
      )}
    </div>
  );
}
