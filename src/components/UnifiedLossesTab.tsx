import React, { useState, useEffect } from 'react';
import type { LossesSubtab, TerritoryLayerType } from '../types';
import { AID_DONORS } from '../types';
import {
  SubtabNavigation,
  HumanLossesSubtab,
  EquipmentLossesSubtab,
  TerritoryLossesSubtab,
  TerritoryChangesSubtab,
  AidDeliveriesSubtab,
} from './losses';

// Human losses views
const HUMAN_VIEWS = ['cumulative', 'daily'] as const;
type HumanView = typeof HUMAN_VIEWS[number];

const HUMAN_VIEW_LABELS: Record<HumanView, string> = {
  cumulative: 'Personnel (Cumulative)',
  daily: 'Personnel (Daily)',
};

// Equipment filter options
const ORYX_COUNTRIES = ['russia', 'ukraine'] as const;

const ORYX_COUNTRY_LABELS: Record<string, string> = {
  russia: 'Russia',
  ukraine: 'Ukraine',
};

// Territory layer types
const TERRITORY_LAYERS: TerritoryLayerType[] = [
  'russian_advances',
  'russian_claimed',
  'ukraine_control_map',
  'ukrainian_counteroffensives',
  'partisan_warfare',
];

const TERRITORY_LAYER_LABELS: Record<TerritoryLayerType, string> = {
  russian_advances: 'Russian Advances',
  russian_claimed: 'Russian Claimed',
  ukraine_control_map: 'Ukrainian Control',
  ukrainian_counteroffensives: 'Ukrainian Counteroffensives',
  partisan_warfare: 'Partisan Warfare',
};

// Aid type filter
const AID_TYPES = ['Military', 'Financial', 'Humanitarian'] as const;
const AID_TYPE_LABELS: Record<string, string> = {
  Military: 'Military',
  Financial: 'Financial',
  Humanitarian: 'Humanitarian',
};

const DONOR_LABELS: Record<string, string> = {
  'EU (Commission and Council)': 'EU',
  'European Investment Bank': 'EIB',
  'European Peace Facility': 'EU Peace Facility',
};

