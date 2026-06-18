import { useEffect, useState } from 'react';
import TerritoryMap from './TerritoryMap';
import TerritoryComparison from './TerritoryComparison';
import { loadDeepStateMapDates, loadIswMapDates } from '../../data/loader';
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
  const [iswMapDates, setIswMapDates] = useState<string[]>([]);

  useEffect(() => {
    loadDeepStateMapDates().then(setDsDates).catch(() => setDsDates([]));
    loadIswMapDates().then(setIswMapDates).catch(() => setIswMapDates([]));
  }, []);

  const iswActive = iswMapDates.length ? iswMapDates : iswDates;
  const cov = (ds: string[]) => (ds.length ? ` (${ds[0]} → ${ds[ds.length - 1]}, ${ds.length} snapshots)` : '');

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
        {view === 'isw' && `ISW assessed control-of-terrain (analyst, conservative)${cov(iswActive)}`}
        {view === 'deepstate' && `DeepState OSINT occupied territory (genuinely daily; monthly snapshots)${cov(dsDates)}`}
        {view === 'comparison' && 'How ISW and DeepState correspond, with War Mapper as a third cross-check.'}
      </p>

      {view === 'isw' && iswActive.length > 0 && (
        /* key on the date set so the map remounts when the month-end manifest finishes loading
           (otherwise it stays stuck on the initial redraw-date = old single-layer files). */
        <TerritoryMap key={`isw-${iswActive[0]}-${iswActive.length}`} dataset="isw" dailyAreas={dailyAreas} availableDates={iswActive} />
      )}
      {view === 'deepstate' && (
        dsDates.length
          ? <TerritoryMap key="deepstate" dataset="deepstate" dailyAreas={dailyAreas} availableDates={dsDates} />
          : <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading DeepState snapshots…</span></div>
      )}
      {view === 'comparison' && <TerritoryComparison />}
    </div>
  );
}
