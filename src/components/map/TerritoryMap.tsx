import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useDashboard } from '../../context/DashboardContext';
import { loadTerritoryGeoJSON, loadDeepStateGeoJSON } from '../../data/loader';
import TimeSlider from './TimeSlider';
import MapLegend from './MapLegend';
import type { DailyArea } from '../../types';
import type { GeoJsonObject } from 'geojson';

const LAYER_META: Record<string, { label: string; color: string }> = {
  ukraine_control_map: { label: 'Russian-occupied', color: '#d62728' },
  russian_advances: { label: 'Russian advances', color: '#f97316' },
  ukrainian_counteroffensives: { label: 'Ukrainian counteroffensives', color: '#3b82f6' },
  kursk_ukrainian_advances: { label: 'Kursk — UA incursion (into Russia)', color: '#22d3ee' },
  kursk_russian_advances: { label: 'Kursk — RU reclaim', color: '#a855f7' },
};
const ALL_LAYERS = Object.keys(LAYER_META);

// Fit the map to the loaded territory: once per dataset load, and again when `fitKey`
// changes (the Fit button). Skips re-fitting on every date step.
function FitBounds({ data, fitKey }: { data: any; fitKey: string }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!data || fitKey === last.current) return;
    try {
      const b = L.geoJSON(data).getBounds();
      if (b.isValid()) { map.fitBounds(b, { padding: [25, 25] }); last.current = fitKey; }
    } catch { /* ignore invalid geometry */ }
  }, [data, fitKey, map]);
  return null;
}

interface Props {
  dailyAreas: DailyArea[];
  availableDates: string[];
  dataset?: 'isw' | 'deepstate';
}

export default function TerritoryMap({ dailyAreas, availableDates, dataset = 'isw' }: Props) {
  const loadGeo = dataset === 'deepstate' ? loadDeepStateGeoJSON : loadTerritoryGeoJSON;
  const { state } = useDashboard();
  const [currentDate, setCurrentDate] = useState(availableDates[0] || '');
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // ms per step
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set(ALL_LAYERS));
  const [resetCount, setResetCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Filter available dates to current date range
  const filteredDates = availableDates.filter((d) => {
    const startStr = state.dateRange[0].toISOString().substring(0, 10);
    const endStr = state.dateRange[1].toISOString().substring(0, 10);
    return d >= startStr && d <= endStr;
  });

  // Load GeoJSON when date changes
  useEffect(() => {
    if (!currentDate) return;
    let cancelled = false;
    setLoading(true);
    loadGeo(currentDate)
      .then((data) => {
        if (!cancelled) setGeoData(data as unknown as GeoJsonObject);
      })
      .catch(() => {
        if (!cancelled) setGeoData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentDate]);

  // Playback
  useEffect(() => {
    if (playing && filteredDates.length > 1) {
      const idx = filteredDates.indexOf(currentDate);
      timerRef.current = window.setTimeout(() => {
        const next = (idx + 1) % filteredDates.length;
        setCurrentDate(filteredDates[next]);
        if (next === 0) setPlaying(false);
      }, speed);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentDate, filteredDates, speed]);

  const handleDateChange = useCallback((date: string) => {
    setCurrentDate(date);
    setPlaying(false);
  }, []);

  // Split the loaded FeatureCollection by layer_type so each layer renders as its own
  // <GeoJSON> with a solid colour (react-leaflet ignores post-mount data/style changes on a
  // single layer, so one layer per type — keyed by date+type — is the reliable pattern).
  const fc: any = geoData;
  const byLayer: Record<string, any> = {};
  if (fc?.features) {
    for (const f of fc.features) {
      const lt = f?.properties?.layer_type || 'ukraine_control_map';
      (byLayer[lt] ||= { type: 'FeatureCollection', features: [] }).features.push(f);
    }
  }
  const layerStyle = (lt: string) => () => {
    const color = LAYER_META[lt]?.color || '#d62728';
    return { color, weight: 1.5, fillColor: color, fillOpacity: 0.3 };
  };

  return (
    <div className="map-container">
      <div className="map-layer-toggles" style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'center', padding: '4px 2px 8px' }}>
        <button
          onClick={() => setResetCount((c) => c + 1)}
          title="Reset the view to fit the territory"
          style={{ padding: '0.25rem 0.7rem', borderRadius: 6, cursor: 'pointer', border: '1px solid #334155', background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', fontSize: '0.8rem' }}
        >⤢ Fit to territory</button>
        {dataset === 'isw' && ALL_LAYERS.map((lt) => (
          <label key={lt} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabledLayers.has(lt)}
              onChange={() => setEnabledLayers((s) => { const n = new Set(s); if (n.has(lt)) n.delete(lt); else n.add(lt); return n; })}
            />
            <span style={{ width: 11, height: 11, background: LAYER_META[lt].color, display: 'inline-block', borderRadius: 2 }} />
            {LAYER_META[lt].label}
          </label>
        ))}
      </div>
      <div className="map-wrapper">
        <MapContainer
          center={[48.5, 37.5]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBounds data={geoData} fitKey={`${dataset}-${resetCount}`} />
          {geoData && (dataset === 'deepstate'
            ? (
              <GeoJSON
                key={`${currentDate}-ds`}
                data={geoData}
                style={layerStyle('ukraine_control_map')}
              />
            )
            : ALL_LAYERS.filter((lt) => enabledLayers.has(lt) && byLayer[lt]).map((lt) => (
              <GeoJSON
                key={`${currentDate}-${lt}`}
                data={byLayer[lt] as GeoJsonObject}
                style={layerStyle(lt)}
              />
            ))
          )}
        </MapContainer>
        <MapLegend currentDate={currentDate} loading={loading} />
      </div>
      <div className="map-controls">
        <TimeSlider
          dates={filteredDates}
          currentDate={currentDate}
          onDateChange={handleDateChange}
          playing={playing}
          onPlayToggle={() => setPlaying((p) => !p)}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      </div>
    </div>
  );
}
