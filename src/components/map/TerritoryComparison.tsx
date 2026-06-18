import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface LevelRow { date: string; iswKm2: number | null; deepstateKm2: number | null; }
interface IouRow { date: string; iou: number; iswKm2: number; dsKm2: number; }
interface WmRow { date: string; km2: number; }
interface Corr {
  levelSeries: LevelRow[];
  warMapper: WmRow[];
  iou: IouRow[];
  summary: {
    meanIoU: number; iouRange: [number, number]; tempoR: number;
    levelBiasPctDeepStateHigher: number; conservatismOrdering: string;
    wmDeepStateLevelR: number; wmIswLevelR: number; iswSubsetOfDeepState: boolean; note: string;
  };
}

const BASE = import.meta.env.BASE_URL + 'data';
const dark = {
  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
  font: { color: '#b0b0b0', size: 11 }, margin: { l: 64, r: 20, t: 36, b: 60 },
  xaxis: { gridcolor: '#333', linecolor: '#333' },
  yaxis: { gridcolor: '#333', linecolor: '#333', tickformat: ',' },
  legend: { bgcolor: 'transparent', font: { color: '#fff', size: 10 }, orientation: 'h' as const, y: 1.15 },
  hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#333', font: { color: '#fff', size: 12 } },
  hovermode: 'x unified' as const,
};
const cfg = { displayModeBar: true, displaylogo: false, responsive: true };

export default function TerritoryComparison() {
  const [d, setD] = useState<Corr | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/territory_correspondence.json`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setD).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="no-data-msg">Could not load correspondence data ({err}).</div>;
  if (!d) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading correspondence…</span></div>;

  const s = d.summary;
  const dates = d.levelSeries.map((r) => r.date);

  return (
    <div className="conflict-subtab">
      <h2>ISW vs DeepState — correspondence</h2>
      <p className="tab-subtitle">How the two territorial-control datasets agree and differ (War Mapper folded in as a conservative third cross-check). IoU recomputed live from the polygons (EPSG:6933).</p>

      <div className="stat-cards conflict-stats">
        <div className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <span className="stat-value">{s.meanIoU}</span>
          <span className="stat-label">MEAN SPATIAL IoU ({s.iouRange[0]}–{s.iouRange[1]})</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #f97316' }}>
          <span className="stat-value">~{s.tempoR}</span>
          <span className="stat-label">TEMPO CORRELATION (day-to-day)</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <span className="stat-value">~{s.levelBiasPctDeepStateHigher}%</span>
          <span className="stat-label">DEEPSTATE HIGHER ON EXTENT</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <span className="stat-value">r={s.wmDeepStateLevelR}</span>
          <span className="stat-label">WAR MAPPER ↔ DEEPSTATE (LEVEL)</span>
        </div>
      </div>

      <ul className="insight-list" style={{ lineHeight: 1.6, margin: '0.5rem 0 1.25rem 1.1rem' }}>
        <li>The two sources <strong>agree on ~98% of the ground</strong> (mean IoU {s.meanIoU}) and on total extent (~{s.levelBiasPctDeepStateHigher}% — DeepState slightly higher), but <strong>not on day-to-day timing</strong> (tempo correlation ≈ {s.tempoR}).</li>
        <li><strong>ISW is a near-subset of DeepState</strong> — DeepState maps the contested fringe sooner; that disagreement fringe is <strong>growing</strong> (IoU {s.iouRange[1]} → {s.iouRange[0]} over time).</li>
        <li>Clean conservatism ordering <strong>{s.conservatismOrdering}</strong>; the two continuous-geolocation sources track at r={s.wmDeepStateLevelR} (WM↔DeepState) vs {s.wmIswLevelR} (WM↔ISW) — so ISW is the dynamical outlier from its editorial batch-redraw cadence.</li>
        <li>Practical rule: <strong>{s.note}</strong></li>
      </ul>

      <div className="chart-card">
        <h3>Occupied territory — level (ISW vs DeepState vs War Mapper)</h3>
        <Plot
          data={[
            { x: dates, y: d.levelSeries.map((r) => r.deepstateKm2), type: 'scatter', mode: 'lines', name: 'DeepState (daily)', line: { color: '#ef4444', width: 1.5 }, connectgaps: false },
            { x: dates, y: d.levelSeries.map((r) => r.iswKm2), type: 'scatter', mode: 'lines', name: 'ISW (editorial)', line: { color: '#3b82f6', width: 1.5 }, connectgaps: false },
            { x: d.warMapper.map((r) => r.date), y: d.warMapper.map((r) => r.km2), type: 'scatter', mode: 'lines+markers', name: 'War Mapper (monthly)', line: { color: '#eab308', width: 1.5, dash: 'dot' }, marker: { size: 4 } },
          ] as any}
          layout={{ ...dark, height: 380, yaxis: { ...dark.yaxis, title: { text: 'Occupied area (km²)', font: { size: 11, color: '#888' } } } } as any}
          config={cfg}
          style={{ width: '100%' }}
        />
      </div>

      <div className="chart-card">
        <h3>Spatial agreement over time — monthly IoU (live PostGIS)</h3>
        <Plot
          data={[
            { x: d.iou.map((r) => r.date), y: d.iou.map((r) => r.iou), type: 'scatter', mode: 'lines+markers', name: 'IoU', line: { color: '#22c55e', width: 2 }, marker: { size: 5 } },
          ] as any}
          layout={{ ...dark, height: 320, yaxis: { ...dark.yaxis, tickformat: '.3f', range: [0.9, 1.0], title: { text: 'Jaccard IoU', font: { size: 11, color: '#888' } } } } as any}
          config={cfg}
          style={{ width: '100%' }}
        />
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          IoU = area(ISW ∩ DeepState) / area(ISW ∪ DeepState) of the occupied polygons, recomputed monthly from PostGIS in equal-area projection. The decline is the growing contested grey-zone fringe.
        </p>
      </div>
    </div>
  );
}
