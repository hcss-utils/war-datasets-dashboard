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
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { loadDailyAerialThreats, loadWeaponTypes } from '../data/newLoader';
import type { DailyAerialThreat, WeaponTypeSummary } from '../types';
import { CorrelationInfo, DualPaneInfo } from './InfoModal';

// Format number with thousands separators
const fmt = (n: number) => n.toLocaleString();

const WEAPON_CATEGORY: Record<string, string> = {
  'Shahed-136/131': 'drone', 'Shahed/other drones': 'drone',
  'Iskander-M': 'ballistic', 'Iskander-K': 'cruise',
  'X-101/X-555': 'cruise', 'Kalibr': 'cruise',
  'Kinzhal': 'ballistic', 'X-22/X-32': 'cruise',
  'X-59/X-69': 'cruise', 'Zircon': 'ballistic',
  'S-300/S-400': 'ballistic', 'KN-23/KN-24': 'ballistic',
};
const CATEGORY_COLORS: Record<string, string> = {
  ballistic: '#ef4444', cruise: '#3b82f6', drone: '#f97316', other: '#888888',
};

const WEAPON_DISPLAY: Record<string, string> = {
  '\u041C\u043E\u043B\u043D\u0456\u044F': 'Molniya (drone)',
};

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

export default function AerialAssaultsTab() {
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

  // Top weapons by launch count (with display name mapping)
  const topWeapons = weaponTypes
    .filter((w) => w.total_launched > 50)
    .slice(0, 15)
    .map(w => ({ ...w, model: WEAPON_DISPLAY[w.model] || w.model }));

  // Weapons sorted by intercept rate (descending) for intercept rate chart
  const weaponsSortedByRate = [...topWeapons]
    .map(w => ({ ...w, model: WEAPON_DISPLAY[w.model] || w.model }))
    .sort((a, b) => b.intercept_rate - a.intercept_rate);

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

      <div className="chart-card">
        <h3>Daily Aerial Threats (7-day Rolling Average) <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily counts | Bottom: 7-day rate of change (%)</p>
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
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={threatRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Legend />
              <Line type="monotone" dataKey="avg_launched" name="Launched (7d avg)" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="avg_destroyed" name="Intercepted (7d avg)" stroke="#22c55e" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={threatRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
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
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="launched_rate" name="Launched Rate" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="destroyed_rate" name="Intercepted Rate" stroke="#22c55e" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Drones vs Missiles (Daily) <span className="chart-source">(Ukraine Air Force)</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyThreats.slice(-180)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => fmt(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="drones_launched"
                name="Drones"
                stackId="1"
                stroke="#f97316"
                fill="#f97316"
              />
              <Area
                type="monotone"
                dataKey="missiles_launched"
                name="Missiles"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Intercept Rate Over Time <span className="chart-source">(Ukraine Air Force)</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rollingData.slice(-180)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              />
              <YAxis
                stroke="#888"
                tick={{ fill: '#888', fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Line
                type="monotone"
                dataKey="intercept_rate"
                name="Intercept Rate"
                stroke="#22c55e"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Weapon Types by Launch Count <span className="chart-source">(Ukraine Air Force)</span></h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topWeapons} layout="vertical" margin={{ right: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <YAxis
              dataKey="model"
              type="category"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              width={150}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number, name: string) => [
                fmt(value),
                name === 'total_launched' ? 'Launched' : name === 'total_destroyed' ? 'Intercepted' : name,
              ]}
            />
            <Legend />
            <Bar dataKey="total_launched" name="Launched" fill="#ef4444">
              <LabelList dataKey="total_launched" position="right" fill="#888" fontSize={9} formatter={(v: number) => fmt(v)} />
            </Bar>
            <Bar dataKey="total_destroyed" name="Intercepted" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Intercept Rate by Weapon Type <span className="chart-source">(Ukraine Air Force)</span></h3>
        <p className="chart-note">Color: <span style={{color:'#ef4444'}}>Ballistic</span> | <span style={{color:'#3b82f6'}}>Cruise</span> | <span style={{color:'#f97316'}}>Drone</span> | <span style={{color:'#888'}}>Other</span></p>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={weaponsSortedByRate} layout="vertical" margin={{ right: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              dataKey="model"
              type="category"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 10 }}
              width={150}
            />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number) => `${value.toFixed(1)}%`}
            />
            <Bar dataKey="intercept_rate" name="Intercept Rate">
              {weaponsSortedByRate.map((w, index) => (
                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[WEAPON_CATEGORY[w.model] || 'other']} />
              ))}
              <LabelList dataKey="intercept_rate" position="right" fill="#888" fontSize={9} formatter={(v: number) => `${v.toFixed(0)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
