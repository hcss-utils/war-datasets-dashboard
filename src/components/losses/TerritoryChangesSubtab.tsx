import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadDailyAreas } from '../../data/newLoader';
import type { DailyArea } from '../../types';
import InfoModal from '../InfoModal';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'DeepState/ISW': 'deepstate',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

function NetChangeInfo() {
  return (
    <InfoModal title="Understanding Net Territorial Change">
      <p>
        Net territorial change shows how much territory Ukraine has gained or lost
        over a given time period, based on daily DeepState/ISW control map data.
      </p>
      <h4>How it's calculated:</h4>
      <ul>
        <li><strong>Daily</strong>: Area today minus area yesterday (km²)</li>
        <li><strong>Weekly</strong>: Area at week end minus area at week start</li>
        <li><strong>Monthly</strong>: Area at month end minus area at month start</li>
      </ul>
      <h4>Interpretation:</h4>
      <ul>
        <li><strong>Positive values (green)</strong>: Ukraine gained territory</li>
        <li><strong>Negative values (red)</strong>: Ukraine lost territory</li>
        <li>The cumulative line shows total net change since the start of tracking</li>
      </ul>
      <p className="info-note">
        <em>Note: Territory data starts from Nov 2023. Values are based on
        DeepState/ISW control map polygons, which may not capture all local changes.</em>
      </p>
    </InfoModal>
  );
}

type TimeUnit = 'daily' | 'weekly' | 'monthly';

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

interface TerritoryChangesSubtabProps {
  selectedTimeUnit: TimeUnit;
}

