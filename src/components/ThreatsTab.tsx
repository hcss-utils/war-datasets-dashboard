import { useState } from 'react';
import type { ThreatsSubtab } from '../types';
import SubtabNavigation from './threats/SubtabNavigation';
import ThreatEventsPanel from './threats/ThreatEventsPanel';
import CoercivePanel from './threats/CoercivePanel';
import RedLinesPanel from './threats/RedLinesPanel';
import EscalationPanel from './threats/EscalationPanel';

export default function ThreatsTab() {
  const [subtab, setSubtab] = useState<ThreatsSubtab>('events');

  return (
    <div className="threats-tab">
      <h2>Threats &amp; Rhetoric</h2>
      <p className="tab-subtitle">GDELT-based analysis of Russian threat events and media discourse</p>
      <SubtabNavigation active={subtab} onChange={setSubtab} />
      {subtab === 'events' && <ThreatEventsPanel />}
      {subtab === 'coercive' && <CoercivePanel />}
      {subtab === 'redlines' && <RedLinesPanel />}
      {subtab === 'varx' && <EscalationPanel />}
    </div>
  );
}
