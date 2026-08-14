import { useEffect, useState } from 'react';
import { loadTerritoryMethodology, type TerritoryMethodology } from '../../data/newLoader';

export default function TerritoryMethodologyAlert() {
  const [m, setM] = useState<TerritoryMethodology | null>(null);
  useEffect(() => { loadTerritoryMethodology().then(setM).catch(() => {}); }, []);
  if (!m) return null;
  return <div className="territory-methodology-alert">
    <div className="territory-methodology-kicker">Methodological finding</div>
    <h3>Near-daily files do not mean usable territorial coverage</h3>
    <p><strong>Do not infer trends from {m.blackout.start} through {m.blackout.end}.</strong> DeepState has {m.deepStateV2.distinctDates.toLocaleString()} dates across {m.deepStateV2.spanDays.toLocaleString()} calendar days ({m.deepStateV2.coveragePct.toFixed(2)}% date coverage), yet its active occupied geometry loses {m.blackout.apparentLossKm2.toLocaleString()} km² in one day and restores {m.blackout.apparentGainKm2.toLocaleString()} km² over the blackout's closing jump. Those are map-content discontinuities, not battlefield movement.</p>
    <div className="territory-methodology-grid">
      <div><strong>{m.blackout.durationDays} days</strong><span>Excluded trend interval</span></div>
      <div><strong>−{m.blackout.apparentLossKm2.toLocaleString()} km²</strong><span>Apparent 23–24 Apr loss</span></div>
      <div><strong>+{m.blackout.apparentGainKm2.toLocaleString()} km²</strong><span>Apparent 23–25 Sep restoration</span></div>
      <div><strong>{m.deepStateV2.featureRows.toLocaleString()}</strong><span>Rows in deepstate_v2</span></div>
    </div>
    <details>
      <summary>Evidence, database comparison, and analytical rule</summary>
      <ul className="insight-list">
        <li><strong>Summer trough:</strong> {m.blackout.summerCheckpoints.map(x => `${x.date}: ${x.occupiedKm2.toLocaleString()} km²`).join(' · ')}.</li>
        <li><strong>Hryhorii's richer schema:</strong> <code>deepstate_v2</code> contains {m.deepStateV2.featureRows.toLocaleString()} feature rows on {m.deepStateV2.distinctDates.toLocaleString()} dates, with raw properties and explicit control status. Our legacy polygon table contains {m.legacy.polygonRows.toLocaleString()} rows on only {m.legacy.polygonDates} dates; its aggregate territory table has {m.legacy.territoryRows.toLocaleString()} rows on {m.legacy.territoryDates} dates.</li>
        <li><strong>What the comparison reveals:</strong> the older aggregate includes both wartime occupied and pre-2022 occupied territory, while <code>deepstate_v2.deepstate_territory</code> deliberately isolates <code>control_status='occupied'</code>. They are complementary semantic products, not interchangeable duplicates.</li>
        <li><strong>ISW complement:</strong> the server currently holds {m.isw.metadataRows.toLocaleString()} imported ISW layer files through {m.isw.latestLayerDate}; the Gmail backfill extends this archive but must be independently checked before it is used to fill the blackout.</li>
        <li><strong>Rule:</strong> {m.rule}</li>
      </ul>
    </details>
  </div>;
}
