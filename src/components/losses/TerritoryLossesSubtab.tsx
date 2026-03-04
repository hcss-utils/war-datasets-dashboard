import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadDailyAreas } from '../../data/newLoader';
import type { DailyArea, TerritoryLayerType } from '../../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'DeepState': 'deepstate',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
};

const LAYER_COLORS: Record<string, string> = {
  russian_advances: '#ef4444',
  russian_claimed: '#f97316',
  ukraine_control_map: '#22c55e',
  ukrainian_counteroffensives: '#3b82f6',
  partisan_warfare: '#8b5cf6',
};

const LAYER_LABELS: Record<string, string> = {
  russian_advances: 'Russian Advances',
  russian_claimed: 'Russian Claimed',
  ukraine_control_map: 'Ukrainian Control',
  ukrainian_counteroffensives: 'Ukrainian Counteroffensives',
  partisan_warfare: 'Partisan Warfare',
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

interface TerritoryLossesSubtabProps {
  selectedLayers: Set<TerritoryLayerType>;
}

export default function TerritoryLossesSubtab({ selectedLayers }: TerritoryLossesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [dailyAreas, setDailyAreas] = useState<DailyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDailyAreas()
      .then((data) => {
        setDailyAreas(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Process data by layer type
  const processedData = useMemo((): {
    dates: string[];
    layerData: Record<string, Record<string, number>>;
    layerTypes?: string[];
  } => {
    if (!dailyAreas.length) return { dates: [], layerData: {} };

    // Get unique dates and layer types
    const dates = [...new Set(dailyAreas.map(d => d.date))].sort();
    const layerTypes = [...new Set(dailyAreas.map(d => d.layerType))];

    // Create data structure: { layerType: { date: area } }
    const layerData: Record<string, Record<string, number>> = {};
    layerTypes.forEach(layer => {
      layerData[layer] = {};
    });

    dailyAreas.forEach(d => {
      layerData[d.layerType][d.date] = d.areaKm2;
    });

    return { dates, layerData, layerTypes };
  }, [dailyAreas]);

  // Calculate daily changes for selected layers
  const dailyChanges = useMemo(() => {
    if (!processedData.dates.length) return [];

    return processedData.dates.slice(1).map((date, i) => {
      const prevDate = processedData.dates[i];
      const changes: Record<string, string | number> = { date };

      Array.from(selectedLayers).forEach(layer => {
        const current = processedData.layerData[layer]?.[date] || 0;
        const prev = processedData.layerData[layer]?.[prevDate] || 0;
        changes[layer] = current - prev;
      });

      return changes;
    });
  }, [processedData, selectedLayers]);

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

  // Get latest values for stats
  const latestDate = processedData.dates[processedData.dates.length - 1];
  const latestValues: Record<string, number> = {};
  Object.keys(processedData.layerData).forEach(layer => {
    latestValues[layer] = processedData.layerData[layer][latestDate] || 0;
  });

  // Filter layers based on selection
  const selectedLayersList = Array.from(selectedLayers).filter(
    layer => processedData.layerData[layer]
  );

  if (selectedLayersList.length === 0) {
    return (
      <div className="conflict-subtab">
        <h2>Territory Control</h2>
        <p className="tab-subtitle">Select at least one layer type to view data</p>
        <div className="no-data-msg">No layers selected. Use the sidebar to select layer types.</div>
      </div>
    );
  }

  return (
    <div className="conflict-subtab">
      <h2>Territory Control</h2>
      <p className="tab-subtitle">Daily territorial control data from DeepState/ISW</p>

      <div className="stat-cards conflict-stats">
        {selectedLayersList.map(layer => (
          <div key={layer} className="stat-card" style={{ borderLeft: `3px solid ${LAYER_COLORS[layer]}` }}>
            <span className="stat-value">{fmt(Math.round(latestValues[layer] || 0))}</span>
            <span className="stat-label">{LAYER_LABELS[layer]} (km²)</span>
          </div>
        ))}
      </div>

      {/* Stacked Area Chart */}
      <div className="chart-card">
        <h3>Territory by Layer Type <SourceLink source="DeepState" /></h3>
        <Plot
          data={selectedLayersList.map(layer => ({
            x: processedData.dates,
            y: processedData.dates.map(date => processedData.layerData[layer][date] || 0),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: LAYER_LABELS[layer],
            line: { color: LAYER_COLORS[layer], width: 1.5 },
            fill: 'tozeroy',
            fillcolor: LAYER_COLORS[layer] + '40',
            hoverlabel: { font: { color: '#fff' } },
            hovertemplate: `${LAYER_LABELS[layer]}: %{y:,.0f} km²<extra></extra>`,
          }))}
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
              tickformat: ',',
              title: { text: 'Area (km²)', font: { size: 11, color: '#888' } },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
          onRelayout={onRelayout}
        />
      </div>

      {/* Ukrainian Control Focus */}
      {selectedLayers.has('ukraine_control_map') && (
        <div className="chart-card">
          <h3>Ukrainian-Controlled Territory <SourceLink source="DeepState" /></h3>
          <Plot
            data={[
              {
                x: processedData.dates,
                y: processedData.dates.map(date => processedData.layerData['ukraine_control_map']?.[date] || 0),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Ukrainian Control',
                line: { color: '#22c55e', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(34, 197, 94, 0.2)',
                hoverlabel: { font: { color: '#fff' } },
                hovertemplate: '%{y:,.0f} km²<extra></extra>',
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
                tickformat: ',',
                title: { text: 'Area (km²)', font: { size: 11, color: '#888' } },
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Daily Changes Bar Chart */}
      <div className="chart-card">
        <h3>Daily Territory Changes (Last 90 Days) <SourceLink source="DeepState" /></h3>
        <Plot
          data={selectedLayersList.map(layer => ({
            x: dailyChanges.slice(-90).map(d => d.date),
            y: dailyChanges.slice(-90).map(d => (d as any)[layer] || 0),
            type: 'bar' as const,
            name: LAYER_LABELS[layer],
            marker: { color: LAYER_COLORS[layer] },
            hoverlabel: { font: { color: '#fff' } },
            hovertemplate: `${LAYER_LABELS[layer]}: %{y:+,.1f} km²<extra></extra>`,
          }))}
          layout={{
            ...darkLayout,
            height: 300,
            barmode: 'group',
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.1, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: {
              ...darkLayout.yaxis,
              tickformat: '+,',
              title: { text: 'Change (km²)', font: { size: 11, color: '#888' } },
              zeroline: true,
              zerolinecolor: '#666',
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
