import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadDailyEvents, loadUCDPByViolenceType, loadUCDPMonthlyByType } from '../../data/newLoader';
import type { DailyEvent, UCDPByViolenceType, UCDPMonthlyByType } from '../../types';

const SourceLink = ({ source, sourceId }: { source: string; sourceId?: string }) => {
  const id = sourceId || source.toLowerCase();
  return (
    <a href={`#sources-${id}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const VIOLENCE_TYPE_COLORS: Record<string, string> = {
  'State-based': '#ef4444',
  'Non-state': '#f97316',
  'One-sided': '#eab308',
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

interface UCDPSubtabProps {
  selectedTypes: Set<string>;
}

export default function UCDPSubtab({ selectedTypes }: UCDPSubtabProps) {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [byViolenceType, setByViolenceType] = useState<UCDPByViolenceType[]>([]);
  const [monthlyByType, setMonthlyByType] = useState<UCDPMonthlyByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { xaxisRange, onRelayout } = usePlotlyZoom();

  useEffect(() => {
    Promise.all([
      loadDailyEvents(),
      loadUCDPByViolenceType(),
      loadUCDPMonthlyByType(),
    ])
      .then(([daily, byType, monthlyType]) => {
        setDailyEvents(daily);
        setByViolenceType(byType);
        setMonthlyByType(monthlyType);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter monthly data based on selected types
  const filteredMonthlyByType = useMemo(() =>
    monthlyByType.filter(m => selectedTypes.has(m.violence_type_label)),
    [monthlyByType, selectedTypes]
  );

  // Filter totals based on selected types
  const filteredByViolenceType = useMemo(() =>
    byViolenceType.filter(t => selectedTypes.has(t.violence_type_label)),
    [byViolenceType, selectedTypes]
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading UCDP data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load UCDP data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const recentEvents = dailyEvents.slice(-365);

  // Aggregate monthly data for stacked bars
  const monthlyAggregated = filteredMonthlyByType.reduce((acc, m) => {
    const key = m.month;
    if (!acc[key]) acc[key] = { month: key } as Record<string, string | number>;
    acc[key][m.violence_type_label] = ((acc[key][m.violence_type_label] as number) || 0) + m.events;
    return acc;
  }, {} as Record<string, Record<string, number | string>>);

  const monthlyChartData = Object.values(monthlyAggregated).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  const visibleTypes = [...selectedTypes];
  const months = monthlyChartData.map(d => d.month as string);

  // Stats from filtered data
  const totalEvents = filteredByViolenceType.reduce((s, t) => s + t.events, 0);
  const totalFatalities = filteredByViolenceType.reduce((s, t) => s + t.fatalities, 0);

  // Pie data for violence types
  const pieData = filteredByViolenceType.map(t => ({
    name: t.violence_type_label,
    value: t.events,
    fatalities: t.fatalities,
  }));

  return (
    <div className="conflict-subtab">
      <h2>UCDP - Uppsala Conflict Data</h2>
      <p className="tab-subtitle">
        Georeferenced conflict events from Uppsala Conflict Data Program
      </p>

      {/* Stats row */}
      <div className="conflict-stats">
        <div className="stat-card">
          <span className="stat-value">{totalEvents.toLocaleString()}</span>
          <span className="stat-label">Total Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalFatalities.toLocaleString()}</span>
          <span className="stat-label">Total Fatalities</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{selectedTypes.size}</span>
          <span className="stat-label">Types Selected</span>
        </div>
      </div>

      {selectedTypes.size === 0 ? (
        <div className="chart-card">
          <p className="no-data-msg">Select at least one violence type from the sidebar to view data.</p>
        </div>
      ) : (
        <>
          {/* Monthly Events by Violence Type - Stacked Bar (PRIMARY) */}
          <div className="chart-card">
            <h3>Monthly Events by Violence Type <SourceLink source="UCDP" /></h3>
            <p className="chart-note">Stacked bars show violence type breakdown. Drag to zoom. Click legend to toggle.</p>
            <Plot
              data={visibleTypes.map((type) => ({
                x: months,
                y: monthlyChartData.map(d => (d[type] as number) || 0),
                type: 'bar' as const,
                name: type,
                marker: { color: VIOLENCE_TYPE_COLORS[type] || '#888' },
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
            {/* Pie chart for violence types */}
            <div className="chart-card">
              <h3>Events by Violence Type <SourceLink source="UCDP" /></h3>
              <Plot
                data={[
                  {
                    values: pieData.map(d => d.value),
                    labels: pieData.map(d => d.name),
                    type: 'pie' as const,
                    hole: 0.4,
                    marker: { colors: pieData.map(d => VIOLENCE_TYPE_COLORS[d.name] || '#888') },
                    textinfo: 'percent',
                    textposition: 'inside',
                    textfont: { color: '#fff', size: 11 },
                    hovertemplate: '%{label}<br>%{value:,} events<extra></extra>',
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

            {/* Fatalities by violence type */}
            <div className="chart-card">
              <h3>Fatalities by Violence Type <SourceLink source="UCDP" /></h3>
              <Plot
                data={[
                  {
                    x: pieData.map(d => d.name),
                    y: pieData.map(d => d.fatalities),
                    type: 'bar' as const,
                    marker: { color: pieData.map(d => VIOLENCE_TYPE_COLORS[d.name] || '#888') },
                    text: pieData.map(d => d.fatalities.toLocaleString()),
                    textposition: 'outside' as const,
                    textfont: { color: '#888', size: 10 },
                    hovertemplate: '%{x}<br>%{y:,} fatalities<extra></extra>',
                    hoverlabel: { font: { color: '#fff' } },
                  },
                ]}
                layout={{
                  ...darkLayout,
                  height: 300,
                  margin: { l: 60, r: 20, t: 20, b: 80 },
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
