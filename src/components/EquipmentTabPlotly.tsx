import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { loadEquipmentDaily, loadPersonnelDaily } from '../data/newLoader';
import type { EquipmentDaily, PersonnelDaily } from '../types';
import { DualPaneInfo, RateOfChangeInfo } from './InfoModal';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'Ukraine MOD': 'equipment',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const EQUIPMENT_COLORS: Record<string, string> = {
  tank: '#ef4444',
  apc: '#f97316',
  field_artillery: '#eab308',
  aircraft: '#3b82f6',
  helicopter: '#8b5cf6',
  drone: '#ec4899',
};

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

export default function EquipmentTabPlotly() {
  const [equipment, setEquipment] = useState<EquipmentDaily[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Daily personnel losses
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
      rate: Math.max(-500, Math.min(500, rate)),
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

  // Daily losses for tank chart
  const dailyLosses = equipment.slice(1).map((d, i) => {
    const prev = equipment[i];
    return {
      date: d.date,
      tank: d.tank - prev.tank,
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

      {/* Daily Personnel Losses - Dual Pane */}
      <div className="chart-card">
        <h3>Daily Personnel Losses <SourceLink source="Ukraine MOD" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily losses | Bottom: 7-day rate of change (%) <RateOfChangeInfo /></p>
        <Plot
          data={[
            {
              x: personnelRateData.map(d => d.date),
              y: personnelRateData.map(d => d.daily_loss),
              type: 'bar' as const,
              name: 'Daily Losses',
              marker: { color: '#ef4444' },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 250,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <Plot
          data={[
            {
              x: personnelRateData.map(d => d.date),
              y: personnelRateData.map(d => d.rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Rate of Change',
              line: { color: '#ef4444', width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 200,
            margin: { ...darkLayout.margin, t: 10 },
            yaxis: { ...darkLayout.yaxis, ticksuffix: '%', zeroline: true, zerolinecolor: '#888' },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Daily Heavy Equipment Losses - Dual Pane */}
      <div className="chart-card">
        <h3>Daily Heavy Equipment Losses <SourceLink source="Ukraine MOD" /> <DualPaneInfo /></h3>
        <p className="chart-note">Top: Daily losses | Bottom: 7-day rate of change (%). Click legend to toggle. <RateOfChangeInfo /></p>
        <Plot
          data={[
            {
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.tank),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Tanks',
              line: { color: EQUIPMENT_COLORS.tank, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.apc),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'APCs',
              line: { color: EQUIPMENT_COLORS.apc, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.field_artillery),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Artillery',
              line: { color: EQUIPMENT_COLORS.field_artillery, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 250,
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
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.tank_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Tanks Rate',
              line: { color: EQUIPMENT_COLORS.tank, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.apc_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'APCs Rate',
              line: { color: EQUIPMENT_COLORS.apc, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipmentRateData.map(d => d.date),
              y: equipmentRateData.map(d => d.artillery_rate),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Artillery Rate',
              line: { color: EQUIPMENT_COLORS.field_artillery, width: 1.5 },
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
        {/* Cumulative Air Losses */}
        <div className="chart-card">
          <h3>Cumulative Air Losses <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: equipment.map(d => d.date),
                y: equipment.map(d => d.aircraft),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Aircraft',
                line: { color: EQUIPMENT_COLORS.aircraft, width: 1.5 },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: equipment.map(d => d.date),
                y: equipment.map(d => d.helicopter),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Helicopters',
                line: { color: EQUIPMENT_COLORS.helicopter, width: 1.5 },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: equipment.map(d => d.date),
                y: equipment.map(d => d.drone),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Drones',
                line: { color: EQUIPMENT_COLORS.drone, width: 1.5 },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Daily Tank Losses */}
        <div className="chart-card">
          <h3>Daily Tank Losses (Last 180 Days) <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: dailyLosses.slice(-180).map(d => d.date),
                y: dailyLosses.slice(-180).map(d => d.tank),
                type: 'bar' as const,
                name: 'Tanks Lost',
                marker: { color: EQUIPMENT_COLORS.tank },
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 300,
              xaxis: {
                ...darkLayout.xaxis,
                rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
