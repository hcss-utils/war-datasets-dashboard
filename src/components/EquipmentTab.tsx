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
  ReferenceLine,
} from 'recharts';
import { loadEquipmentDaily, loadPersonnelDaily } from '../data/newLoader';
import type { EquipmentDaily, PersonnelDaily } from '../types';
import { DualPaneInfo, RateOfChangeInfo } from './InfoModal';
import { useSeriesToggle } from '../hooks/useSeriesToggle';

// Format number with thousands separators
const fmt = (n: number) => n.toLocaleString();

const EQUIPMENT_COLORS: Record<string, string> = {
  tank: '#ef4444',
  apc: '#f97316',
  field_artillery: '#eab308',
  mrl: '#22c55e',
  anti_aircraft: '#06b6d4',
  aircraft: '#3b82f6',
  helicopter: '#8b5cf6',
  drone: '#ec4899',
  cruise_missiles: '#f43f5e',
  naval_ship: '#0ea5e9',
};

const EQUIP_GROUPS: Record<string, string> = {
  tank: 'tank', apc: 'apc', field_artillery: 'artillery',
  tank_rate: 'tank', apc_rate: 'apc', artillery_rate: 'artillery',
};

export default function EquipmentTab() {
  const [equipment, setEquipment] = useState<EquipmentDaily[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const equipToggle = useSeriesToggle(EQUIP_GROUPS);
  const airToggle = useSeriesToggle();

  useEffect(() => {
    Promise.all([loadEquipmentDaily(), loadPersonnelDaily()])
      .then(([eq, pers]) => {
        setEquipment(eq);
        setPersonnel(pers);
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
        <span className="loading-text">Loading equipment data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load equipment data</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Get latest values
  const latest = equipment[equipment.length - 1];
  const latestPersonnel = personnel[personnel.length - 1];

  // Calculate daily losses (difference from previous day)
  const dailyLosses = equipment.slice(1).map((d, i) => {
    const prev = equipment[i];
    return {
      date: d.date,
      tank: d.tank - prev.tank,
      apc: d.apc - prev.apc,
      field_artillery: d.field_artillery - prev.field_artillery,
      aircraft: d.aircraft - prev.aircraft,
      helicopter: d.helicopter - prev.helicopter,
      drone: d.drone - prev.drone,
    };
  });

  // Daily personnel losses (difference from previous day)
  const dailyPersonnel = personnel.slice(1).map((d, i) => {
    const prev = personnel[i];
    return {
      date: d.date,
      daily_loss: d.personnel - prev.personnel,
    };
  });

  // Personnel with rate of change (7-day rolling)
  const personnelRateData = dailyPersonnel.slice(6).map((d, i) => {
    const prev = dailyPersonnel[i];
    const rate = prev.daily_loss > 0 ? ((d.daily_loss - prev.daily_loss) / prev.daily_loss) * 100 : 0;
    return {
      date: d.date,
      daily_loss: d.daily_loss,
      rate: Math.max(-500, Math.min(500, rate)), // Clip extreme values
    };
  });

  // Daily equipment losses
  const dailyEquipment = equipment.slice(1).map((d, i) => {
    const prev = equipment[i];
    return {
      date: d.date,
      tank: d.tank - prev.tank,
      apc: d.apc - prev.apc,
      field_artillery: d.field_artillery - prev.field_artillery,
    };
  });

  // Equipment with rate of change (7-day rolling)
  const equipmentRateData = dailyEquipment.slice(6).map((d, i) => {
    const prev = dailyEquipment[i];
    const tankRate = prev.tank > 0 ? ((d.tank - prev.tank) / prev.tank) * 100 : 0;
    const apcRate = prev.apc > 0 ? ((d.apc - prev.apc) / prev.apc) * 100 : 0;
    const artilleryRate = prev.field_artillery > 0 ? ((d.field_artillery - prev.field_artillery) / prev.field_artillery) * 100 : 0;
    return {
      date: d.date,
      tank: d.tank,
      apc: d.apc,
      field_artillery: d.field_artillery,
      tank_rate: Math.max(-500, Math.min(500, tankRate)),
      apc_rate: Math.max(-500, Math.min(500, apcRate)),
      artillery_rate: Math.max(-500, Math.min(500, artilleryRate)),
    };
  });

  return (
    <div className="equipment-tab">
      <h2>Russian Equipment &amp; Personnel Losses</h2>
      <p className="tab-subtitle">Cumulative losses reported by Ukrainian Ministry of Defense</p>

      <div className="stat-cards equipment-stats">
        <div className="stat-card highlight-red">
          <span className="stat-value">{fmt(latestPersonnel?.personnel || 0)}</span>
          <span className="stat-label">Personnel</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.tank || 0)}</span>
          <span className="stat-label">Tanks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.apc || 0)}</span>
          <span className="stat-label">APCs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.field_artillery || 0)}</span>
          <span className="stat-label">Artillery</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.aircraft || 0)}</span>
          <span className="stat-label">Aircraft</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.helicopter || 0)}</span>
          <span className="stat-label">Helicopters</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.drone || 0)}</span>
          <span className="stat-label">Drones</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmt(latest?.naval_ship || 0)}</span>
          <span className="stat-label">Naval Ships</span>
        </div>
      </div>

      <div className="chart-card">
        <h3>Daily Personnel Losses <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily losses | Bottom: 7-day rate of change (%) <RateOfChangeInfo /></p>
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={personnelRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="daily_loss" name="Daily Losses" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={personnelRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="rate" name="Rate of Change" stroke="#ef4444" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Daily Heavy Equipment Losses <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily losses | Bottom: 7-day rate of change (%) <RateOfChangeInfo /></p>
        <div className="dual-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={equipmentRateData} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={false} stroke="#888" />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => fmt(value)}
              />
              <Legend onClick={(e: any) => equipToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: equipToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <Line type="monotone" dataKey="tank" name="Tanks" stroke={EQUIPMENT_COLORS.tank} dot={false} hide={!equipToggle.isVisible('tank')} />
              <Line type="monotone" dataKey="apc" name="APCs" stroke={EQUIPMENT_COLORS.apc} dot={false} hide={!equipToggle.isVisible('apc')} />
              <Line type="monotone" dataKey="field_artillery" name="Artillery" stroke={EQUIPMENT_COLORS.field_artillery} dot={false} hide={!equipToggle.isVisible('field_artillery')} />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={equipmentRateData} margin={{ top: 0, right: 20, bottom: 30, left: 20 }}>
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Legend onClick={(e: any) => equipToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: equipToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="tank_rate" name="Tanks Rate" stroke={EQUIPMENT_COLORS.tank} dot={false} hide={!equipToggle.isVisible('tank_rate')} />
              <Line type="monotone" dataKey="apc_rate" name="APCs Rate" stroke={EQUIPMENT_COLORS.apc} dot={false} hide={!equipToggle.isVisible('apc_rate')} />
              <Line type="monotone" dataKey="artillery_rate" name="Artillery Rate" stroke={EQUIPMENT_COLORS.field_artillery} dot={false} hide={!equipToggle.isVisible('artillery_rate')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Strategic Air Losses <span className="chart-source">(Ukraine MOD)</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equipment}>
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
              <Legend onClick={(e: any) => airToggle.toggle(e.dataKey)} formatter={(value: string, entry: any) => (<span style={{ color: airToggle.isVisible(entry.dataKey) ? '#fff' : '#666', cursor: 'pointer' }}>{value}</span>)} />
              <Line type="monotone" dataKey="aircraft" name="Aircraft" stroke={EQUIPMENT_COLORS.aircraft} dot={false} hide={!airToggle.isVisible('aircraft')} />
              <Line type="monotone" dataKey="helicopter" name="Helicopters" stroke={EQUIPMENT_COLORS.helicopter} dot={false} hide={!airToggle.isVisible('helicopter')} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Drone Losses <span className="chart-source">(Ukraine MOD)</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equipment}>
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
              <Line type="monotone" dataKey="drone" name="Drones" stroke={EQUIPMENT_COLORS.drone} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Daily Tank Losses (Last 180 Days) — Total: {fmt(dailyLosses.slice(-180).reduce((s, d) => s + d.tank, 0))} <span className="chart-source">(Ukraine MOD)</span></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyLosses.slice(-180)}>
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
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="tank" name="Tanks Lost" fill={EQUIPMENT_COLORS.tank} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
