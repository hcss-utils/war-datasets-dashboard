import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { usePlotlyZoom } from '../../utils/usePlotlyZoom';
import { loadPersonnelDaily, loadKIUOfficersSummary } from '../../data/newLoader';
import type { PersonnelDaily, KIUOfficersSummary } from '../../types';

const fmt = (n: number) => n.toLocaleString();

const SOURCE_ID_MAP: Record<string, string> = {
  'Ukraine MOD': 'equipment',
  'KIU': 'kiu',
};

const SourceLink = ({ source }: { source: string }) => {
  const sourceId = SOURCE_ID_MAP[source] || source.toLowerCase();
  return (
    <a href={`#sources-${sourceId}`} className="source-link-inline">
      ({source})
    </a>
  );
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

interface HumanLossesSubtabProps {
  selectedViews: Set<string>;
}

export default function HumanLossesSubtab({ selectedViews }: HumanLossesSubtabProps) {
  const { xaxisRange, onRelayout } = usePlotlyZoom();
  const [personnel, setPersonnel] = useState<PersonnelDaily[]>([]);
  const [officers, setOfficers] = useState<KIUOfficersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadPersonnelDaily(), loadKIUOfficersSummary()])
      .then(([pers, off]) => {
        setPersonnel(pers);
        setOfficers(off);
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
        <span className="loading-text">Loading human losses data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load human losses data</h3>
        <p>{error}</p>
      </div>
    );
  }

  const latestPersonnel = personnel[personnel.length - 1];

  // Calculate daily losses
  const dailyPersonnel = personnel.slice(1).map((d, i) => {
    const prev = personnel[i];
    return {
      date: d.date,
      daily_loss: d.personnel - prev.personnel,
      cumulative: d.personnel,
    };
  });

  // 7-day rolling average
  const rollingData = dailyPersonnel.map((d, i, arr) => {
    const window = arr.slice(Math.max(0, i - 6), i + 1);
    const avgLoss = window.reduce((s, x) => s + x.daily_loss, 0) / window.length;
    return {
      ...d,
      avg_loss: Math.round(avgLoss),
    };
  });

  // Officers breakdown for pie chart
  const officerData = officers ? [
    { label: 'Senior Officers', value: officers.senior_officers, color: '#ef4444' },
    { label: 'Junior Officers', value: officers.junior_officers, color: '#f97316' },
    { label: 'Other', value: officers.other, color: '#eab308' },
  ] : [];

  const showCumulative = selectedViews.has('cumulative');
  const showDaily = selectedViews.has('daily');

  return (
    <div className="conflict-subtab">
      <h2>Russian Human Losses</h2>
      <p className="tab-subtitle">Personnel and officer casualties from Ukrainian Ministry of Defense and KIU</p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card highlight-red">
          <span className="stat-value">{fmt(latestPersonnel?.personnel || 0)}</span>
          <span className="stat-label">Total Personnel</span>
        </div>
        {officers && (
          <>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.total_officers)}</span>
              <span className="stat-label">Officers (KIU)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.senior_officers)}</span>
              <span className="stat-label">Senior Officers</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{fmt(officers.junior_officers)}</span>
              <span className="stat-label">Junior Officers</span>
            </div>
          </>
        )}
      </div>

      {showCumulative && (
        <div className="chart-card">
          <h3>Cumulative Personnel Losses <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: personnel.map(d => d.date),
                y: personnel.map(d => d.personnel),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Cumulative Losses',
                line: { color: '#ef4444', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(239, 68, 68, 0.2)',
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
              yaxis: {
                ...darkLayout.yaxis,
                tickformat: ',',
              },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
            onRelayout={onRelayout}
          />
        </div>
      )}

      {showDaily && (
        <div className="chart-card">
          <h3>Daily Personnel Losses (7-day Rolling Average) <SourceLink source="Ukraine MOD" /></h3>
          <Plot
            data={[
              {
                x: rollingData.map(d => d.date),
                y: rollingData.map(d => d.daily_loss),
                type: 'bar' as const,
                name: 'Daily Losses',
                marker: { color: 'rgba(239, 68, 68, 0.5)' },
                hoverlabel: { font: { color: '#fff' } },
              },
              {
                x: rollingData.map(d => d.date),
                y: rollingData.map(d => d.avg_loss),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: '7-day Average',
                line: { color: '#ef4444', width: 2 },
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
              legend: { ...darkLayout.legend, orientation: 'h' as const, y: 1.15 },
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {officers && (
        <div className="chart-grid-2">
          <div className="chart-card">
            <h3>Officers by Rank Category <SourceLink source="KIU" /></h3>
            <Plot
              data={[
                {
                  values: officerData.map(d => d.value),
                  labels: officerData.map(d => d.label),
                  type: 'pie' as const,
                  marker: { colors: officerData.map(d => d.color) },
                  textinfo: 'label+percent',
                  textposition: 'outside',
                  hovertemplate: '%{label}: %{value:,}<extra></extra>',
                  hoverlabel: { font: { color: '#fff' } },
                },
              ]}
              layout={{
                ...darkLayout,
                height: 300,
                margin: { l: 20, r: 20, t: 20, b: 20 },
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="chart-card">
            <h3>Officers Breakdown <SourceLink source="KIU" /></h3>
            <Plot
              data={[
                {
                  x: officerData.map(d => d.value),
                  y: officerData.map(d => d.label),
                  type: 'bar' as const,
                  orientation: 'h' as const,
                  marker: { color: officerData.map(d => d.color) },
                  text: officerData.map(d => fmt(d.value)),
                  textposition: 'outside' as const,
                  textfont: { color: '#888', size: 11 },
                  hovertemplate: '%{y}: %{x:,}<extra></extra>',
                  hoverlabel: { font: { color: '#fff' } },
                },
              ]}
              layout={{
                ...darkLayout,
                height: 300,
                margin: { l: 120, r: 80, t: 20, b: 40 },
                xaxis: { ...darkLayout.xaxis, tickformat: ',' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
