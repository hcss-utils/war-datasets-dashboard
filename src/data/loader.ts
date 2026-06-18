import type { DailyArea, MilitaryEvent, GeoJSONFeatureCollection, DashboardMetadata } from '../types';

const BASE_URL = import.meta.env.BASE_URL + 'data';

export async function loadDailyAreas(): Promise<DailyArea[]> {
  const res = await fetch(`${BASE_URL}/daily_areas.json`);
  if (!res.ok) throw new Error(`Failed to load daily areas: ${res.status}`);
  return res.json();
}

export async function loadEvents(): Promise<MilitaryEvent[]> {
  const res = await fetch(`${BASE_URL}/events.json`);
  if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
  return res.json();
}

export async function loadMetadata(): Promise<DashboardMetadata> {
  const res = await fetch(`${BASE_URL}/metadata.json`);
  if (!res.ok) throw new Error(`Failed to load metadata: ${res.status}`);
  return res.json();
}

export async function loadTerritoryGeoJSON(date: string): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(`${BASE_URL}/territory_geojson/${date}.geojson`);
  if (!res.ok) throw new Error(`Failed to load territory GeoJSON for ${date}: ${res.status}`);
  return res.json();
}

export async function loadDeepStateGeoJSON(date: string): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(`${BASE_URL}/deepstate_geojson/${date}.geojson`);
  if (!res.ok) throw new Error(`Failed to load DeepState GeoJSON for ${date}: ${res.status}`);
  return res.json();
}

export async function loadDeepStateMapDates(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/deepstate_geojson_dates.json`);
  if (!res.ok) throw new Error(`Failed to load DeepState map dates: ${res.status}`);
  return res.json();
}

export async function loadIswMapDates(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/isw_geojson_dates.json`);
  if (!res.ok) throw new Error(`Failed to load ISW map dates: ${res.status}`);
  return res.json();
}

export async function loadKurskGeoJSON(date: string): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(`${BASE_URL}/kursk_geojson/${date}.geojson`);
  if (!res.ok) throw new Error(`Failed to load Kursk GeoJSON for ${date}: ${res.status}`);
  return res.json();
}
