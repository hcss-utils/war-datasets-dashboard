import React from 'react';
import Plot from 'react-plotly.js';
import type { ViinaDaily } from '../../types';

interface Props {
  data: ViinaDaily[];
}

export default function ViinaPlotlyDemo({ data }: Props) {
  return (
    <div className="chart-card">
      <h3>Daily Events (Plotly) - Drag to Select Time Range</h3>
      <p className="chart-note">
        <strong>Click and drag</strong> directly on the chart to zoom. Double-click to reset.
        Use buttons below for quick ranges.
      </p>
      <Plot
        data={[
          {
            x: data.map(d => d.date),
            y: data.map(d => d.events),
            type: 'scatter',
            mode: 'lines',
            name: 'Events',
            line: {
              color: '#22c55e',
              width: 1.5,
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(34, 197, 94, 0.2)',
          },
        ]}
        layout={{
          autosize: true,
          height: 400,
          margin: { l: 60, r: 20, t: 20, b: 80 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            color: '#888',
            size: 11,
          },
          xaxis: {
            title: '',
            gridcolor: '#333',
            linecolor: '#333',
            tickangle: -45,
            rangeslider: {
              visible: true,
              thickness: 0.08,
              bgcolor: '#1a1a2e',
              bordercolor: '#333',
            },
            rangeselector: {
              buttons: [
                { count: 1, label: '1M', step: 'month', stepmode: 'backward' },
                { count: 3, label: '3M', step: 'month', stepmode: 'backward' },
                { count: 6, label: '6M', step: 'month', stepmode: 'backward' },
                { count: 1, label: '1Y', step: 'year', stepmode: 'backward' },
                { step: 'all', label: 'All' },
              ],
              bgcolor: '#1a1a2e',
              activecolor: '#22c55e',
              bordercolor: '#333',
              font: { color: '#fff', size: 10 },
              x: 0,
              y: 1.15,
            },
          },
          yaxis: {
            title: '',
            gridcolor: '#333',
            linecolor: '#333',
            tickformat: ',',
          },
          dragmode: 'zoom', // This enables click-drag to zoom!
          hovermode: 'x unified',
        }}
        config={{
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          responsive: true,
        }}
        style={{ width: '100%' }}
      />
    </div>
  );
}
