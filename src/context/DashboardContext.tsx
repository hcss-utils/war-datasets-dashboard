import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { DashboardState, DashboardAction } from '../types';

const DEFAULT_START = new Date('2023-11-01');
const DEFAULT_END = new Date('2026-01-26');

const initialState: DashboardState = {
  dateRange: [DEFAULT_START, DEFAULT_END],
  fullDateRange: [DEFAULT_START, DEFAULT_END],
  selectedEvents: [],
  activeTab: 'overview',
  showInterpolation: true,
  highlightedEvent: null,
  isLoading: true,
  error: null,
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'SET_FULL_DATE_RANGE':
      return { ...state, fullDateRange: action.payload, dateRange: action.payload };
    case 'TOGGLE_EVENT': {
      const name = action.payload;
      const selected = state.selectedEvents.includes(name)
        ? state.selectedEvents.filter((e) => e !== name)
        : [...state.selectedEvents, name];
      return { ...state, selectedEvents: selected };
    }
    case 'SET_SELECTED_EVENTS':
      return { ...state, selectedEvents: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'TOGGLE_INTERPOLATION':
      return { ...state, showInterpolation: !state.showInterpolation };
    case 'SET_HIGHLIGHTED_EVENT':
      return { ...state, highlightedEvent: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface DashboardContextValue {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
