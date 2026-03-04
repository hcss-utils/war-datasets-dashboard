import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useDashboard } from '../../context/DashboardContext';
import { loadTerritoryGeoJSON } from '../../data/loader';
import TimeSlider from './TimeSlider';
import MapLegend from './MapLegend';
import type { DailyArea } from '../../types';
import type { GeoJsonObject } from 'geojson';

interface Props {
  dailyAreas: DailyArea[];
  availableDates: string[];
}

export default function TerritoryMap({ dailyAreas, availableDates }: Props) {
  const { state } = useDashboard();
  const [currentDate, setCurrentDate] = useState(availableDates[0] || '');
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // ms per step
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
    loadTerritoryGeoJSON(currentDate)
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

  const geoStyle = {
    color: '#d62728',
    weight: 1.5,
    fillColor: '#d62728',
    fillOpacity: 0.35,
  };

  return (
    <div className="map-container">
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
          {geoData && (
            <GeoJSON
              key={currentDate}
              data={geoData}
              style={() => geoStyle}
            />
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
