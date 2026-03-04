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

export type TabId = 'overview' | 'conflict' | 'aerial' | 'losses' | 'humanitarian' | 'events' | 'map' | 'sources';

export type ConflictSubtab = 'acled' | 'ucdp' | 'viina' | 'bellingcat' | 'comparison' | 'threats';

export type LossesSubtab = 'human' | 'equipment' | 'territory' | 'changes' | 'aid';

// Filter types for aerial tab
export type AerialAttackType = 'drones' | 'missiles';

// Filter types for equipment/losses tabs
export type OryxCountry = 'russia' | 'ukraine';
export type OryxStatus = 'destroyed' | 'captured' | 'damaged' | 'abandoned';

// Territory layer types
export type TerritoryLayerType = 'russian_advances' | 'russian_claimed' | 'ukraine_control_map' | 'ukrainian_counteroffensives' | 'partisan_warfare';

// KIU Officers data
export interface KIUOfficersSummary {
  total_officers: number;
  senior_officers: number;
  junior_officers: number;
  other: number;
}

// Event type constants for filtering
export const ACLED_EVENT_TYPES = [
  'Battles',
  'Explosions/Remote violence',
  'Protests',
  'Riots',
  'Strategic developments',
  'Violence against civilians',
] as const;

export const UCDP_VIOLENCE_TYPES = [
  { id: 1, label: 'State-based' },
  { id: 2, label: 'Non-state' },
  { id: 3, label: 'One-sided' },
] as const;

export const VIINA_EVENT_CATEGORIES = [
  'airstrike',
  'artillery',
  'UAV',
  'firefight',
  'control',
  'raid',
  'armor',
  'IED',
  'arrest',
  'hospital',
  'milcas',
  'civcas',
  'retreat',
  'property',
  'cyber',
] as const;

export const BELLINGCAT_IMPACT_TYPES = [
  'Residential',
  'Healthcare',
  'Military',
  'Industrial',
  'Commercial',
  'Cultural',
  'Religious',
  'School/childcare',
  'Roads/Transport',
  'Administrative',
  'Food Infrastructure',
  'Humanitarian',
  'Undefined',
] as const;

export type ACLEDEventType = typeof ACLED_EVENT_TYPES[number];
export type UCDPViolenceType = typeof UCDP_VIOLENCE_TYPES[number];
export type ViinaEventCategory = typeof VIINA_EVENT_CATEGORIES[number];
export type BellingcatImpactType = typeof BELLINGCAT_IMPACT_TYPES[number];

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

// VIINA additional types for time unit switching
export interface ViinaWeekly {
  week: string;
  events: number;
}

export interface ViinaWeeklyBySource {
  week: string;
  source: string;
  events: number;
}

export interface ViinaDailyBySource {
  date: string;
  source: string;
  events: number;
}

// HAPI data types
export interface HapiFoodPrice {
  month: string;
  commodity_name: string;
  commodity_category: string;
  avg_price: number;
  records: number;
}

export interface HapiIdps {
  date: string;
  oblast: string;
  idps: number;
}

export interface HapiIdpsTotal {
  date: string;
  total_idps: number;
}

export interface HapiHumanitarianNeeds {
  date: string;
  oblast: string;
  population_status: string;
  population: number;
}

export interface HapiFunding {
  date: string;
  requirements_usd: number;
  funding_usd: number;
  funding_pct: number;
}

// Category breakdown types
export interface UCDPByViolenceType {
  type_of_violence: number;
  violence_type_label: string;
  events: number;
  fatalities: number;
}

export interface UCDPMonthlyByType {
  month: string;
  type_of_violence: number;
  violence_type_label: string;
  events: number;
  fatalities: number;
}

export interface BellingcatByImpact {
  impact_type: string;
  incidents: number;
}

export interface BellingcatMonthlyByImpact {
  month: string;
  impact_type: string;
  incidents: number;
}

export interface ViinaByEventType {
  event_type: string;
  events: number;
}

export interface ViinaMonthlyByEventType {
  month: string;
  event_type: string;
  events: number;
}

// Kiel Institute aid tracking types
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

export interface KielAidDonorTimeline {
  month: string;
  donor: string;
  aid_type_general: string;
  commitments: number;
  total_eur: number;
}

// SIPRI military expenditure types
export interface SipriExpenditure {
  country: string;
  year: number;
  expenditure_usd: number;
  gdp_share: number | null;
}

// World Bank GDP data
export interface WorldBankGDP {
  country: string;
  year: number;
  gdp_current_usd: number;
}

// Aid type filter
export type AidType = 'Military' | 'Financial' | 'Humanitarian';

// Donor countries for filter — Europe (All) first, United States second, rest alphabetical
export const AID_DONORS = [
  'Europe (All)',
  'United States',
  'Australia',
  'Austria',
  'Belgium',
  'Bulgaria',
  'Canada',
  'China',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Denmark',
  'Estonia',
  'EU (Commission and Council)',
  'European Investment Bank',
  'European Peace Facility',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Iceland',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Taiwan',
  'Turkiye',
  'United Kingdom',
] as const;

// GDELT Threats data types
export interface GdeltThreatsByDirection {
  week: string;
  direction: 'rus_outbound' | 'inbound_to_rus' | 'internal_rus' | 'other';
  events: number;
  avg_goldstein: number;
  military_threats: number;
}

export interface GdeltThreatsByCountry {
  country: string;
  rus_to_country: number;
  country_to_rus: number;
  avg_goldstein_out: number;
  avg_goldstein_in: number;
}

export interface GdeltThreatsByCameo {
  cameo_code: string;
  events: number;
  avg_goldstein: number;
  label: string;
}

export interface GdeltThreatsDyadic {
  country_a: string;
  country_b: string;
  a_to_b_events: number;
  b_to_a_events: number;
  a_to_b_goldstein: number;
  b_to_a_goldstein: number;
  goldstein_asymmetry: number;
  volume_asymmetry: number;
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
}

// GDELT direction labels
export const GDELT_DIRECTION_LABELS: Record<string, string> = {
  rus_outbound: 'Russia \u2192 Others',
  inbound_to_rus: 'Others \u2192 Russia',
  internal_rus: 'Internal Russia',
  other: 'Other',
};

// GDELT threat filter types
export type GdeltDirection = 'rus_outbound' | 'inbound_to_rus' | 'internal_rus' | 'other';
