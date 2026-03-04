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

export default function EquipmentTab() {
  const [equipment, setEquipment] = useState<EquipmentDaily[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEquipmentSeries, setSelectedEquipmentSeries] = useState<string | null>(null);
  const [selectedAirSeries, setSelectedAirSeries] = useState<string | null>(null);

  const handleEquipmentLegendClick = (dataKey: string) => {
    setSelectedEquipmentSeries(prev => prev === dataKey ? null : dataKey);
  };
  const handleAirLegendClick = (dataKey: string) => {
    setSelectedAirSeries(prev => prev === dataKey ? null : dataKey);
  };

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
        <h3>Daily Personnel Losses <SourceLink source="Ukraine MOD" /> <DualPaneInfo /></h3>
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
        <h3>Daily Heavy Equipment Losses <SourceLink source="Ukraine MOD" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily losses | Bottom: 7-day rate of change (%). Click legend to filter. <RateOfChangeInfo /></p>
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
              <Legend
                onClick={(e) => handleEquipmentLegendClick(e.dataKey as string)}
                formatter={(value: string, entry: any) => (
                  <span style={{
                    color: selectedEquipmentSeries === null || selectedEquipmentSeries === entry.dataKey ? '#fff' : '#666',
                    fontWeight: selectedEquipmentSeries === entry.dataKey ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}>
                    {value}
                  </span>
                )}
              />
              <Line type="monotone" dataKey="tank" name="Tanks" stroke={EQUIPMENT_COLORS.tank} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'tank'} />
              <Line type="monotone" dataKey="apc" name="APCs" stroke={EQUIPMENT_COLORS.apc} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'apc'} />
              <Line type="monotone" dataKey="field_artillery" name="Artillery" stroke={EQUIPMENT_COLORS.field_artillery} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'field_artillery'} />
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
              <Legend />
              <ReferenceLine y={0} stroke="#888" />
              <Line type="monotone" dataKey="tank_rate" name="Tanks Rate" stroke={EQUIPMENT_COLORS.tank} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'tank'} />
              <Line type="monotone" dataKey="apc_rate" name="APCs Rate" stroke={EQUIPMENT_COLORS.apc} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'apc'} />
              <Line type="monotone" dataKey="artillery_rate" name="Artillery Rate" stroke={EQUIPMENT_COLORS.field_artillery} dot={false} hide={selectedEquipmentSeries !== null && selectedEquipmentSeries !== 'field_artillery'} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h3>Cumulative Air Losses <SourceLink source="Ukraine MOD" /></h3>
          <p className="chart-note">Click legend to filter series</p>
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
              <Legend
                onClick={(e) => handleAirLegendClick(e.dataKey as string)}
                formatter={(value: string, entry: any) => (
                  <span style={{
                    color: selectedAirSeries === null || selectedAirSeries === entry.dataKey ? '#fff' : '#666',
                    fontWeight: selectedAirSeries === entry.dataKey ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}>
                    {value}
                  </span>
                )}
              />
              <Line type="monotone" dataKey="aircraft" name="Aircraft" stroke={EQUIPMENT_COLORS.aircraft} dot={false} hide={selectedAirSeries !== null && selectedAirSeries !== 'aircraft'} />
              <Line type="monotone" dataKey="helicopter" name="Helicopters" stroke={EQUIPMENT_COLORS.helicopter} dot={false} hide={selectedAirSeries !== null && selectedAirSeries !== 'helicopter'} />
              <Line type="monotone" dataKey="drone" name="Drones" stroke={EQUIPMENT_COLORS.drone} dot={false} hide={selectedAirSeries !== null && selectedAirSeries !== 'drone'} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Daily Tank Losses (Last 180 Days) <SourceLink source="Ukraine MOD" /></h3>
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
