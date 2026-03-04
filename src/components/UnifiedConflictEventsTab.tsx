import React, { useState, useEffect } from 'react';
import type { ConflictSubtab } from '../types';
import {
  SubtabNavigation,
  ACLEDSubtab,
  UCDPSubtab,
  VIINASubtab,
  BellingcatSubtab,
  ComparisonSubtab,
  GDELTThreatsSubtab,
} from './conflict';
import { ACLED_EVENT_TYPES, GDELT_DIRECTION_LABELS } from '../types';
import type { ACLEDEventType, GdeltDirection } from '../types';

// VIINA sources from the data
const VIINA_SOURCES = [
  'liveuamap', 'ria', 'pravdaua', 'nv', 'unian', 'espreso',
  'interfaxua', '24tvua', 'liga', 'meduza', 'ntv', 'ng',
  'militarnyy', 'mz', 'forbesua', 'kp'
] as const;

type ViinaSource = typeof VIINA_SOURCES[number];

const SOURCE_LABELS: Record<string, string> = {
  'liveuamap': 'LiveUAMap',
  'ria': 'RIA (RU)',
  'pravdaua': 'Pravda (UA)',
  'nv': 'NV (UA)',
  'unian': 'UNIAN (UA)',
  'espreso': 'Espreso (UA)',
  'interfaxua': 'Interfax UA',
  '24tvua': '24TV (UA)',
  'liga': 'Liga (UA)',
  'meduza': 'Meduza',
  'ntv': 'NTV (RU)',
  'ng': 'NG (RU)',
  'militarnyy': 'Militarnyy',
  'mz': 'MZ',
  'forbesua': 'Forbes UA',
  'kp': 'KP (RU)',
};

// UCDP violence types
const UCDP_VIOLENCE_TYPES = ['State-based', 'Non-state', 'One-sided'] as const;
type UCDPViolenceType = typeof UCDP_VIOLENCE_TYPES[number];

// Bellingcat impact types (from data)
const BELLINGCAT_IMPACT_TYPES = [
  'Residential', 'Commercial', 'School or childcare', 'Roads/Highways/Transport',
  'Industrial', 'Healthcare', 'Administrative', 'Cultural', 'Undefined',
  'Religious', 'Food/Food Infrastructure', 'Humanitarian', 'Military'
] as const;
type BellingcatImpactType = typeof BELLINGCAT_IMPACT_TYPES[number];

// GDELT directions
const GDELT_DIRECTIONS: GdeltDirection[] = ['rus_outbound', 'inbound_to_rus', 'internal_rus', 'other'];

