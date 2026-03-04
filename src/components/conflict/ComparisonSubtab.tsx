import React, { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import {
  loadDailyEvents,
  loadViinaDaily,
  loadBellingcatDaily,
  loadOverviewStats,
} from '../../data/newLoader';
import type { DailyEvent, ViinaDaily, BellingcatDaily, OverviewStats } from '../../types';

// Calculate Pearson correlation
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

type Dataset = 'acled' | 'ucdp' | 'viina' | 'bellingcat';

const DATASET_COLORS: Record<Dataset, string> = {
  acled: '#ef4444',
  ucdp: '#3b82f6',
  viina: '#22c55e',
  bellingcat: '#f97316',
};

const DATASET_LABELS: Record<Dataset, string> = {
  acled: 'ACLED',
  ucdp: 'UCDP',
  viina: 'VIINA',
  bellingcat: 'Bellingcat',
};

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

export default function ComparisonSubtab() {
  const [acledUcdp, setAcledUcdp] = useState<DailyEvent[]>([]);
  const [viina, setViina] = useState<ViinaDaily[]>([]);
  const [bellingcat, setBellingcat] = useState<BellingcatDaily[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<Dataset>>(
    new Set(['acled', 'ucdp', 'viina', 'bellingcat'])
  );
  const [normalizeView, setNormalizeView] = useState(false);

  const { xaxisRange, onRelayout } = usePlotlyZoom();

  useEffect(() => {
    Promise.all([
      loadDailyEvents(),
      loadViinaDaily(),
      loadBellingcatDaily(),
      loadOverviewStats(),
    ])
      .then(([au, v, b, s]) => {
        setAcledUcdp(au);
        setViina(v);
        setBellingcat(b);
        setStats(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleToggleDataset = (ds: Dataset) => {
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(ds)) {
        next.delete(ds);
      } else {
        next.add(ds);
      }
      return next;
    });
  };

  // Merge all datasets by date
  const mergedData = useMemo(() => {
    const dateMap: Record<string, {
      acled: number;
      ucdp: number;
      viina: number;
      bellingcat: number;
    }> = {};

    acledUcdp.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = { acled: 0, ucdp: 0, viina: 0, bellingcat: 0 };
      dateMap[d.date].acled = d.acled_events;
      dateMap[d.date].ucdp = d.ucdp_events;
    });

    viina.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = { acled: 0, ucdp: 0, viina: 0, bellingcat: 0 };
      dateMap[d.date].viina = d.events;
    });

    bellingcat.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = { acled: 0, ucdp: 0, viina: 0, bellingcat: 0 };
      dateMap[d.date].bellingcat = d.incidents;
    });

    const dates = Object.keys(dateMap).sort();
    return {
      dates,
      data: dates.map(date => ({
        date,
        ...dateMap[date],
      })),
    };
  }, [acledUcdp, viina, bellingcat]);

  // Calculate correlations between all selected datasets
  const correlations = useMemo(() => {
    const datasets: Dataset[] = ['acled', 'ucdp', 'viina', 'bellingcat'];
    const matrix: Record<string, Record<string, number>> = {};

    datasets.forEach(ds1 => {
      matrix[ds1] = {};
      datasets.forEach(ds2 => {
        if (ds1 === ds2) {
          matrix[ds1][ds2] = 1.0;
        } else if (matrix[ds2]?.[ds1] !== undefined) {
          matrix[ds1][ds2] = matrix[ds2][ds1];
        } else {
          const arr1 = mergedData.data.map(d => d[ds1]);
          const arr2 = mergedData.data.map(d => d[ds2]);
          matrix[ds1][ds2] = pearsonCorrelation(arr1, arr2);
        }
      });
    });

    return matrix;
  }, [mergedData]);

  // Normalized data (events per day, scaled to max = 100)
  const normalizedData = useMemo(() => {
    const maxes: Record<Dataset, number> = {
      acled: Math.max(...mergedData.data.map(d => d.acled), 1),
      ucdp: Math.max(...mergedData.data.map(d => d.ucdp), 1),
      viina: Math.max(...mergedData.data.map(d => d.viina), 1),
      bellingcat: Math.max(...mergedData.data.map(d => d.bellingcat), 1),
    };

    return mergedData.data.map(d => ({
      date: d.date,
      acled: (d.acled / maxes.acled) * 100,
      ucdp: (d.ucdp / maxes.ucdp) * 100,
      viina: (d.viina / maxes.viina) * 100,
      bellingcat: (d.bellingcat / maxes.bellingcat) * 100,
    }));
  }, [mergedData]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading comparison data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load comparison data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const displayData = normalizeView ? normalizedData : mergedData.data;
  const selectedDatasetsList = [...selectedDatasets];

  // Coverage table data
  const coverageData = [
    {
      dataset: 'ACLED',
      start: stats?.date_ranges.acled_start || 'N/A',
      end: stats?.date_ranges.acled_end || 'N/A',
      events: stats?.totals.acled_events || 0,
    },
    {
      dataset: 'UCDP',
      start: stats?.date_ranges.ucdp_start || 'N/A',
      end: stats?.date_ranges.ucdp_end || 'N/A',
      events: stats?.totals.ucdp_events || 0,
    },
    {
      dataset: 'VIINA',
      start: stats?.date_ranges.viina_start || 'N/A',
      end: stats?.date_ranges.viina_end || 'N/A',
      events: stats?.totals.viina_events || 0,
    },
    {
      dataset: 'Bellingcat',
      start: stats?.date_ranges.bellingcat_start || 'N/A',
      end: stats?.date_ranges.bellingcat_end || 'N/A',
      events: stats?.totals.bellingcat_incidents || 0,
    },
  ];

  return (
    <div className="conflict-subtab">
      <h2>Dataset Comparison</h2>
      <p className="tab-subtitle">
        Compare conflict event data across ACLED, UCDP, VIINA, and Bellingcat datasets
      </p>

      {/* Dataset selector */}
      <div className="comparison-controls">
        <div className="dataset-selector">
          <span className="control-label">Datasets:</span>
          {(['acled', 'ucdp', 'viina', 'bellingcat'] as Dataset[]).map(ds => (
            <button
              key={ds}
              className={`dataset-chip ${selectedDatasets.has(ds) ? 'selected' : ''}`}
              onClick={() => handleToggleDataset(ds)}
              style={selectedDatasets.has(ds) ? {
                backgroundColor: DATASET_COLORS[ds],
                borderColor: DATASET_COLORS[ds],
              } : undefined}
            >
              {DATASET_LABELS[ds]}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <span className="control-label">View:</span>
          <button
            className={`view-btn ${!normalizeView ? 'active' : ''}`}
            onClick={() => setNormalizeView(false)}
          >
            Absolute
          </button>
          <button
            className={`view-btn ${normalizeView ? 'active' : ''}`}
            onClick={() => setNormalizeView(true)}
          >
            Normalized
          </button>
        </div>
      </div>

      {/* Stacked Bar Time Series */}
      <div className="chart-card">
        <h3>Daily Events Comparison {normalizeView && '(Normalized to 0-100)'}</h3>
        <p className="chart-note">
          {normalizeView
            ? 'Each dataset scaled relative to its own maximum (100 = peak day)'
            : 'Stacked bar view of daily event counts. Drag to zoom.'}
        </p>
        <Plot
          data={selectedDatasetsList.map(ds => ({
            x: mergedData.dates,
            y: displayData.map(d => d[ds]),
            type: 'bar' as const,
            name: DATASET_LABELS[ds],
            marker: { color: DATASET_COLORS[ds] },
            hoverlabel: { font: { color: '#fff' } },
          }))}
          layout={{
            ...darkLayout,
            barmode: 'stack',
            height: 400,
            xaxis: {
              ...darkLayout.xaxis,
              ...(xaxisRange ? { range: xaxisRange } : {}),
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            yaxis: {
              ...darkLayout.yaxis,
              title: { text: normalizeView ? 'Normalized (0-100)' : 'Events', font: { size: 11, color: '#888' } },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.1 },
          }}
          onRelayout={onRelayout}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-grid-2">
        {/* Correlation Matrix */}
        <div className="chart-card">
          <h3>Correlation Matrix (Pearson r)</h3>
          <p className="chart-note">Correlation between daily event counts across datasets</p>
          <Plot
            data={[
              {
                z: ['acled', 'ucdp', 'viina', 'bellingcat'].map(ds1 =>
                  ['acled', 'ucdp', 'viina', 'bellingcat'].map(ds2 =>
                    Number(correlations[ds1][ds2].toFixed(3))
                  )
                ),
                x: ['ACLED', 'UCDP', 'VIINA', 'Bellingcat'],
                y: ['ACLED', 'UCDP', 'VIINA', 'Bellingcat'],
                type: 'heatmap' as const,
                colorscale: [
                  [0, '#ef4444'],
                  [0.5, '#1a1a2e'],
                  [1, '#22c55e'],
                ],
                zmin: -1,
                zmax: 1,
                text: ['acled', 'ucdp', 'viina', 'bellingcat'].map(ds1 =>
                  ['acled', 'ucdp', 'viina', 'bellingcat'].map(ds2 =>
                    correlations[ds1][ds2].toFixed(3)
                  )
                ),
                texttemplate: '%{text}',
                textfont: { color: '#fff', size: 12 },
                hoverongaps: false,
                hoverlabel: { font: { color: '#fff' } },
                showscale: true,
                colorbar: {
                  title: { text: 'r', font: { color: '#888', size: 11 } },
                  tickfont: { color: '#888', size: 10 },
                },
              },
            ]}
            layout={{
              ...darkLayout,
              height: 350,
              margin: { l: 80, r: 80, t: 20, b: 80 },
              xaxis: { ...darkLayout.xaxis, side: 'bottom' as const },
              yaxis: { ...darkLayout.yaxis, autorange: 'reversed' as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Coverage Table */}
        <div className="chart-card">
          <h3>Data Coverage Summary</h3>
          <p className="chart-note">Date ranges and total event counts per dataset</p>
          <div className="coverage-table-container">
            <table className="coverage-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Total Events</th>
                </tr>
              </thead>
              <tbody>
                {coverageData.map((row) => (
                  <tr key={row.dataset}>
                    <td style={{ color: DATASET_COLORS[row.dataset.toLowerCase() as Dataset] || '#fff' }}>
                      {row.dataset}
                    </td>
                    <td>{row.start}</td>
                    <td>{row.end}</td>
                    <td>{row.events.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly comparison */}
      <div className="chart-card">
        <h3>Monthly Events by Dataset</h3>
        <p className="chart-note">Stacked bar view of monthly event counts. Click legend to toggle.</p>
        <Plot
          data={(() => {
            // Aggregate by month
            const monthlyData: Record<string, Record<Dataset, number>> = {};
            mergedData.data.forEach(d => {
              const month = d.date.substring(0, 7);
              if (!monthlyData[month]) {
                monthlyData[month] = { acled: 0, ucdp: 0, viina: 0, bellingcat: 0 };
              }
              monthlyData[month].acled += d.acled;
              monthlyData[month].ucdp += d.ucdp;
              monthlyData[month].viina += d.viina;
              monthlyData[month].bellingcat += d.bellingcat;
            });

            const months = Object.keys(monthlyData).sort();
            return selectedDatasetsList.map(ds => ({
              x: months,
              y: months.map(m => monthlyData[m][ds]),
              type: 'bar' as const,
              name: DATASET_LABELS[ds],
              marker: { color: DATASET_COLORS[ds] },
              hoverlabel: { font: { color: '#fff' } },
            }));
          })()}
          layout={{
            ...darkLayout,
            barmode: 'stack',
            height: 400,
            xaxis: {
              ...darkLayout.xaxis,
              rangeslider: { visible: true, thickness: 0.08, bgcolor: '#1a1a2e', bordercolor: '#333' },
            },
            legend: { ...darkLayout.legend, orientation: 'h' as const, y: -0.25 },
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
