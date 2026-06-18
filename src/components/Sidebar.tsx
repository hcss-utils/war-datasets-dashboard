import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import DateRangeSlider from './DateRangeSlider';
import EventFilter from './EventFilter';
import { filterByDateRange, getLayerData } from '../data/processing';
import type { DailyArea, MilitaryEvent } from '../types';

interface SidebarProps {
  dailyAreas: DailyArea[];
  events: MilitaryEvent[];
}

export default function Sidebar({ dailyAreas, events }: SidebarProps) {
  const { state, dispatch } = useDashboard();

  const stats = useMemo(() => {
    const filtered = filterByDateRange(dailyAreas, state.dateRange[0], state.dateRange[1]);
    const { raw } = getLayerData(filtered, 'ukraine_control_map');
    if (raw.length === 0) return { current: 0, net: 0, avg: 0 };

    const current = raw[raw.length - 1];
    const net = raw[raw.length - 1] - raw[0];
    const days = raw.length || 1;
    const avg = (net / days) * 30;

    return {
      current: Math.round(current),
      net: Math.round(net),
      avg: Math.round(avg),
    };
  }, [dailyAreas, state.dateRange]);

  return (
    <>
      <DateRangeSlider />

      <div className="sidebar-section">
        <h3>Summary</h3>
        <div className="stats-panel">
          <div className="stat-item">
            <div className="stat-value">{stats.current.toLocaleString()}</div>
            <div className="stat-label">km² controlled</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: stats.net >= 0 ? 'var(--color-russian-gains)' : 'var(--color-ukrainian-gains)' }}>
              {stats.net >= 0 ? '+' : ''}{stats.net.toLocaleString()}
            </div>
            <div className="stat-label">net change</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.avg >= 0 ? '+' : ''}{stats.avg}</div>
            <div className="stat-label">km²/month avg</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{events.length}</div>
            <div className="stat-label">events</div>
          </div>
        </div>
      </div>

      {/* Interpolation only applies to the step-function CHARTS (Gains/Losses), not the
          polygon map — hide it on the Map tab where it has no effect. */}
      {state.activeTab !== 'map' && (
        <div className="sidebar-section">
          <div className="toggle-row">
            <label>Interpolated data</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={state.showInterpolation}
                onChange={() => dispatch({ type: 'TOGGLE_INTERPOLATION' })}
              />
              <span className="slider" />
            </div>
          </div>
        </div>
      )}

      <EventFilter events={events} />
    </>
  );
}
