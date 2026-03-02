import type {
  OverviewStats,
  DailyEvent,
  EventByType,
  EventByRegion,
  MonthlyEventData,
  MissileAttack,
  DailyAerialThreat,
  WeaponTypeSummary,
  EquipmentDaily,
  PersonnelDaily,
  CasualtyData,
  RefugeeByCountry,
  RefugeeTotals,
  ViinaDaily,
  ViinaMonthly,
  ViinaBySource,
  ViinaByOblast,
  ViinaMonthlyBySource,
  BellingcatDaily,
  BellingcatMonthly,
  BellingcatIncident,
  GdeltEventsDaily,
  GdeltEventsMonthly,
  GdeltEventsByTarget,
  GdeltGoldstein,
  GdeltCoerciveDaily,
  GdeltCoerciveMonthly,
  GdeltCoerciveSource,
  GdeltRedlinesMonthly,
  GdeltRedlinesSource,
  GdeltVarxWeekly,
  EnergyGasFlow,
  EnergyFossilRevenue,
  KielAidByDonor,
  KielAidTimeline,
  SanctionsEuSummary,
  SanctionsEuTimeline,
  SipriExpenditure,
  CyberIncidentTimeline,
  CyberIncidentByCountry,
  DisinfoMonthly,
  DisinfoByLanguage,
  BalticCableIncident,
  LeidenHybridEvent,
  AcledHdxMonthly,
  AcledHdxByRegion,
} from '../types';

const BASE_PATH = import.meta.env.BASE_URL || '/';

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE_PATH}data/${path}`.replace(/\/+/g, '/').replace(':/', '://');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const loadOverviewStats = () => fetchJson<OverviewStats>('overview_stats.json');
export const loadDailyEvents = () => fetchJson<DailyEvent[]>('daily_events.json');
export const loadEventsByType = () => fetchJson<EventByType[]>('events_by_type.json');
export const loadEventsByRegion = () => fetchJson<EventByRegion[]>('events_by_region.json');
export const loadMonthlyEvents = () => fetchJson<MonthlyEventData[]>('monthly_events.json');
export const loadMissileAttacks = () => fetchJson<MissileAttack[]>('missile_attacks_full.json');
export const loadDailyAerialThreats = () => fetchJson<DailyAerialThreat[]>('daily_aerial_threats.json');
export const loadWeaponTypes = () => fetchJson<WeaponTypeSummary[]>('weapon_types_summary.json');
export const loadEquipmentDaily = () => fetchJson<EquipmentDaily[]>('equipment_daily.json');
export const loadPersonnelDaily = () => fetchJson<PersonnelDaily[]>('personnel_daily.json');
export const loadCasualties = () => fetchJson<CasualtyData[]>('casualties_ohchr.json');
export const loadRefugeesByCountry = () => fetchJson<RefugeeByCountry[]>('refugees_by_country.json');
export const loadRefugeeTotals = () => fetchJson<RefugeeTotals[]>('refugee_totals.json');

// VIINA loaders
export const loadViinaDaily = () => fetchJson<ViinaDaily[]>('viina_daily.json');
export const loadViinaMonthly = () => fetchJson<ViinaMonthly[]>('viina_monthly.json');
export const loadViinaBySource = () => fetchJson<ViinaBySource[]>('viina_by_source.json');
export const loadViinaByOblast = () => fetchJson<ViinaByOblast[]>('viina_by_oblast.json');
export const loadViinaMonthlyBySource = () => fetchJson<ViinaMonthlyBySource[]>('viina_monthly_by_source.json');

// Bellingcat loaders
export const loadBellingcatDaily = () => fetchJson<BellingcatDaily[]>('bellingcat_daily.json');
export const loadBellingcatMonthly = () => fetchJson<BellingcatMonthly[]>('bellingcat_monthly.json');
export const loadBellingcatIncidents = () => fetchJson<BellingcatIncident[]>('bellingcat_incidents.json');

// GDELT loaders
export const loadGdeltEventsDaily = () => fetchJson<GdeltEventsDaily[]>('gdelt_events_daily.json');
export const loadGdeltEventsMonthly = () => fetchJson<GdeltEventsMonthly[]>('gdelt_events_monthly.json');
export const loadGdeltEventsByTarget = () => fetchJson<GdeltEventsByTarget[]>('gdelt_events_by_target.json');
export const loadGdeltGoldstein = () => fetchJson<GdeltGoldstein[]>('gdelt_goldstein.json');
export const loadGdeltCoerciveDaily = () => fetchJson<GdeltCoerciveDaily[]>('gdelt_coercive_daily.json');
export const loadGdeltCoerciveMonthly = () => fetchJson<GdeltCoerciveMonthly[]>('gdelt_coercive_monthly.json');
export const loadGdeltCoerciveSources = () => fetchJson<GdeltCoerciveSource[]>('gdelt_coercive_sources.json');
export const loadGdeltRedlinesMonthly = () => fetchJson<GdeltRedlinesMonthly[]>('gdelt_redlines_monthly.json');
export const loadGdeltRedlinesSources = () => fetchJson<GdeltRedlinesSource[]>('gdelt_redlines_sources.json');
export const loadGdeltVarxWeekly = () => fetchJson<GdeltVarxWeekly[]>('gdelt_varx_weekly.json');

// Economic loaders
export const loadEnergyGasFlows = () => fetchJson<EnergyGasFlow[]>('energy_gas_flows.json');
export const loadEnergyFossilRevenue = () => fetchJson<EnergyFossilRevenue[]>('energy_fossil_revenue.json');
export const loadKielAidByDonor = () => fetchJson<KielAidByDonor[]>('kiel_aid_by_donor.json');
export const loadKielAidTimeline = () => fetchJson<KielAidTimeline[]>('kiel_aid_timeline.json');
export const loadSanctionsEuSummary = () => fetchJson<SanctionsEuSummary[]>('sanctions_eu_summary.json');
export const loadSanctionsEuTimeline = () => fetchJson<SanctionsEuTimeline[]>('sanctions_eu_timeline.json');
export const loadSipriExpenditure = () => fetchJson<SipriExpenditure[]>('sipri_expenditure.json');

// Sabotage & Disinfo loaders
export const loadCyberIncidentsTimeline = () => fetchJson<CyberIncidentTimeline[]>('cyber_incidents_timeline.json');
export const loadCyberIncidentsByCountry = () => fetchJson<CyberIncidentByCountry[]>('cyber_incidents_by_country.json');
export const loadDisinfoMonthly = () => fetchJson<DisinfoMonthly[]>('disinfo_monthly.json');
export const loadDisinfoByLanguage = () => fetchJson<DisinfoByLanguage[]>('disinfo_by_language.json');
export const loadBalticCableIncidents = () => fetchJson<BalticCableIncident[]>('baltic_cable_incidents.json');
export const loadLeidenHybridEvents = () => fetchJson<LeidenHybridEvent[]>('leiden_hybrid_events.json');

// ACLED HDX loaders
export const loadAcledHdxMonthly = () => fetchJson<AcledHdxMonthly[]>('acled_hdx_monthly.json');
export const loadAcledHdxByRegion = () => fetchJson<AcledHdxByRegion[]>('acled_hdx_by_region.json');