export default function UnifiedLossesTab() {
  const [activeSubtab, setActiveSubtab] = useState<LossesSubtab>('human');

  // Human losses filters
  const [humanSelectedViews, setHumanSelectedViews] = useState<Set<HumanView>>(
    new Set(HUMAN_VIEWS)
  );

  // Equipment losses filters
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(ORYX_COUNTRIES)
  );
  // Territory filters
  const [selectedLayers, setSelectedLayers] = useState<Set<TerritoryLayerType>>(
    new Set(TERRITORY_LAYERS)
  );

  // Territory changes time unit
  const [changesTimeUnit, setChangesTimeUnit] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Aid filters
  const [selectedAidTypes, setSelectedAidTypes] = useState<Set<string>>(
    new Set(AID_TYPES)
  );
  const [selectedDonors, setSelectedDonors] = useState<Set<string>>(
    new Set(AID_DONORS)
  );

  // Handle URL hash for deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash.startsWith('losses-')) {
        const subtab = hash.substring(7) as LossesSubtab;
        const validSubtabs: LossesSubtab[] = ['human', 'equipment', 'territory', 'changes', 'aid'];
        if (validSubtabs.includes(subtab)) {
          setActiveSubtab(subtab);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSubtabChange = (subtab: LossesSubtab) => {
    setActiveSubtab(subtab);
    const newHash = `#losses-${subtab}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  };

  // Human view toggle handlers
  const handleHumanViewToggle = (view: HumanView) => {
    setHumanSelectedViews(prev => {
      const next = new Set(prev);
      if (next.has(view)) next.delete(view);
      else next.add(view);
      return next;
    });
  };

  // Equipment filter handlers
  const handleCountryToggle = (country: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  // Territory filter handlers
  const handleLayerToggle = (layer: TerritoryLayerType) => {
    setSelectedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  // Aid filter handlers
  const handleAidTypeToggle = (type: string) => {
    setSelectedAidTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleDonorToggle = (donor: string) => {
    setSelectedDonors(prev => {
      const next = new Set(prev);
      if (next.has(donor)) next.delete(donor);
      else next.add(donor);
      return next;
    });
  };


  // Render sidebar based on active subtab
  const renderSidebar = () => {
    switch (activeSubtab) {
      case 'human':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Data Views</h3>
                <div className="sidebar-actions">
                  <button
                    onClick={() => setHumanSelectedViews(new Set(HUMAN_VIEWS))}
                    disabled={humanSelectedViews.size === HUMAN_VIEWS.length}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setHumanSelectedViews(new Set())}
                    disabled={humanSelectedViews.size === 0}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="filter-list">
                {HUMAN_VIEWS.map(view => (
                  <label key={view} className="filter-item">
                    <input
                      type="checkbox"
                      checked={humanSelectedViews.has(view)}
                      onChange={() => handleHumanViewToggle(view)}
                    />
                    <span className="filter-label">{HUMAN_VIEW_LABELS[view]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'equipment':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Country</h3>
                <div className="sidebar-actions">
                  <button
                    onClick={() => setSelectedCountries(new Set(ORYX_COUNTRIES))}
                    disabled={selectedCountries.size === ORYX_COUNTRIES.length}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedCountries(new Set())}
                    disabled={selectedCountries.size === 0}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="filter-list">
                {ORYX_COUNTRIES.map(country => (
                  <label key={country} className="filter-item">
                    <input
                      type="checkbox"
                      checked={selectedCountries.has(country)}
                      onChange={() => handleCountryToggle(country)}
                    />
                    <span className="filter-label">{ORYX_COUNTRY_LABELS[country]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'territory':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Layer Types</h3>
                <div className="sidebar-actions">
                  <button
                    onClick={() => setSelectedLayers(new Set(TERRITORY_LAYERS))}
                    disabled={selectedLayers.size === TERRITORY_LAYERS.length}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedLayers(new Set())}
                    disabled={selectedLayers.size === 0}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="filter-list">
                {TERRITORY_LAYERS.map(layer => (
                  <label key={layer} className="filter-item">
                    <input
                      type="checkbox"
                      checked={selectedLayers.has(layer)}
                      onChange={() => handleLayerToggle(layer)}
                    />
                    <span className="filter-label">{TERRITORY_LAYER_LABELS[layer]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'changes':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Time Unit</h3>
              </div>
              <div className="filter-list">
                {(['daily', 'weekly', 'monthly'] as const).map(unit => (
                  <label key={unit} className="filter-item">
                    <input
                      type="radio"
                      name="timeUnit"
                      checked={changesTimeUnit === unit}
                      onChange={() => setChangesTimeUnit(unit)}
                    />
                    <span className="filter-label">
                      {unit.charAt(0).toUpperCase() + unit.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'aid':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Aid Type</h3>
                <div className="sidebar-actions">
                  <button
                    onClick={() => setSelectedAidTypes(new Set(AID_TYPES))}
                    disabled={selectedAidTypes.size === AID_TYPES.length}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedAidTypes(new Set())}
                    disabled={selectedAidTypes.size === 0}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="filter-list">
                {AID_TYPES.map(type => (
                  <label key={type} className="filter-item">
                    <input
                      type="checkbox"
                      checked={selectedAidTypes.has(type)}
                      onChange={() => handleAidTypeToggle(type)}
                    />
                    <span className="filter-label">{AID_TYPE_LABELS[type]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Donors</h3>
                <div className="sidebar-actions">
                  <button
                    onClick={() => setSelectedDonors(new Set(AID_DONORS))}
                    disabled={selectedDonors.size === AID_DONORS.length}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedDonors(new Set())}
                    disabled={selectedDonors.size === 0}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="filter-list">
                {AID_DONORS.map(donor => (
                  <label key={donor} className="filter-item">
                    <input
                      type="checkbox"
                      checked={selectedDonors.has(donor)}
                      onChange={() => handleDonorToggle(donor)}
                    />
                    <span className="filter-label">{DONOR_LABELS[donor] || donor}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="unified-conflict-tab">
      <SubtabNavigation
        activeSubtab={activeSubtab}
        onSubtabChange={handleSubtabChange}
      />
      <div className="conflict-layout with-sidebar">
        {renderSidebar()}
        <div className="subtab-content">
          {activeSubtab === 'human' && (
            <HumanLossesSubtab selectedViews={humanSelectedViews} />
          )}
          {activeSubtab === 'equipment' && (
            <EquipmentLossesSubtab
              selectedCountries={selectedCountries}
            />
          )}
          {activeSubtab === 'territory' && (
            <TerritoryLossesSubtab selectedLayers={selectedLayers} />
          )}
          {activeSubtab === 'changes' && (
            <TerritoryChangesSubtab selectedTimeUnit={changesTimeUnit} />
          )}
          {activeSubtab === 'aid' && (
            <AidDeliveriesSubtab
              selectedDonors={selectedDonors}
              selectedAidTypes={selectedAidTypes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