export default function TerritoryChangesSubtab({ selectedTimeUnit }: TerritoryChangesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [dailyAreas, setDailyAreas] = useState<DailyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDailyAreas()
      .then(data => {
        setDailyAreas(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Get ukraine_control_map data sorted by date
  const controlData = useMemo(() => {
    return dailyAreas
      .filter(d => d.layerType === 'ukraine_control_map')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyAreas]);

  // Compute changes based on time unit
  const changeData = useMemo(() => {
    if (controlData.length < 2) return [];

    if (selectedTimeUnit === 'daily') {
      return controlData.slice(1).map((d, i) => ({
        date: d.date,
        change: d.areaKm2 - controlData[i].areaKm2,
        area: d.areaKm2,
      }));
    }

    if (selectedTimeUnit === 'weekly') {
      const weeks: { date: string; change: number; area: number }[] = [];
      let weekStart = controlData[0];
      let weekStartDate = new Date(weekStart.date);

      for (const d of controlData) {
        const current = new Date(d.date);
        const daysDiff = (current.getTime() - weekStartDate.getTime()) / 86400000;
        if (daysDiff >= 7) {
          weeks.push({
            date: d.date,
            change: d.areaKm2 - weekStart.areaKm2,
            area: d.areaKm2,
          });
          weekStart = d;
          weekStartDate = current;
        }
      }
      return weeks;
    }

    // Monthly
    const months: { date: string; change: number; area: number }[] = [];
    let prevMonthEnd = controlData[0];
    let prevMonth = controlData[0].date.substring(0, 7);

    for (const d of controlData) {
      const currentMonth = d.date.substring(0, 7);
      if (currentMonth !== prevMonth) {
        months.push({
          date: d.date.substring(0, 7) + '-01',
          change: d.areaKm2 - prevMonthEnd.areaKm2,
          area: d.areaKm2,
        });
        prevMonthEnd = d;
        prevMonth = currentMonth;
      } else {
        prevMonthEnd = d;
      }
    }
    return months;
  }, [controlData, selectedTimeUnit]);

  // Cumulative change from start
  const cumulativeData = useMemo(() => {
    if (!controlData.length) return [];
    const startArea = controlData[0].areaKm2;
    return changeData.map(d => ({
      ...d,
      cumulative: d.area - startArea,
    }));
  }, [changeData, controlData]);

  // 7-period rolling average of changes
  const rollingData = useMemo(() => {
    const window = selectedTimeUnit === 'daily' ? 7 : selectedTimeUnit === 'weekly' ? 4 : 3;
    return changeData.map((d, i, arr) => {
      const slice = arr.slice(Math.max(0, i - window + 1), i + 1);
      const avg = slice.reduce((s, x) => s + x.change, 0) / slice.length;
      return { ...d, avg_change: avg };
    });
  }, [changeData, selectedTimeUnit]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading territory data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load territory data</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!controlData.length) {
    return (
      <div className="conflict-subtab">
        <h2>Net Territorial Change</h2>
        <div className="no-data-msg">No territory data available.</div>
      </div>
    );
  }

  // Stats
  const totalChange = controlData[controlData.length - 1].areaKm2 - controlData[0].areaKm2;
  const latestArea = controlData[controlData.length - 1].areaKm2;
  const maxGain = Math.max(...changeData.map(d => d.change));
  const maxLoss = Math.min(...changeData.map(d => d.change));
  const positivePeriods = changeData.filter(d => d.change > 0).length;
  const negativePeriods = changeData.filter(d => d.change < 0).length;

  const unitLabel = selectedTimeUnit === 'daily' ? 'Day' : selectedTimeUnit === 'weekly' ? 'Week' : 'Month';
  const rollingLabel = selectedTimeUnit === 'daily' ? '7-day' : selectedTimeUnit === 'weekly' ? '4-week' : '3-month';

  // Color bars by gain/loss
  const barColors = rollingData.map(d => d.change >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)');

  return (
    <div className="conflict-subtab">
      <h2>Net Territorial Change</h2>
      <p className="tab-subtitle">
        {unitLabel}ly net change in Ukrainian-controlled territory (km²)
      </p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card" style={{ borderLeft: `3px solid ${totalChange >= 0 ? '#22c55e' : '#ef4444'}` }}>
          <span className="stat-value" style={{ color: totalChange >= 0 ? '#22c55e' : '#ef4444' }}>
            {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(0)} km²
          </span>
          <span className="stat-label">Net Change (Total)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(Math.round(latestArea))}</span>
          <span className="stat-label">Current Area (km²)</span>
        </div>
        <div className="stat-card highlight-green">
          <span className="stat-value">+{maxGain.toFixed(1)} km²</span>
          <span className="stat-label">Largest {unitLabel}ly Gain</span>
        </div>
        <div className="stat-card highlight-red">
          <span className="stat-value">{maxLoss.toFixed(1)} km²</span>
          <span className="stat-label">Largest {unitLabel}ly Loss</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{positivePeriods} / {negativePeriods}</span>
          <span className="stat-label">Gains / Losses ({unitLabel}s)</span>
        </div>
      </div>

      {/* Net Change Bar Chart */}
      <div className="chart-card">
        <h3>{unitLabel}ly Net Territorial Change <SourceLink source="DeepState/ISW" /> <NetChangeInfo /></h3>
        <p className="chart-note">
          Green = Ukraine gained territory. Red = Ukraine lost territory.
          Line = {rollingLabel} rolling average.
        </p>
        <Plot
          data={[
            {
              x: rollingData.map(d => d.date),
              y: rollingData.map(d => d.change),
              type: 'bar' as const,
              name: `${unitLabel}ly Change`,
              marker: { color: barColors },
              hovertemplate: `%{x}<br>%{y:+,.1f} km²<extra></extra>`,
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: rollingData.map(d => d.date),
              y: rollingData.map(d => d.avg_change),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: `${rollingLabel} Average`,
              line: { color: '#facc15', width: 2 },
              hovertemplate: `Avg: %{y:+,.1f} km²<extra></extra>`,
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 400,
            xaxis: {
              ...darkLayout.xaxis,
              ...(xaxisRange ? { range: xaxisRange } : {}),
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: {
              ...darkLayout.yaxis,
              tickformat: '+,',
              title: { text: 'Change (km²)', font: { size: 11, color: '#888' } },
              zeroline: true,
              zerolinecolor: '#888',
              zerolinewidth: 2,
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
          onRelayout={onRelayout}
        />
      </div>

      {/* Cumulative Change */}
      <div className="chart-card">
        <h3>Cumulative Net Change Since Nov 2023 <SourceLink source="DeepState/ISW" /></h3>
        <p className="chart-note">Running total of {selectedTimeUnit} territorial gains/losses (km²).</p>
        <Plot
          data={[
            {
              x: cumulativeData.map(d => d.date),
              y: cumulativeData.map(d => d.cumulative),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Cumulative Net Change',
              line: { color: '#4fc3f7', width: 2 },
              fill: 'tozeroy',
              fillcolor: 'rgba(79, 195, 247, 0.15)',
              hovertemplate: `%{x}<br>Net: %{y:+,.0f} km²<extra></extra>`,
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 350,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: {
              ...darkLayout.yaxis,
              tickformat: '+,',
              title: { text: 'Cumulative Change (km²)', font: { size: 11, color: '#888' } },
              zeroline: true,
              zerolinecolor: '#888',
            },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Histogram of changes */}
      <div className="chart-card">
        <h3>Distribution of {unitLabel}ly Changes <SourceLink source="DeepState/ISW" /></h3>
        <Plot
          data={[
            {
              x: changeData.map(d => d.change),
              type: 'histogram' as const,
              name: 'Frequency',
              marker: { color: '#4fc3f7' },
              nbinsx: 40,
              hovertemplate: '%{x:+,.1f} km²<br>%{y} occurrences<extra></extra>',
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 300,
            xaxis: {
              ...darkLayout.xaxis,
              title: { text: `${unitLabel}ly Change (km²)`, font: { size: 11, color: '#888' } },
              zeroline: true,
              zerolinecolor: '#ef4444',
              zerolinewidth: 2,
            },
            yaxis: {
              ...darkLayout.yaxis,
              title: { text: 'Frequency', font: { size: 11, color: '#888' } },
            },
            shapes: [
              {
                type: 'line',
                x0: 0,
                x1: 0,
                y0: 0,
                y1: 1,
                yref: 'paper',
                line: { color: '#ef4444', width: 2, dash: 'dash' },
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
