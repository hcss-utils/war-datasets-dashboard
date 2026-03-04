import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { formatDateRange, isFullRange } from '../utils/dateFilter';

export default function DateRangeFilter() {
  const { state, dispatch } = useDashboard();
  const zoomed = !isFullRange(state.dateRange, state.fullDateRange);

  if (!zoomed) return null;

  const handleReset = () => {
    dispatch({ type: 'SET_DATE_RANGE', payload: [...state.fullDateRange] as [Date, Date] });
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime()) && d < state.dateRange[1]) {
      dispatch({ type: 'SET_DATE_RANGE', payload: [d, state.dateRange[1]] });
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime()) && d > state.dateRange[0]) {
      dispatch({ type: 'SET_DATE_RANGE', payload: [state.dateRange[0], d] });
    }
  };

  const startStr = state.dateRange[0].toISOString().substring(0, 10);
  const endStr = state.dateRange[1].toISOString().substring(0, 10);
  const minStr = state.fullDateRange[0].toISOString().substring(0, 10);
  const maxStr = state.fullDateRange[1].toISOString().substring(0, 10);

  return (
    <div className="date-range-filter">
      <span className="date-range-label">
        Zoomed: {formatDateRange(state.dateRange[0], state.dateRange[1])}
      </span>
      <div className="date-range-inputs">
        <input
          type="date"
          value={startStr}
          min={minStr}
          max={endStr}
          onChange={handleStartChange}
          className="date-input"
        />
        <span className="date-separator">to</span>
        <input
          type="date"
          value={endStr}
          min={startStr}
          max={maxStr}
          onChange={handleEndChange}
          className="date-input"
        />
      </div>
      <button className="reset-zoom-btn" onClick={handleReset}>
        Reset Zoom
      </button>
    </div>
  );
}
