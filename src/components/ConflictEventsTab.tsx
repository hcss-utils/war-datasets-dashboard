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

// Format number with thousands separators
const fmt = (n: number) => n.toLocaleString();
import { loadDailyEvents, loadEventsByType, loadEventsByRegion, loadMonthlyEvents } from '../data/newLoader';
import type { DailyEvent, EventByType, EventByRegion, MonthlyEventData } from '../types';

import { PALETTE_20 } from '../utils/colors';
import { smooth7Day } from '../utils/smoothing';
import { useSeriesToggle } from '../hooks/useSeriesToggle';

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

const EVENTS_GROUPS: Record<string, string> = {
  acled_events: 'acled', ucdp_events: 'ucdp',
  acled_rate: 'acled', ucdp_rate: 'ucdp',
};
const FATALITIES_GROUPS: Record<string, string> = {
  acled_fatalities: 'acled', ucdp_fatalities: 'ucdp',
  acled_rate: 'acled', ucdp_rate: 'ucdp',
};

export default function ConflictEventsTab() {
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [eventsByType, setEventsByType] = useState<EventByType[]>([]);
  const [eventsByRegion, setEventsByRegion] = useState<EventByRegion[]>([]);
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [smoothUcdp, setSmoothUcdp] = useState(false);
  const eventsToggle = useSeriesToggle(EVENTS_GROUPS);
  const fatalitiesToggle = useSeriesToggle(FATALITIES_GROUPS);

  // Toggle visibility: click to show only that type, click again to show all
  const handleLegendClick = (dataKey: string) => {
    setSelectedType(prev => prev === dataKey ? null : dataKey);
  };
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

  // Top 10 regions - sorted alphabetically
  const topRegions = eventsByRegion.slice(0, 10).sort((a, b) => a.region.localeCompare(b.region));

  const recentEventsRaw = dailyEvents.slice(-365);
  const recentEvents = smoothUcdp
    ? smooth7Day(recentEventsRaw, ['ucdp_events', 'ucdp_fatalities'])
    : recentEventsRaw;

  // Find last date with real UCDP data (non-zero events)
  let lastUcdpIdx = -1;
  for (let i = recentEvents.length - 1; i >= 0; i--) {
    if (recentEvents[i].ucdp_events > 0) { lastUcdpIdx = i; break; }
  }
  const ucdpCutoffDate = lastUcdpIdx >= 0 ? recentEvents[lastUcdpIdx].date : null;

  // Rate of change for both ACLED and UCDP (7-day rolling change rate)
  const dualRateData = recentEvents.slice(7).map((d, i) => {
    const acledCurrent = d.acled_events;
    const acledPrev = recentEvents[i].acled_events;
    const acledRate = acledPrev > 0 ? ((acledCurrent - acledPrev) / acledPrev) * 100 : 0;

    // Null out UCDP data after last real observation
    const afterCutoff = ucdpCutoffDate && d.date > ucdpCutoffDate;
    const ucdpCurrent = afterCutoff ? null : d.ucdp_events;
    const ucdpPrev = recentEvents[i].ucdp_events;
    const ucdpRate = afterCutoff ? null : (ucdpPrev > 0 ? ((d.ucdp_events - ucdpPrev) / ucdpPrev) * 100 : 0);

    return {
      date: d.date,
      acled_events: acledCurrent,
      ucdp_events: ucdpCurrent,
      acled_rate: acledRate,
      ucdp_rate: ucdpRate,
    };
  });

  // Pie chart data with percentages (exclude <1% categories)
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const pieDataWithPct = pieData
    .map(d => ({
      ...d,
      pct: ((d.value / pieTotal) * 100).toFixed(0),
    }))
    .filter(d => parseFloat(d.pct) >= 1);

  // Rate of change for fatalities (7-day rolling)
  const fatalitiesRateData = recentEvents.slice(7).map((d, i) => {
    const acledCurrent = d.acled_fatalities;
    const acledPrev = recentEvents[i].acled_fatalities;
    const acledRate = acledPrev > 0 ? ((acledCurrent - acledPrev) / acledPrev) * 100 : 0;

    const afterCutoff = ucdpCutoffDate && d.date > ucdpCutoffDate;
    const ucdpCurrent = afterCutoff ? null : d.ucdp_fatalities;
    const ucdpPrev = recentEvents[i].ucdp_fatalities;
    const ucdpRate = afterCutoff ? null : (ucdpPrev > 0 ? ((d.ucdp_fatalities - ucdpPrev) / ucdpPrev) * 100 : 0);

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
  const dualRateFiltered = dualRateData.filter(d => d.ucdp_rate != null);
  const eventsRateCorr = pearsonCorrelation(
    dualRateFiltered.map(d => d.acled_rate),
    dualRateFiltered.map(d => d.ucdp_rate as number)
  );
  const fatalitiesCorr = pearsonCorrelation(
    recentEvents.map(d => d.acled_fatalities),
    recentEvents.map(d => d.ucdp_fatalities)
  );
  const fatRateFiltered = fatalitiesRateData.filter(d => d.ucdp_rate != null);
  const fatalitiesRateCorr = pearsonCorrelation(
    fatRateFiltered.map(d => d.acled_rate),
    fatRateFiltered.map(d => d.ucdp_rate as number)
  );

  return (
    <div className="conflict-events-tab">
      <h2>Conflict Events Analysis</h2>
      <p className="tab-subtitle">Data from ACLED and UCDP conflict event databases</p>
      <p className="chart-note">ACLED includes non-fatal events and publishes weekly. UCDP requires at least one fatal casualty, publishes in confirmed batches, and covers different event type scopes.</p>

      <div className="chart-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Daily Event Count (ACLED vs UCDP) <DualPaneInfo /></h3>
          <button
            onClick={() => setSmoothUcdp(p => !p)}
            style={{
              background: smoothUcdp ? '#3b82f6' : 'transparent',
              color: smoothUcdp ? '#fff' : '#888',
              border: `1px solid ${smoothUcdp ? '#3b82f6' : '#555'}`,
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s',
            }}
          >
            {smoothUcdp ? 'UCDP Smoothed (7-day avg)' : 'Smooth UCDP batch spikes'}
          </button>
        </div>
        <p className="chart-note">Top: Daily event count | Bottom: 7-day rate of change (%)</p>
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
              <Legend onClick={(e: any) => eventsToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: eventsToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <Line type="monotone" dataKey="acled_events" name="ACLED Events" stroke="#ef4444" dot={false} strokeWidth={1.5} hide={!eventsToggle.isVisible('acled_events')} />
              <Line type="monotone" dataKey="ucdp_events" name="UCDP Events" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls={false} hide={!eventsToggle.isVisible('ucdp_events')} />
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} domain={[-200, 200]} allowDataOverflow={true} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend onClick={(e: any) => eventsToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: eventsToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="acled_rate" name="ACLED Rate" stroke="#ef4444" dot={false} strokeWidth={1.5} hide={!eventsToggle.isVisible('acled_rate')} />
              <Line type="monotone" dataKey="ucdp_rate" name="UCDP Rate" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls={false} hide={!eventsToggle.isVisible('ucdp_rate')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">UCDP data ends ~Dec 2024 — later dates reflect publication lag, not zero events.</p>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Events by Type (ACLED)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieDataWithPct}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={55}
                dataKey="value"
                paddingAngle={2}
                label={({ name, pct, cx: pieCx, cy: pieCy, midAngle, outerRadius: oR }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = (oR as number) + 20;
                  const x = (pieCx as number) + radius * Math.cos(-midAngle * RADIAN);
                  const y = (pieCy as number) + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="#ccc" fontSize={10} textAnchor={x > (pieCx as number) ? 'start' : 'end'} dominantBaseline="central">
                      {`${name} ${pct}%`}
                    </text>
                  );
                }}
                labelLine={{ stroke: '#666', strokeWidth: 1 }}
              >
                {pieDataWithPct.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE_20[index % PALETTE_20.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top 10 Regions by Event Count <span className="chart-source">(ACLED)</span></h3>
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
                  <Cell key={`cell-${index}`} fill={PALETTE_20[index % PALETTE_20.length]} />
                ))}
                <LabelList dataKey="events" position="right" fill="#888" fontSize={10} formatter={(v: number) => fmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Monthly Events by Type <span className="chart-source">(ACLED)</span></h3>
        <p className="chart-note">Click a legend item to show only that category; click again to show all</p>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyChartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="month"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={70}
              interval={Math.max(1, Math.floor(monthlyChartData.length / 15))}
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
              formatter={(value: string) => (
                <span style={{
                  color: selectedType === null || selectedType === value ? '#fff' : '#666',
                  fontWeight: selectedType === value ? 'bold' : 'normal',
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
                fill={PALETTE_20[i % PALETTE_20.length]}
                hide={selectedType !== null && selectedType !== type}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Daily Fatalities (ACLED vs UCDP) <DualPaneInfo /></h3>
          {smoothUcdp && <span style={{ fontSize: '12px', color: '#3b82f6' }}>UCDP smoothed (7-day avg)</span>}
        </div>
        <p className="chart-note">Top: Daily fatalities | Bottom: 7-day rate of change (%)</p>
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
              <Legend onClick={(e: any) => fatalitiesToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: fatalitiesToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <Line type="monotone" dataKey="acled_fatalities" name="ACLED Fatalities" stroke="#dc2626" dot={false} strokeWidth={1.5} hide={!fatalitiesToggle.isVisible('acled_fatalities')} />
              <Line type="monotone" dataKey="ucdp_fatalities" name="UCDP Fatalities" stroke="#2563eb" dot={false} strokeWidth={1.5} connectNulls={false} hide={!fatalitiesToggle.isVisible('ucdp_fatalities')} />
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
              <Legend onClick={(e: any) => fatalitiesToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: fatalitiesToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="acled_rate" name="ACLED Rate" stroke="#dc2626" dot={false} strokeWidth={1.5} hide={!fatalitiesToggle.isVisible('acled_rate')} />
              <Line type="monotone" dataKey="ucdp_rate" name="UCDP Rate" stroke="#2563eb" dot={false} strokeWidth={1.5} connectNulls={false} hide={!fatalitiesToggle.isVisible('ucdp_rate')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">UCDP reports fatalities in monthly batches, which may create artificial start-of-month spikes. UCDP data ends ~Dec 2024.</p>
      </div>
    </div>
  );
}
