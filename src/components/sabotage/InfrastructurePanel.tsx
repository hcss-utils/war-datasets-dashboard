import { useEffect, useState } from 'react';
import { loadBalticCableIncidents } from '../../data/newLoader';
import type { BalticCableIncident } from '../../types';

export default function InfrastructurePanel() {
  const [data, setData] = useState<BalticCableIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBalticCableIncidents()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><span className="loading-text">Loading infrastructure data...</span></div>;
  if (error) return <div className="error-container"><h3>Failed to load</h3><p>{error}</p></div>;

  return (
    <div>
      <h3>Infrastructure Sabotage</h3>
      <p className="tab-subtitle">Baltic undersea cable incidents — {data.length} documented cases</p>

      <div className="chart-card">
        <h3>Baltic Cable Incidents Timeline</h3>
        <div className="incidents-timeline">
          {data.map((incident) => (
            <div key={incident.id} className="incident-card">
              <div className="incident-header">
                <span className="incident-date">
                  {incident.incident_date ? new Date(incident.incident_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date'}
                </span>
                <span className="incident-name">{incident.incident_name}</span>
              </div>
              {incident.vessel_name && (
                <div className="incident-detail">
                  <strong>Vessel:</strong> {incident.vessel_name}
                  {incident.vessel_flag && <span> ({incident.vessel_flag})</span>}
                </div>
              )}
              {incident.damage_description && (
                <div className="incident-detail">
                  <strong>Damage:</strong> {incident.damage_description}
                </div>
              )}
              {incident.cables_affected && incident.cables_affected.length > 0 && (
                <div className="incident-detail">
                  <strong>Cables affected:</strong> {incident.cables_affected.join(', ')}
                </div>
              )}
              {incident.notes && (
                <div className="incident-detail incident-notes">{incident.notes}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
