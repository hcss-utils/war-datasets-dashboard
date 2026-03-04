import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { loadDailyAerialThreats, loadWeaponTypes } from '../data/newLoader';
import type { DailyAerialThreat, WeaponTypeSummary } from '../types';
import { CorrelationInfo, DualPaneInfo } from './InfoModal';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'MDAA Tracker': 'mdaa',
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
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
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

export default function AerialAssaultsTabPlotly() {
  const [dailyThreats, setDailyThreats] = useState<DailyAerialThreat[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<WeaponTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadDailyAerialThreats(), loadWeaponTypes()])
      .then(([threats, weapons]) => {
        setDailyThreats(threats);
        setWeaponTypes(weapons);
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
        <span className="loading-text">Loading aerial assault data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load aerial assault data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Calculate rolling averages
  const rollingData = dailyThreats.map((d, i, arr) => {
    const window = arr.slice(Math.max(0, i - 6), i + 1);
    const avgLaunched = window.reduce((s, x) => s + x.total_launched, 0) / window.length;
    const avgDestroyed = window.reduce((s, x) => s + x.total_destroyed, 0) / window.length;
    return {
      ...d,
      avg_launched: Math.round(avgLaunched),
      avg_destroyed: Math.round(avgDestroyed),
      intercept_rate: d.total_launched > 0 ? (d.total_destroyed / d.total_launched) * 100 : 0,
    };
  });

  // Rate of change for aerial threats (7-day rolling)
  const threatRateData = rollingData.slice(7).map((d, i) => {
    const launchedCurrent = d.avg_launched;
    const launchedPrev = rollingData[i].avg_launched;
    const launchedRate = launchedPrev > 0 ? ((launchedCurrent - launchedPrev) / launchedPrev) * 100 : 0;

    const destroyedCurrent = d.avg_destroyed;
    const destroyedPrev = rollingData[i].avg_destroyed;
    const destroyedRate = destroyedPrev > 0 ? ((destroyedCurrent - destroyedPrev) / destroyedPrev) * 100 : 0;

    return {
      date: d.date,
      avg_launched: launchedCurrent,
      avg_destroyed: destroyedCurrent,
      launched_rate: launchedRate,
      destroyed_rate: destroyedRate,
    };
  });

  // Top weapons by launch count
  const topWeapons = weaponTypes.filter((w) => w.total_launched > 50).slice(0, 15);
  const weaponsSortedAlpha = [...topWeapons].sort((a, b) => a.model.localeCompare(b.model));

  // Calculate totals
  const totalLaunched = dailyThreats.reduce((s, d) => s + d.total_launched, 0);
  const totalDestroyed = dailyThreats.reduce((s, d) => s + d.total_destroyed, 0);
  const totalDrones = dailyThreats.reduce((s, d) => s + d.drones_launched, 0);
  const totalMissiles = dailyThreats.reduce((s, d) => s + d.missiles_launched, 0);

  // Calculate correlations
  const launchedInterceptedCorr = pearsonCorrelation(
    threatRateData.map(d => d.avg_launched),
    threatRateData.map(d => d.avg_destroyed)
  );
  const ratesCorr = pearsonCorrelation(
    threatRateData.map(d => d.launched_rate),
    threatRateData.map(d => d.destroyed_rate)
  );

  const recentData = dailyThreats.slice(-180);

  return (
    <div className="aerial-assaults-tab">
      <h2>Aerial Assaults Analysis</h2>
      <p className="tab-subtitle">Missile and drone attack tracking from Ukrainian Air Force reports</p>

      <div className="stat-cards aerial-stats">
        <div className="stat-card">
          <span className="stat-value">{totalLaunched.toLocaleString()}</span>
          <span className="stat-label">Total Launched</span>
        </div>
        <div className="stat-card highlight-green">
          <span className="stat-value">{totalDestroyed.toLocaleString()}</span>
          <span className="stat-label">Intercepted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{((totalDestroyed / totalLaunched) * 100).toFixed(1)}%</span>
          <span className="stat-label">Overall Intercept Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalDrones.toLocaleString()}</span>
          <span className="stat-label">Drones (Shahed)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMissiles.toLocaleString()}</span>
          <span className="stat-label">Missiles</span>
        </div>
      </div>

      {/* Daily Aerial Threats - Dual Pane */}
      <div className="chart-card">
        <h3>Daily Aerial Threats (7-day Rolling Average) <SourceLink source="MDAA Tracker" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily counts | Bottom: 7-day rate of change (%). Drag to zoom.</p>
        <div className="correlation-stats">
          <div className="corr-stat">
            <span className="corr-stat-label">r (launched vs intercepted) <CorrelationInfo /></span>
            <span className="corr-stat-value">{launchedInterceptedCorr.toFixed(3)}</span>
          </div>
          <div className="corr-stat">
            <span className="corr-stat-label">r (rates)</span>
            <span className="corr-stat-value">{ratesCorr.toFixed(3)}</span>
          </div>
        </div>
        <Plot
          data={[
            {
              x: threatRateData.map(d => d.date),
              y: threatRateData.map(d => d.avg_launched),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Launched (7d avg)',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: threatRateData.map(d => d.date),
              y: threatRateData.map(d => d.avg_destroyed),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Intercepted (7d avg)',
              line: { color: '#22c55e', width: 1.5 },
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
              x: threatRateData.map(d => d.date),
              y: threatRateData.map(d => d.launched_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Launched Rate',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: threatRateData.map(d => d.date),
              y: threatRateData.map(d => d.destroyed_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Intercepted Rate',
              line: { color: '#22c55e', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 200,
            margin: { ...darkLayout.margin, t: 10 },
            yaxis: { ...darkLayout.yaxis, ticksuffix: '%', zeroline: true, zerolinecolor: '#888' },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.2 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Drones vs Missiles */}
        <div className="chart-card">
          <h3>Drones vs Missiles (Daily) <SourceLink source="MDAA Tracker" /></h3>
          <Plot
            data={[
              {
                x: recentData.map(d => d.date),
                y: recentData.map(d => d.drones_launched),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Drones',
                fill: 'tozeroy',
                line: { color: '#f97316', width: 1 },
                fillcolor: 'rgba(249, 115, 22, 0.5)',
                stackgroup: 'one',
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: recentData.map(d => d.date),
                y: recentData.map(d => d.missiles_launched),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Missiles',
                fill: 'tonexty',
                line: { color: '#3b82f6', width: 1 },
                fillcolor: 'rgba(59, 130, 246, 0.5)',
                stackgroup: 'one',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              xaxis: { ...darkLayout.xaxis, rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' } },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Intercept Rate Over Time */}
        <div className="chart-card">
          <h3>Intercept Rate Over Time <SourceLink source="MDAA Tracker" /></h3>
          <Plot
            data={[
              {
                x: rollingData.slice(-180).map(d => d.date),
                y: rollingData.slice(-180).map(d => d.intercept_rate),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Intercept Rate',
                line: { color: '#22c55e', width: 1.5 },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              yaxis: { ...darkLayout.yaxis, range: [0, 100], ticksuffix: '%' },
              xaxis: { ...darkLayout.xaxis, rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' } },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Weapon Types by Launch Count */}
      <div className="chart-card">
        <h3>Weapon Types by Launch Count <SourceLink source="MDAA Tracker" /></h3>
        <Plot
          data={[
            {
              x: topWeapons.map(d => d.total_launched),
              y: topWeapons.map(d => d.model),
              type: 'bar' as const,
              orientation: 'h' as const,
              name: 'Launched',
              marker: { color: '#ef4444' },
              text: topWeapons.map(d => fmt(d.total_launched)),
              textposition: 'outside' as const,
              textfont: { color: '#888', size: 9 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: topWeapons.map(d => d.total_destroyed),
              y: topWeapons.map(d => d.model),
              type: 'bar' as const,
              orientation: 'h' as const,
              name: 'Intercepted',
              marker: { color: '#22c55e' },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 450,
            barmode: 'group',
            margin: { l: 150, r: 80, t: 20, b: 40 },
            xaxis: { ...darkLayout.xaxis, tickformat: ',' },
            yaxis: { ...darkLayout.yaxis },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.05 },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Intercept Rate by Weapon Type */}
      <div className="chart-card">
        <h3>Intercept Rate by Weapon Type <SourceLink source="MDAA Tracker" /></h3>
        <Plot
          data={[
            {
              x: weaponsSortedAlpha.map(d => d.intercept_rate),
              y: weaponsSortedAlpha.map(d => d.model),
              type: 'bar' as const,
              orientation: 'h' as const,
              marker: { color: weaponsSortedAlpha.map((_, i) => PLOTLY_COLORS[i % PLOTLY_COLORS.length]) },
              text: weaponsSortedAlpha.map(d => `${d.intercept_rate.toFixed(0)}%`),
              textposition: 'outside' as const,
              textfont: { color: '#888', size: 9 },
              hovertemplate: '%{y}<br>%{x:.1f}%<extra></extra>',
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 450,
            margin: { l: 150, r: 60, t: 20, b: 40 },
            xaxis: { ...darkLayout.xaxis, range: [0, 100], ticksuffix: '%' },
            yaxis: { ...darkLayout.yaxis },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
