import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  ReferenceLine,
  LabelList,
} from 'recharts';
import { CorrelationInfo, DualPaneInfo } from './InfoModal';
import { loadDailyEvents, loadEventsByType, loadEventsByRegion, loadMonthlyEvents } from '../data/newLoader';
import type { DailyEvent, EventByType, EventByRegion, MonthlyEventData } from '../types';

// Format number with thousands separators
const fmt = (n: number) => n.toLocaleString();

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

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

// Tab20 color palette for distinctive bar colors
const TAB20_COLORS = [
  '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
  '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
  '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
  '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
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

export default function ConflictEventsTab() {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [eventsByType, setEventsByType] = useState<EventByType[]>([]);
  const [eventsByRegion, setEventsByRegion] = useState<EventByRegion[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEventSeries, setSelectedEventSeries] = useState<string | null>(null);
  const [selectedFatalitySeries, setSelectedFatalitySeries] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Toggle visibility: click to show only that type, click again to show all
  const handleLegendClick = (dataKey: string) => {
    setSelectedType(prev => prev === dataKey ? null : dataKey);
  };
  const handleEventLegendClick = (dataKey: string) => {
    setSelectedEventSeries(prev => prev === dataKey ? null : dataKey);
  };
  const handleFatalityLegendClick = (dataKey: string) => {
    setSelectedFatalitySeries(prev => prev === dataKey ? null : dataKey);
  };

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

  // Pie chart data with percentages
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const pieDataWithPct = pieData.map(d => ({
    ...d,
    pct: ((d.value / pieTotal) * 100).toFixed(0),
  }));

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

  // Calculate correlations between datasets
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

      <div className="chart-card">
        <h3>Daily Event Count <SourceLink source="ACLED/UCDP" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily event count | Bottom: 7-day rate of change (%). Click legend to filter.</p>
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
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dualRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Legend
                onClick={(e) => handleEventLegendClick(e.dataKey as string)}
                formatter={(value: string, entry: any) => (
                  <span style={{
                    color: selectedEventSeries === null || selectedEventSeries === entry.dataKey ? '#fff' : '#666',
                    fontWeight: selectedEventSeries === entry.dataKey ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}>
                    {value}
                  </span>
                )}
              />
              <Line type="monotone" dataKey="acled_events" name="ACLED Events" stroke="#ef4444" dot={false} strokeWidth={1.5} hide={selectedEventSeries !== null && selectedEventSeries !== 'acled_events'} />
              <Line type="monotone" dataKey="ucdp_events" name="UCDP Events" stroke="#3b82f6" dot={false} strokeWidth={1.5} hide={selectedEventSeries !== null && selectedEventSeries !== 'ucdp_events'} />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dualRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="acled_rate" name="ACLED Rate" stroke="#ef4444" dot={false} strokeWidth={1.5} hide={selectedEventSeries !== null && selectedEventSeries !== 'acled_events'} />
              <Line type="monotone" dataKey="ucdp_rate" name="UCDP Rate" stroke="#3b82f6" dot={false} strokeWidth={1.5} hide={selectedEventSeries !== null && selectedEventSeries !== 'ucdp_events'} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by Type <SourceLink source="ACLED" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieDataWithPct}
                cx="40%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                dataKey="value"
                paddingAngle={2}
                label={({ pct }) => `${pct}%`}
                labelLine={false}
              >
                {pieDataWithPct.map((_, index) => (
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
                  const item = pieDataWithPct.find(d => d.name === value);
                  return `${value} (${item?.pct || 0}%)`;
                }}
                wrapperStyle={{ fontSize: 11, paddingLeft: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top 10 Regions by Event Count <SourceLink source="ACLED" /></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topRegions} layout="vertical" margin={{ right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis
                dataKey="region"
                type="category"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="events" name="Events">
                {topRegions.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={TAB20_COLORS[index % TAB20_COLORS.length]} />
                ))}
                <LabelList dataKey="events" position="right" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Monthly Events by Type <SourceLink source="ACLED" /></h3>
        <p className="chart-note">Click a legend item to show only that category; click again to show all</p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="month"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            />
            <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number) => fmt(value)}
            />
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey as string)}
              formatter={(value: string, entry: any) => (
                <span style={{
                  color: selectedType === null || selectedType === entry.dataKey ? '#fff' : '#666',
                  fontWeight: selectedType === entry.dataKey ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}>
                  {value}
                </span>
              )}
            />
            {eventTypes.map((type, i) => (
              <Bar
                key={type}
                dataKey={type}
                stackId="a"
                fill={COLORS[i % COLORS.length]}
                hide={selectedType !== null && selectedType !== type}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Daily Fatalities <SourceLink source="ACLED/UCDP" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily fatalities | Bottom: 7-day rate of change (%). Click legend to filter.</p>
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
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fatalitiesRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Legend
                onClick={(e) => handleFatalityLegendClick(e.dataKey as string)}
                formatter={(value: string, entry: any) => (
                  <span style={{
                    color: selectedFatalitySeries === null || selectedFatalitySeries === entry.dataKey ? '#fff' : '#666',
                    fontWeight: selectedFatalitySeries === entry.dataKey ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}>
                    {value}
                  </span>
                )}
              />
              <Line type="monotone" dataKey="acled_fatalities" name="ACLED Fatalities" stroke="#dc2626" dot={false} strokeWidth={1.5} hide={selectedFatalitySeries !== null && selectedFatalitySeries !== 'acled_fatalities'} />
              <Line type="monotone" dataKey="ucdp_fatalities" name="UCDP Fatalities" stroke="#2563eb" dot={false} strokeWidth={1.5} hide={selectedFatalitySeries !== null && selectedFatalitySeries !== 'ucdp_fatalities'} />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fatalitiesRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} domain={[-500, 500]} allowDataOverflow={true} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="acled_rate" name="ACLED Rate" stroke="#dc2626" dot={false} strokeWidth={1.5} hide={selectedFatalitySeries !== null && selectedFatalitySeries !== 'acled_fatalities'} />
              <Line type="monotone" dataKey="ucdp_rate" name="UCDP Rate" stroke="#2563eb" dot={false} strokeWidth={1.5} hide={selectedFatalitySeries !== null && selectedFatalitySeries !== 'ucdp_fatalities'} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
