import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import {
  loadEquipmentDaily,
  loadOryxByCategory,
  loadUkrDailyUpdateByType,
  type OryxByCategory,
  type UkrDailyUpdateByType,
} from '../../data/newLoader';
import type { EquipmentDaily } from '../../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'Ukraine MOD': 'equipment',
  'Oryx': 'oryx',
  'UkrDailyUpdate': 'ukrdailyupdate',
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

interface EquipmentLossesSubtabProps {
  selectedCountries: Set<string>;
}

export default function EquipmentLossesSubtab({
  selectedCountries,
}: EquipmentLossesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [equipment, setEquipment] = useState<EquipmentDaily[]>([]);
  const [oryxData, setOryxData] = useState<OryxByCategory[]>([]);
  const [ukrUpdateData, setUkrUpdateData] = useState<UkrDailyUpdateByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadEquipmentDaily(),
      loadOryxByCategory(),
      loadUkrDailyUpdateByType(),
    ])
      .then(([eq, oryx, ukr]) => {
        setEquipment(eq);
        setOryxData(oryx);
        setUkrUpdateData(ukr);
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
        <span className="loading-text">Loading equipment losses data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load equipment losses data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const latest = equipment[equipment.length - 1];

  // Daily losses calculation
  const dailyLosses = equipment.slice(1).map((d, i) => {
    const prev = equipment[i];
    return {
      date: d.date,
      tank: d.tank - prev.tank,
      apc: d.apc - prev.apc,
      field_artillery: d.field_artillery - prev.field_artillery,
    };
  });

  // Filter Oryx data based on selected countries
  const showRussia = selectedCountries.has('russia');
  const showUkraine = selectedCountries.has('ukraine');

  // Calculate filtered Oryx totals (data has russia_total/ukraine_total)
  const getFilteredOryxTotal = (category: OryxByCategory) => {
    let total = 0;
    if (showRussia) total += category.russia_total || 0;
    if (showUkraine) total += category.ukraine_total || 0;
    return total;
  };

  const filteredOryxData = oryxData
    .map(cat => ({ ...cat, filteredTotal: getFilteredOryxTotal(cat) }))
    .filter(cat => cat.filteredTotal > 0)
    .sort((a, b) => b.filteredTotal - a.filteredTotal);

  return (
    <div className="conflict-subtab">
      <h2>Equipment Losses</h2>
      <p className="tab-subtitle">Russian equipment losses from Ukraine MOD, Oryx, and UkrDailyUpdate</p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card highlight-red">
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
      </div>

      {/* Ukraine MOD Cumulative */}
      <div className="chart-card">
        <h3>Cumulative Heavy Equipment Losses <SourceLink source="Ukraine MOD" /></h3>
        <Plot
          data={[
            {
              x: equipment.map(d => d.date),
              y: equipment.map(d => d.tank),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Tanks',
              line: { color: EQUIPMENT_COLORS.tank, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipment.map(d => d.date),
              y: equipment.map(d => d.apc),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'APCs',
              line: { color: EQUIPMENT_COLORS.apc, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: equipment.map(d => d.date),
              y: equipment.map(d => d.field_artillery),
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Artillery',
              line: { color: EQUIPMENT_COLORS.field_artillery, width: 1.5 },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 350,
            xaxis: {
              ...darkLayout.xaxis,
              ...(xaxisRange ? { range: xaxisRange } : {}),
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
          onRelayout={onRelayout}
        />
      </div>

      {/* Daily Losses */}
      <div className="chart-card">
        <h3>Daily Heavy Equipment Losses (Last 180 Days) <SourceLink source="Ukraine MOD" /></h3>
        <Plot
          data={[
            {
              x: dailyLosses.slice(-180).map(d => d.date),
              y: dailyLosses.slice(-180).map(d => d.tank),
              type: 'bar' as const,
              name: 'Tanks',
              marker: { color: EQUIPMENT_COLORS.tank },
              hoverlabel: { font: { color: '#fff' } },
            },
            {
              x: dailyLosses.slice(-180).map(d => d.date),
              y: dailyLosses.slice(-180).map(d => d.apc),
              type: 'bar' as const,
              name: 'APCs',
              marker: { color: EQUIPMENT_COLORS.apc },
              hoverlabel: { font: { color: '#fff' } },
            },
          ]}
          layout={{
            ...darkLayout,
            height: 300,
            barmode: 'group',
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Oryx Comparison */}
      {filteredOryxData.length > 0 && (
        <div className="chart-card">
          <h3>
            Equipment by Category <SourceLink source="Oryx" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 12 }}>
              {showRussia && showUkraine ? 'Russia + Ukraine' : showRussia ? 'Russia' : 'Ukraine'}
            </span>
          </h3>
          <Plot
            data={[
              {
                x: filteredOryxData.map(d => d.filteredTotal),
                y: filteredOryxData.map(d => d.category),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: { color: '#ef4444' },
                text: filteredOryxData.map(d => fmt(d.filteredTotal)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 10 },
                hovertemplate: '%{y}: %{x:,}<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: Math.max(350, filteredOryxData.length * 45),
              margin: { l: 200, r: 80, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, tickformat: ',' },
              yaxis: { ...darkLayout.yaxis, type: 'category' as const, autorange: 'reversed' as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* UkrDailyUpdate breakdown */}
      {ukrUpdateData.length > 0 && (() => {
        const sorted = [...ukrUpdateData].sort((a, b) => b.total - a.total).slice(0, 15);
        return (
        <div className="chart-card">
          <h3>Equipment by Type <SourceLink source="UkrDailyUpdate" /></h3>
          <Plot
            data={[
              {
                x: sorted.map(d => d.total),
                y: sorted.map(d => d.equipment_type),
                type: 'bar' as const,
                orientation: 'h' as const,
                marker: { color: '#f97316' },
                text: sorted.map(d => fmt(d.total)),
                textposition: 'outside' as const,
                textfont: { color: '#888', size: 10 },
                hovertemplate: '%{y}: %{x:,}<extra></extra>',
                hoverlabel: { font: { color: '#fff' } },
              },
            ]}
            layout={{
              ...darkLayout,
              height: Math.max(350, sorted.length * 35),
              margin: { l: 180, r: 80, t: 20, b: 40 },
              xaxis: { ...darkLayout.xaxis, tickformat: ',' },
              yaxis: { ...darkLayout.yaxis, type: 'category' as const, autorange: 'reversed' as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        );
      })()}
    </div>
  );
}
