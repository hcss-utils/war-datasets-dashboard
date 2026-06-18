import { useEffect, useState } from 'react';
import TerritoryMap from './TerritoryMap';
import TerritoryComparison from './TerritoryComparison';
import { loadDeepStateMapDates } from '../../data/loader';
import type { DailyArea } from '../../types';

type MapView = 'isw' | 'deepstate' | 'comparison';

interface Props {
  dailyAreas: DailyArea[];
  iswDates: string[];
}

const TABS: { id: MapView; label: string }[] = [
  { id: 'isw', label: 'ISW' },
  { id: 'deepstate', label: 'DeepState' },
  { id: 'comparison', label: 'Comparison' },
];

export default function MapTab({ dailyAreas, iswDates }: Props) {
  const [view, setView] = useState<MapView>('isw');
  const [dsDates, setDsDates] = useState<string[]>([]);

  useEffect(() => {
    loadDeepStateMapDates().then(setDsDates).catch(() => setDsDates([]));
  }, []);

  return (
    <div className="map-tab">
      <div className="map-subtabs" role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            className={`map-subtab-btn${view === t.id ? ' active' : ''}`}
            style={{
              padding: '0.4rem 1rem', borderRadius: 6, cursor: 'pointer',
              border: view === t.id ? '1px solid #3b82f6' : '1px solid #333',
              background: view === t.id ? 'rgba(59,130,246,0.18)' : 'transparent',
              color: view === t.id ? '#dbeafe' : '#9aa4b2', fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="tab-subtitle" style={{ marginTop: 0 }}>
        {view === 'isw' && 'ISW assessed control-of-terrain (analyst, conservative; per editorial-redraw dates).'}
        {view === 'deepstate' && 'DeepState OSINT occupied territory (genuinely daily; monthly snapshots shown).'}
        {view === 'comparison' && 'How ISW and DeepState correspond, with War Mapper as a third cross-check.'}
      </p>

      {view === 'isw' && <TerritoryMap key="isw" dataset="isw" dailyAreas={dailyAreas} availableDates={iswDates} />}
      {view === 'deepstate' && (
        dsDates.length
          ? <TerritoryMap key="deepstate" dataset="deepstate" dailyAreas={dailyAreas} availableDates={dsDates} />
          : <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading DeepState snapshots…</span></div>
      )}
      {view === 'comparison' && <TerritoryComparison />}
    </div>
  );
}
