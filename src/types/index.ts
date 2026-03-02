export interface DailyArea {
  date: string;
  layerType: string;
  areaKm2: number;
}

export interface MilitaryEvent {
  date: string;
  name: string;
  importance: number;
  territorial: number;
  strategic: number;
  cascade: number;
  confidence: string;
}

export interface MonthlyChange {
  month: string;
  change: number;
}

export interface RatePoint {
  date: string;
  area: number;
  rate: number;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

export interface DashboardMetadata {
  dateRange: {
    start: string;
    end: string;
  };
  layerTypes: string[];
  totalDailyRecords: number;
  totalEvents: number;
  territoryChangePoints: number;
  kurskChangePoints: number;
  exportTimestamp: string;
}

export type TabId = 'overview' | 'conflict' | 'aerial' | 'threats' | 'losses' | 'economic' | 'sabotage' | 'humanitarian' | 'events' | 'map' | 'sources';

// Subtab types for tabs with 2-level navigation
export type ThreatsSubtab = 'events' | 'coercive' | 'redlines' | 'varx';
export type EconomicSubtab = 'energy' | 'aid' | 'military';
export type SabotageSubtab = 'cyber' | 'disinfo' | 'infrastructure' | 'hybrid';
export type ConflictSubtab = 'acled' | 'ucdp' | 'viina' | 'bellingcat' | 'acled-hdx' | 'comparison';

// New data types for additional visualizations
export interface OverviewStats {
  totals: {
    acled_events: number;
    ucdp_events: number;
    viina_events: number;
    bellingcat_incidents: number;
    missile_attacks: number;
    total_missiles_launched: number;
    total_missiles_intercepted: number;
    total_tanks_destroyed: number;
    total_aircraft_destroyed: number;
    total_personnel: number;
    ohchr_killed: number;
    ohchr_injured: number;
    gdelt_threat_events?: number;
    gdelt_coercive_records?: number;
    gdelt_redline_records?: number;
    gas_flow_records?: number;
    fossil_revenue_records?: number;
    eu_sanctions_entities?: number;
    cyber_incidents?: number;
    disinfo_cases?: number;
    baltic_cable_incidents?: number;
  };
  date_ranges: {
    acled_start: string;
    acled_end: string;
    ucdp_start: string;
    ucdp_end: string;
    viina_start: string;
    viina_end: string;
    bellingcat_start: string;
    bellingcat_end: string;
    equipment_start: string;
    equipment_end: string;
    missiles_start: string;
    missiles_end: string;
    ohchr_start: string;
    ohchr_end: string;
    gdelt_start?: string;
    gdelt_end?: string;
    gas_start?: string;
    gas_end?: string;
  };
  export_timestamp: string;
}

export interface DailyEvent {
  date: string;
  acled_events: number;
  acled_fatalities: number;
  ucdp_events: number;
  ucdp_fatalities: number;
}

export interface EventByType {
  event_type: string;
  sub_event_type: string;
  count: number;
  fatalities: number;
}

export interface EventByRegion {
  region: string;
  events: number;
  fatalities: number;
  first_event: string;
  last_event: string;
}

export interface MonthlyEventData {
  month: string;
  event_type: string;
  events: number;
  fatalities: number;
}

export interface MissileAttack {
  date: string;
  model: string;
  launched: number;
  destroyed: number;
  intercept_rate: number;
  is_shahed: number;
  carrier: string;
  target: string;
  affected_region: string;
}

export interface DailyAerialThreat {
  date: string;
  total_launched: number;
  total_destroyed: number;
  drones_launched: number;
  drones_destroyed: number;
  missiles_launched: number;
  missiles_destroyed: number;
  attack_waves: number;
}

export interface WeaponTypeSummary {
  model: string;
  total_launched: number;
  total_destroyed: number;
  intercept_rate: number;
  attack_count: number;
}

export interface EquipmentDaily {
  date: string;
  day: number;
  tank: number;
  apc: number;
  field_artillery: number;
  mrl: number;
  anti_aircraft: number;
  aircraft: number;
  helicopter: number;
  drone: number;
  cruise_missiles: number;
  naval_ship: number;
  vehicles_fuel_tanks: number;
  special_equipment: number;
}

export interface PersonnelDaily {
  date: string;
  day: number;
  personnel: number;
}

export interface CasualtyData {
  year: number;
  month: number;
  region: string;
  killed: number;
  injured: number;
  total: number;
}

export interface RefugeeByCountry {
  year: number;
  country_of_asylum: string;
  refugees: number;
  asylum_seekers: number;
}

export interface RefugeeTotals {
  year: number;
  total_refugees: number;
  total_asylum_seekers: number;
  total_idps: number;
  destination_countries: number;
}

export interface DashboardState {
  dateRange: [Date, Date];
  fullDateRange: [Date, Date];
  selectedEvents: string[];
  activeTab: TabId;
  showInterpolation: boolean;
  highlightedEvent: string | null;
  isLoading: boolean;
  error: string | null;
}

export type DashboardAction =
  | { type: 'SET_DATE_RANGE'; payload: [Date, Date] }
  | { type: 'SET_FULL_DATE_RANGE'; payload: [Date, Date] }
  | { type: 'TOGGLE_EVENT'; payload: string }
  | { type: 'SET_SELECTED_EVENTS'; payload: string[] }
  | { type: 'SET_TAB'; payload: TabId }
  | { type: 'TOGGLE_INTERPOLATION' }
  | { type: 'SET_HIGHLIGHTED_EVENT'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// VIINA data types
export interface ViinaDaily {
  date: string;
  events: number;
}

export interface ViinaMonthly {
  month: string;
  events: number;
}

export interface ViinaBySource {
  source: string;
  events: number;
}

export interface ViinaByOblast {
  oblast: string;
  events: number;
}

export interface ViinaMonthlyBySource {
  month: string;
  source: string;
  events: number;
}

// Bellingcat data types
export interface BellingcatDaily {
  date: string;
  incidents: number;
}

export interface BellingcatMonthly {
  month: string;
  incidents: number;
}

export interface BellingcatIncident {
  date: string;
  location: string | null;
  description: string;
  sources: string[];
  latitude: number;
  longitude: number;
}

// === GDELT Types ===
export interface GdeltEventsDaily {
  date: string;
  events: number;
  avg_goldstein: number;
  total_mentions: number;
}

export interface GdeltEventsMonthly {
  month: string;
  events: number;
  avg_goldstein: number;
  total_mentions: number;
}

export interface GdeltEventsByTarget {
  country: string;
  name: string;
  events: number;
  avg_goldstein: number;
}

export interface GdeltGoldstein {
  goldstein_bin: number;
  count: number;
}

export interface GdeltCoerciveDaily {
  day: string;
  records: number;
}

export interface GdeltCoerciveMonthly {
  month: string;
  records: number;
}

export interface GdeltCoerciveSource {
  source: string;
  count: number;
}

export interface GdeltRedlinesMonthly {
  month: string;
  records: number;
}

export interface GdeltRedlinesSource {
  source: string;
  count: number;
}

export interface GdeltVarxWeekly {
  week: string;
  media_volume_all: number;
  media_volume_russia: number;
  media_tone_mean: number;
  media_tone_std: number;
  media_negativity_mean: number;
  media_negativity_std: number;
  nuclear_quote_count: number;
  redline_quote_count: number;
  threat_quote_count: number;
  ultimatum_quote_count: number;
  escalation_quote_count: number;
  deter_quote_count: number;
  russia_share: number;
  year: number;
  week_of_year: number;
}

// === Economic Types ===
export interface EnergyGasFlow {
  date: string;
  norway: number;
  algeria: number;
  russia: number;
  azerbaijan: number;
  libya: number;
  uk_net_flows: number;
  lng: number;
  eu_total: number;
  nord_stream: number;
  ukraine_gas_transit: number;
  yamal_by_pl: number;
  turkstream: number;
}

export interface EnergyFossilRevenue {
  month: string;
  destination_region: string;
  pricing_scenario_name: string;
  total_eur: number;
  total_usd: number;
}

export interface KielAidByDonor {
  donor: string;
  aid_type_general: string;
  commitments: number;
  total_eur: number;
}

export interface KielAidTimeline {
  month: string;
  aid_type_general: string;
  commitments: number;
  total_eur: number;
}

export interface SanctionsEuSummary {
  schema_type: string;
  count: number;
}

export interface SanctionsEuTimeline {
  month: string;
  schema_type: string;
  count: number;
}

export interface SipriExpenditure {
  country: string;
  year: number;
  expenditure_usd: number;
}

// === Sabotage & Disinfo Types ===
export interface CyberIncidentTimeline {
  month: string;
  incidents: number;
}

export interface CyberIncidentByCountry {
  country: string;
  incidents: number;
}

export interface DisinfoMonthly {
  month: string;
  cases: number;
}

export interface DisinfoByLanguage {
  language: string;
  count: number;
}

export interface BalticCableIncident {
  id: number;
  incident_name: string;
  incident_date: string;
  vessel_name: string | null;
  vessel_flag: string | null;
  damage_description: string | null;
  cables_affected: string[] | null;
  source_url: string | null;
  notes: string | null;
}

export interface LeidenHybridEvent {
  id: number;
  incident_year: number;
  incident_month: string | null;
  incident_date_start: string | null;
  what: string;
  where_location: string | null;
  event_category: string | null;
  event_category_2: string | null;
  apparent_goal_1: string | null;
  apparent_goal_2: string | null;
  target_type: string | null;
  target_type_2: string | null;
}

// === ACLED HDX Types ===
export interface AcledHdxMonthly {
  year: string;
  month: string;
  admin1: string;
  events: number;
  fatalities: number;
  data_type: 'violence' | 'civilian' | 'demonstrations';
}

export interface AcledHdxByRegion {
  admin1: string;
  violence_events: number | null;
  violence_fatalities: number | null;
  civilian_events: number | null;
  civilian_fatalities: number | null;
  demonstration_events: number | null;
}
