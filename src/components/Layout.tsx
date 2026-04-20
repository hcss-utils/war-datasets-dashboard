import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import Sidebar from './Sidebar';
import TabNavigation from './TabNavigation';
import DateRangeFilter from './DateRangeFilter';
import RelatedResources from './RelatedResources';
import type { DailyArea, MilitaryEvent } from '../types';

interface LayoutProps {
  dailyAreas: DailyArea[];
  events: MilitaryEvent[];
  children: React.ReactNode;
}

export default function Layout({ dailyAreas, events, children }: LayoutProps) {
  const { state } = useDashboard();
  const startStr = state.dateRange[0].toISOString().substring(0, 10);
  const endStr = state.dateRange[1].toISOString().substring(0, 10);

  // Only show date range and sidebar for territory-related tabs
  const showSidebar = ['territory', 'events', 'map'].includes(state.activeTab);

  return (
    <div className={`app-layout ${showSidebar ? '' : 'no-sidebar'}`}>
      <header className="app-header">
        <a href="https://hcss.nl/rubase/" target="_blank" rel="noopener noreferrer">
          <img
            src={import.meta.env.BASE_URL + 'rubase_logo.svg'}
            alt="RuBase"
            className="header-logo"
          />
        </a>
        <div className="header-center">
          <h1>Ukraine War Data Dashboard</h1>
          {showSidebar && <span className="date-display">{startStr} — {endStr}</span>}
        </div>
        <a href="https://hcss.nl/" target="_blank" rel="noopener noreferrer">
          <img
            src={import.meta.env.BASE_URL + 'hcss_logo.svg'}
            alt="HCSS"
            className="header-logo"
          />
        </a>
      </header>
      {showSidebar && (
        <aside className="app-sidebar">
          <Sidebar dailyAreas={dailyAreas} events={events} />
        </aside>
      )}
      <div className="app-main">
        <TabNavigation />
        <RelatedResources />
        <DateRangeFilter />
        <div className="tab-content">
          {children}
        </div>
      </div>
    </div>
  );
}