export default function UnifiedConflictEventsTab() {
  const [activeSubtab, setActiveSubtab] = useState<ConflictSubtab>('acled');

  // ACLED filters
  const [acledSelectedTypes, setAcledSelectedTypes] = useState<Set<ACLEDEventType>>(
    new Set(ACLED_EVENT_TYPES)
  );

  // VIINA filters (by source)
  const [viinaSelectedSources, setViinaSelectedSources] = useState<Set<ViinaSource>>(
    new Set(VIINA_SOURCES)
  );

  // UCDP filters (by violence type)
  const [ucdpSelectedTypes, setUcdpSelectedTypes] = useState<Set<string>>(
    new Set(UCDP_VIOLENCE_TYPES)
  );

  // Bellingcat filters (by impact type)
  const [bellingcatSelectedImpacts, setBellingcatSelectedImpacts] = useState<Set<string>>(
    new Set(BELLINGCAT_IMPACT_TYPES)
  );

  // GDELT Threats filters (by direction)
  const [gdeltSelectedDirections, setGdeltSelectedDirections] = useState<Set<GdeltDirection>>(
    new Set(GDELT_DIRECTIONS)
  );

  // Handle URL hash for deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash.startsWith('conflict-')) {
        const subtab = hash.substring(9) as ConflictSubtab;
        const validSubtabs: ConflictSubtab[] = ['acled', 'ucdp', 'viina', 'bellingcat', 'comparison', 'threats'];
        if (validSubtabs.includes(subtab)) {
          setActiveSubtab(subtab);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSubtabChange = (subtab: ConflictSubtab) => {
    setActiveSubtab(subtab);
    const newHash = `#conflict-${subtab}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  };

  // ACLED filter handlers
  const handleAcledToggle = (type: ACLEDEventType) => {
    setAcledSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  const handleAcledSelectAll = () => setAcledSelectedTypes(new Set(ACLED_EVENT_TYPES));
  const handleAcledClearAll = () => setAcledSelectedTypes(new Set());

  // VIINA filter handlers
  const handleViinaToggle = (source: ViinaSource) => {
    setViinaSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };
  const handleViinaSelectAll = () => setViinaSelectedSources(new Set(VIINA_SOURCES));
  const handleViinaClearAll = () => setViinaSelectedSources(new Set());

  // UCDP filter handlers
  const handleUcdpToggle = (type: string) => {
    setUcdpSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  const handleUcdpSelectAll = () => setUcdpSelectedTypes(new Set(UCDP_VIOLENCE_TYPES));
  const handleUcdpClearAll = () => setUcdpSelectedTypes(new Set());

  // Bellingcat filter handlers
  const handleBellingcatToggle = (impact: string) => {
    setBellingcatSelectedImpacts(prev => {
      const next = new Set(prev);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
  };
  const handleBellingcatSelectAll = () => setBellingcatSelectedImpacts(new Set(BELLINGCAT_IMPACT_TYPES));
  const handleBellingcatClearAll = () => setBellingcatSelectedImpacts(new Set());

  // GDELT filter handlers
  const handleGdeltDirectionToggle = (dir: GdeltDirection) => {
    setGdeltSelectedDirections(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  };
  const handleGdeltSelectAll = () => setGdeltSelectedDirections(new Set(GDELT_DIRECTIONS));
  const handleGdeltClearAll = () => setGdeltSelectedDirections(new Set());

  // Render sidebar based on active subtab
  const renderSidebar = () => {
    switch (activeSubtab) {
      case 'acled':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Event Types</h3>
                <div className="sidebar-actions">
                  <button onClick={handleAcledSelectAll} disabled={acledSelectedTypes.size === ACLED_EVENT_TYPES.length}>All</button>
                  <button onClick={handleAcledClearAll} disabled={acledSelectedTypes.size === 0}>None</button>
                </div>
              </div>
              <div className="filter-list">
                {ACLED_EVENT_TYPES.map(type => (
                  <label key={type} className="filter-item">
                    <input
                      type="checkbox"
                      checked={acledSelectedTypes.has(type)}
                      onChange={() => handleAcledToggle(type)}
                    />
                    <span className="filter-label">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'viina':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>News Sources</h3>
                <div className="sidebar-actions">
                  <button onClick={handleViinaSelectAll} disabled={viinaSelectedSources.size === VIINA_SOURCES.length}>All</button>
                  <button onClick={handleViinaClearAll} disabled={viinaSelectedSources.size === 0}>None</button>
                </div>
              </div>
              <div className="filter-list">
                {VIINA_SOURCES.map(source => (
                  <label key={source} className="filter-item">
                    <input
                      type="checkbox"
                      checked={viinaSelectedSources.has(source)}
                      onChange={() => handleViinaToggle(source)}
                    />
                    <span className="filter-label">{SOURCE_LABELS[source] || source}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'ucdp':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Violence Types</h3>
                <div className="sidebar-actions">
                  <button onClick={handleUcdpSelectAll} disabled={ucdpSelectedTypes.size === UCDP_VIOLENCE_TYPES.length}>All</button>
                  <button onClick={handleUcdpClearAll} disabled={ucdpSelectedTypes.size === 0}>None</button>
                </div>
              </div>
              <div className="filter-list">
                {UCDP_VIOLENCE_TYPES.map(type => (
                  <label key={type} className="filter-item">
                    <input
                      type="checkbox"
                      checked={ucdpSelectedTypes.has(type)}
                      onChange={() => handleUcdpToggle(type)}
                    />
                    <span className="filter-label">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'bellingcat':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Impact Types</h3>
                <div className="sidebar-actions">
                  <button onClick={handleBellingcatSelectAll} disabled={bellingcatSelectedImpacts.size === BELLINGCAT_IMPACT_TYPES.length}>All</button>
                  <button onClick={handleBellingcatClearAll} disabled={bellingcatSelectedImpacts.size === 0}>None</button>
                </div>
              </div>
              <div className="filter-list scrollable">
                {BELLINGCAT_IMPACT_TYPES.map(impact => (
                  <label key={impact} className="filter-item">
                    <input
                      type="checkbox"
                      checked={bellingcatSelectedImpacts.has(impact)}
                      onChange={() => handleBellingcatToggle(impact)}
                    />
                    <span className="filter-label">{impact}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'threats':
        return (
          <div className="conflict-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <h3>Direction</h3>
                <div className="sidebar-actions">
                  <button onClick={handleGdeltSelectAll} disabled={gdeltSelectedDirections.size === GDELT_DIRECTIONS.length}>All</button>
                  <button onClick={handleGdeltClearAll} disabled={gdeltSelectedDirections.size === 0}>None</button>
                </div>
              </div>
              <div className="filter-list">
                {GDELT_DIRECTIONS.map(dir => (
                  <label key={dir} className="filter-item">
                    <input
                      type="checkbox"
                      checked={gdeltSelectedDirections.has(dir)}
                      onChange={() => handleGdeltDirectionToggle(dir)}
                    />
                    <span className="filter-label">{GDELT_DIRECTION_LABELS[dir]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'comparison':
        return null; // Comparison has its own inline controls

      default:
        return null;
    }
  };

  const hasSidebar = activeSubtab !== 'comparison';

  return (
    <div className="unified-conflict-tab">
      <SubtabNavigation
        activeSubtab={activeSubtab}
        onSubtabChange={handleSubtabChange}
      />
      <div className={`conflict-layout ${hasSidebar ? 'with-sidebar' : ''}`}>
        {hasSidebar && renderSidebar()}
        <div className="subtab-content">
          {activeSubtab === 'acled' && (
            <ACLEDSubtab selectedTypes={acledSelectedTypes} />
          )}
          {activeSubtab === 'ucdp' && (
            <UCDPSubtab selectedTypes={ucdpSelectedTypes} />
          )}
          {activeSubtab === 'viina' && (
            <VIINASubtab selectedSources={viinaSelectedSources} />
          )}
          {activeSubtab === 'bellingcat' && (
            <BellingcatSubtab selectedImpacts={bellingcatSelectedImpacts} />
          )}
          {activeSubtab === 'comparison' && <ComparisonSubtab />}
          {activeSubtab === 'threats' && (
            <GDELTThreatsSubtab selectedDirections={gdeltSelectedDirections} />
          )}
        </div>
      </div>
    </div>
  );
}
