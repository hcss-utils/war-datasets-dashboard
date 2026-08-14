import { useEffect, useState } from 'react';
import { loadTerritoryHarmonisation, type TerritoryHarmonisation } from '../../data/newLoader';

const km2 = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function TerritoryHarmonisationPanel() {
  const [data, setData] = useState<TerritoryHarmonisation | null>(null);
  useEffect(() => { loadTerritoryHarmonisation().then(setData).catch(() => {}); }, []);
  if (!data?.headline.latestComparison) return null;
  const latest = data.headline.latestComparison;
  const availability = data.headline.availability;
  const peak = data.headline.peakKursk;
  const theatre = data.headline.latestTheatreSplit;
  return <section className="territory-harmonisation-panel">
    <div className="territory-methodology-kicker">Source harmonisation</div>
    <h3>Where DeepState and ISW agree – and where they do not</h3>
    <p className="territory-harmonisation-thesis"><strong>{pct(latest.intersection_over_union)} spatial agreement</strong> on {latest.date}, the latest common cumulative-control observation. This layer complements the existing periodization; it does not replace it.</p>
    <div className="territory-methodology-grid">
      <div><strong>{km2(latest.overlap_km2)} km²</strong><span>Both sources</span></div>
      <div><strong>{km2(latest.deepstate_only_km2)} km²</strong><span>DeepState only</span></div>
      <div><strong>{km2(latest.isw_only_km2)} km²</strong><span>ISW only</span></div>
      <div><strong>{data.headline.comparisonDates.toLocaleString()} days</strong><span>Like-for-like comparisons</span></div>
    </div>
    <div className="territory-harmonisation-availability">
      <span className="territory-harmonisation-label">Daily source availability</span>
      <div className="territory-harmonisation-availability-grid">
        <div><strong>{availability.deepstate.days.toLocaleString()} days</strong><span>DeepState</span><small>through {availability.deepstate.latestDate}</small></div>
        <div><strong>{availability.iswUkraineControl.days.toLocaleString()} days</strong><span>ISW control</span><small>through {availability.iswUkraineControl.latestDate}</small></div>
        <div><strong>{availability.iswUkraineChange.days.toLocaleString()} days</strong><span>ISW changes</span><small>through {availability.iswUkraineChange.latestDate}</small></div>
        <div><strong>{availability.iswKursk.days.toLocaleString()} days</strong><span>ISW Kursk</span><small>through {availability.iswKursk.latestDate || 'no dated layer'}</small></div>
      </div>
    </div>
    <div className="territory-harmonisation-split">
      <div>
        <span className="territory-harmonisation-label">Ukraine/Kursk separation</span>
        <strong>{peak ? `${km2(peak.ukrainian_held_inside_kursk_km2)} km²` : 'n/a'}</strong>
        <small>{peak ? `Peak Ukrainian-held geometry inside Kursk on ${peak.date}` : 'No Kursk geometry measured'}</small>
      </div>
      <div>
        <span className="territory-harmonisation-label">Current split</span>
        <strong>{theatre ? `${km2(theatre.liberated_inside_ukraine_km2)} / ${km2(theatre.ukrainian_held_inside_kursk_km2)} km²` : 'n/a'}</strong>
        <small>Inside Ukraine / inside Kursk, separated by international boundary</small>
      </div>
    </div>
    <details>
      <summary>Method, provenance, confidence, and residual boundary</summary>
      <ul className="insight-list">
        <li><strong>Comparable geometry:</strong> {data.contract.likeForLikeComparison}.</li>
        <li><strong>Availability ledger:</strong> every calendar date is retained with separate source flags; absence is represented explicitly and never forward-filled into a comparison.</li>
        <li><strong>Theatre remedy:</strong> {data.contract.theatreSeparation}.</li>
        <li><strong>Confidence:</strong> {data.contract.confidenceMeaning}; the latest comparison is <em>{latest.comparison_confidence}</em> confidence and classified <em>{latest.agreement_class.replace(/_/g, ' ')}</em>.</li>
        <li><strong>Metadata audit:</strong> {data.quality.audited_corrections.toLocaleString()} corrections are transactionally logged; {data.quality.explicit_date_rows.toLocaleString()} ISW rows have filename-explicit dates, {data.quality.message_date_rows.toLocaleString()} is resolved from an explicit authorized-message subject, and {data.quality.unverified_date_rows.toLocaleString()} remain visibly unverified.</li>
        <li><strong>Boundary:</strong> disagreement shows where source geometries differ, not which source is ground truth. Local validation remains necessary before attributing a discrepancy to battlefield movement.</li>
      </ul>
    </details>
  </section>;
}
