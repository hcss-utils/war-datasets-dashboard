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
} from '../types';

const BASE_PATH = import.meta.env.BASE_URL || '/';
const BUILD_TS = import.meta.env.VITE_BUILD_TS || Date.now().toString();

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE_PATH}data/${path}`.replace(/\/+/g, '/').replace(':/', '://');
  const response = await fetch(`${url}?v=${BUILD_TS}`);
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

// Additional VIINA loaders for time unit switching
import type {
  ViinaWeekly,
  ViinaWeeklyBySource,
  ViinaDailyBySource,
  HapiFoodPrice,
  HapiIdps,
  HapiIdpsTotal,
  HapiHumanitarianNeeds,
  HapiFunding,
} from '../types';

export const loadViinaWeekly = () => fetchJson<ViinaWeekly[]>('viina_weekly.json');
export const loadViinaWeeklyBySource = () => fetchJson<ViinaWeeklyBySource[]>('viina_weekly_by_source.json');
export const loadViinaDailyBySource = () => fetchJson<ViinaDailyBySource[]>('viina_daily_by_source.json');

// HAPI loaders
export const loadHapiFoodPrices = () => fetchJson<HapiFoodPrice[]>('hapi_food_prices.json');
export const loadHapiIdps = () => fetchJson<HapiIdps[]>('hapi_idps.json');
export const loadHapiIdpsTotal = () => fetchJson<HapiIdpsTotal[]>('hapi_idps_total.json');
export const loadHapiHumanitarianNeeds = () => fetchJson<HapiHumanitarianNeeds[]>('hapi_humanitarian_needs.json');
export const loadHapiFunding = () => fetchJson<HapiFunding[]>('hapi_funding.json');

// Category breakdown loaders
import type {
  UCDPByViolenceType,
  UCDPMonthlyByType,
  BellingcatByImpact,
  BellingcatMonthlyByImpact,
  ViinaByEventType,
  ViinaMonthlyByEventType,
  KIUOfficersSummary,
  DailyArea,
} from '../types';

export const loadUCDPByViolenceType = () => fetchJson<UCDPByViolenceType[]>('ucdp_by_violence_type.json');
export const loadUCDPMonthlyByType = () => fetchJson<UCDPMonthlyByType[]>('ucdp_monthly_by_type.json');
export const loadBellingcatByImpact = () => fetchJson<BellingcatByImpact[]>('bellingcat_by_impact.json');
export const loadBellingcatMonthlyByImpact = () => fetchJson<BellingcatMonthlyByImpact[]>('bellingcat_monthly_by_impact.json');
export const loadViinaByEventType = () => fetchJson<ViinaByEventType[]>('viina_by_event_type.json');
export const loadViinaMonthlyByEventType = () => fetchJson<ViinaMonthlyByEventType[]>('viina_monthly_by_event_type.json');

// Losses tab loaders
export const loadKIUOfficersSummary = () => fetchJson<KIUOfficersSummary>('kiu_officers_summary.json');
export const loadDailyAreas = () => fetchJson<DailyArea[]>('daily_areas.json');

// Kaggle missile data loaders
export interface KaggleMissileDaily {
  date: string;
  drones_launched: number;
  drones_destroyed: number;
  missiles_launched: number;
  missiles_destroyed: number;
  total_launched: number;
  total_destroyed: number;
}

export interface KaggleMissileWeapon {
  model: string;
  is_drone: boolean;
  total_launched: number;
  total_destroyed: number;
  intercept_rate: number;
}

export const loadKaggleMissileDaily = () => fetchJson<KaggleMissileDaily[]>('kaggle_missile_daily.json');
export const loadKaggleMissileWeapons = () => fetchJson<KaggleMissileWeapon[]>('kaggle_missile_weapons.json');

// Oryx data loaders
export interface OryxEquipmentDaily {
  date: string;
  country: string;
  status: string;
  category: string;
  count: number;
}

export interface OryxByCategory {
  category: string;
  russia_total: number;
  ukraine_total: number;
}

export const loadOryxEquipmentDaily = () => fetchJson<OryxEquipmentDaily[]>('oryx_equipment_daily.json');
export const loadOryxByCategory = () => fetchJson<OryxByCategory[]>('oryx_by_category.json');

// UkrDailyUpdate data loaders
export interface UkrDailyUpdateIncident {
  date: string;
  equipment_type: string;
  count: number;
  description: string;
}

export interface UkrDailyUpdateByType {
  equipment_type: string;
  total: number;
}

export const loadUkrDailyUpdateIncidents = () => fetchJson<UkrDailyUpdateIncident[]>('ukrdailyupdate_incidents.json');
export const loadUkrDailyUpdateByType = async (): Promise<UkrDailyUpdateByType[]> => {
  const raw = await fetchJson<{ Type: string; count: number }[]>('ukrdailyupdate_by_type.json');
  return raw.map(d => ({ equipment_type: d.Type, total: d.count }));
};

// Kiel aid & SIPRI loaders
import type { KielAidByDonor, KielAidTimeline, KielAidDonorTimeline, SipriExpenditure, WorldBankGDP } from '../types';
export const loadKielAidByDonor = () => fetchJson<KielAidByDonor[]>('kiel_aid_by_donor.json');
export const loadKielAidTimeline = () => fetchJson<KielAidTimeline[]>('kiel_aid_timeline.json');
export const loadKielAidDonorTimeline = () => fetchJson<KielAidDonorTimeline[]>('kiel_aid_donor_timeline.json');
export const loadSipriExpenditure = () => fetchJson<SipriExpenditure[]>('sipri_expenditure.json');
export const loadWorldBankGDP = () => fetchJson<WorldBankGDP[]>('world_bank_gdp.json');

// GDELT Threats loaders
import type {
  GdeltThreatsByDirection,
  GdeltThreatsByCountry,
  GdeltThreatsByCameo,
  GdeltThreatsDyadic,
  GdeltVarxWeekly,
} from '../types';
export const loadGdeltThreatsByDirection = () => fetchJson<GdeltThreatsByDirection[]>('gdelt_threats_by_direction.json');
export const loadGdeltThreatsByCountry = () => fetchJson<GdeltThreatsByCountry[]>('gdelt_threats_by_country.json');
export const loadGdeltThreatsByCameo = () => fetchJson<GdeltThreatsByCameo[]>('gdelt_threats_by_cameo.json');
export const loadGdeltThreatsDyadic = () => fetchJson<GdeltThreatsDyadic[]>('gdelt_threats_dyadic.json');
export const loadGdeltVarxWeekly = () => fetchJson<GdeltVarxWeekly[]>('gdelt_varx_weekly.json');
