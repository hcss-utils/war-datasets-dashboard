import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import Sidebar from './Sidebar';
import TabNavigation from './TabNavigation';
import DateRangeFilter from './DateRangeFilter';
import RelatedResources from './RelatedResources';
import RuBaseHeader, { DASH_LOGOS } from './RuBaseHeader';
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

  // Robust, responsive layout: the header self-sizes at the top (sticky), and the
  // body fills whatever height remains — no hardcoded header height, so it stays
  // correct when the header wraps on tablet/mobile.
  return (
    <div className="app-shell">
      <RuBaseHeader
        title="Russia-Ukraine War"
        subtitle={showSidebar ? `${startStr} – ${endStr}` : undefined}
        logos={DASH_LOGOS}
        assetPrefix={import.meta.env.BASE_URL}
      />
      <div className={`app-body ${showSidebar ? '' : 'no-sidebar'}`}>
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
    </div>
  );
}
