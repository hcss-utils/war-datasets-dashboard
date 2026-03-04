import { useDashboard } from '../context/DashboardContext';
import type { TabId } from '../types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'conflict', label: 'Conflict Events' },
  { id: 'aerial', label: 'Aerial Assaults' },
  { id: 'losses', label: 'Gains/Losses' },
  { id: 'humanitarian', label: 'Humanitarian' },
  { id: 'events', label: 'Military Events' },
  { id: 'map', label: 'Map' },
  { id: 'sources', label: 'Sources' },
];

export default function TabNavigation() {
  const { state, dispatch } = useDashboard();

  return (
    <nav className="tab-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn ${state.activeTab === tab.id ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
