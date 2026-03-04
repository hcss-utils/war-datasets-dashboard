import React, { useEffect, useState } from 'react';
import { loadOverviewStats } from '../data/newLoader';
import type { OverviewStats } from '../types';

function formatNumber(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return n.toLocaleString();
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '';
  const startDate = new Date(start).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  const endDate = new Date(end).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  return `${startDate} – ${endDate}`;
}

export default function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverviewStats()
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to load overview data</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading overview...</span>
      </div>
    );
  }

  const { totals, date_ranges } = stats;

  return (
    <div className="overview-tab">
      <h2>Overview</h2>
      <p className="overview-subtitle">
        Comprehensive analysis of the Ukraine war across multiple data sources
      </p>

      <div className="stats-grid">
        <div className="stat-section">
          <h3>Conflict Events</h3>
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.acled_events)}</span>
              <span className="stat-label">ACLED Events</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.acled_start, date_ranges.acled_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.ucdp_events)}</span>
              <span className="stat-label">UCDP Events</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.ucdp_start, date_ranges.ucdp_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.viina_events)}</span>
              <span className="stat-label">VIINA Events</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.viina_start, date_ranges.viina_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.bellingcat_incidents)}</span>
              <span className="stat-label">Bellingcat Incidents</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.bellingcat_start, date_ranges.bellingcat_end)}</span>
            </div>
          </div>
        </div>

        <div className="stat-section">
          <h3>Aerial Assaults</h3>
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.missile_attacks)}</span>
              <span className="stat-label">Attack Waves</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.missiles_start, date_ranges.missiles_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.total_missiles_launched)}</span>
              <span className="stat-label">Missiles/Drones Launched</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.missiles_start, date_ranges.missiles_end)}</span>
            </div>
            <div className="stat-card highlight-green">
              <span className="stat-value">{formatNumber(totals.total_missiles_intercepted)}</span>
              <span className="stat-label">Intercepted</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.missiles_start, date_ranges.missiles_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {totals.total_missiles_launched > 0
                  ? ((totals.total_missiles_intercepted / totals.total_missiles_launched) * 100).toFixed(1)
                  : 0}%
              </span>
              <span className="stat-label">Intercept Rate</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.missiles_start, date_ranges.missiles_end)}</span>
            </div>
          </div>
        </div>

        <div className="stat-section">
          <h3>Russian Equipment Losses <span className="chart-source">(Ukraine MOD)</span></h3>
          <div className="stat-cards">
            <div className="stat-card highlight-red">
              <span className="stat-value">{formatNumber(totals.total_personnel)}</span>
              <span className="stat-label">Personnel</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.equipment_start, date_ranges.equipment_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.total_tanks_destroyed)}</span>
              <span className="stat-label">Tanks Destroyed</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.equipment_start, date_ranges.equipment_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.total_aircraft_destroyed)}</span>
              <span className="stat-label">Aircraft Destroyed</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.equipment_start, date_ranges.equipment_end)}</span>
            </div>
          </div>
        </div>

        <div className="stat-section">
          <h3>Civilian Casualties <span className="chart-source">(OHCHR Verified)</span></h3>
          <div className="stat-cards">
            <div className="stat-card highlight-red">
              <span className="stat-value">{formatNumber(totals.ohchr_killed)}</span>
              <span className="stat-label">Killed</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.ohchr_start, date_ranges.ohchr_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(totals.ohchr_injured)}</span>
              <span className="stat-label">Injured</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.ohchr_start, date_ranges.ohchr_end)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber((totals.ohchr_killed || 0) + (totals.ohchr_injured || 0))}</span>
              <span className="stat-label">Total Affected</span>
              <span className="stat-date-range">{formatDateRange(date_ranges.ohchr_start, date_ranges.ohchr_end)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="data-coverage">
        <h3>Data Coverage</h3>
        <table className="coverage-table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Source</th>
              <th>Start Date</th>
              <th>End Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ACLED Conflict Events</td>
              <td>Armed Conflict Location & Event Data</td>
              <td>{formatDate(date_ranges.acled_start)}</td>
              <td>{formatDate(date_ranges.acled_end)}</td>
            </tr>
            <tr>
              <td>UCDP Conflict Events</td>
              <td>Uppsala Conflict Data Program</td>
              <td>{formatDate(date_ranges.ucdp_start)}</td>
              <td>{formatDate(date_ranges.ucdp_end)}</td>
            </tr>
            <tr>
              <td>VIINA Events</td>
              <td>Violent Incident Information from News Articles</td>
              <td>{formatDate(date_ranges.viina_start)}</td>
              <td>{formatDate(date_ranges.viina_end)}</td>
            </tr>
            <tr>
              <td>Bellingcat Incidents</td>
              <td>Bellingcat Civilian Harm DB</td>
              <td>{formatDate(date_ranges.bellingcat_start)}</td>
              <td>{formatDate(date_ranges.bellingcat_end)}</td>
            </tr>
            <tr>
              <td>Equipment Losses</td>
              <td>Ukraine Ministry of Defense</td>
              <td>{formatDate(date_ranges.equipment_start)}</td>
              <td>{formatDate(date_ranges.equipment_end)}</td>
            </tr>
            <tr>
              <td>Missile/Drone Attacks</td>
              <td>Ukraine Air Force (PetroIvaniuk)</td>
              <td>{formatDate(date_ranges.missiles_start)}</td>
              <td>{formatDate(date_ranges.missiles_end)}</td>
            </tr>
            <tr>
              <td>Civilian Casualties</td>
              <td>UN OHCHR</td>
              <td>{formatDate(date_ranges.ohchr_start)}</td>
              <td>{formatDate(date_ranges.ohchr_end)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="export-timestamp">
        Data exported: {new Date(stats.export_timestamp).toLocaleString()}
      </p>
    </div>
  );
}
