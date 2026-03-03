import { useState } from 'react';
import type { ConflictSubtab } from '../types';
import SubtabNavigation from './conflict/SubtabNavigation';
import AcledPanel from './conflict/AcledPanel';
import UcdpPanel from './conflict/UcdpPanel';
import ConflictEventsTab from './ConflictEventsTab';
import ViinaTab from './ViinaTab';
import BellingcatTab from './BellingcatTab';
import AcledHdxPanel from './conflict/AcledHdxPanel';

export default function UnifiedConflictEventsTab({ initialSubtab }: { initialSubtab?: ConflictSubtab }) {
  const [subtab, setSubtab] = useState<ConflictSubtab>(initialSubtab || 'comparison');

  return (
    <div className="unified-conflict-tab">
      <h2>Conflict Events</h2>
      <p className="tab-subtitle">Multi-source conflict event analysis</p>
      <SubtabNavigation active={subtab} onChange={setSubtab} />
      {subtab === 'acled' && <AcledPanel />}
      {subtab === 'ucdp' && <UcdpPanel />}
      {subtab === 'viina' && <ViinaTab />}
      {subtab === 'bellingcat' && <BellingcatTab />}
      {subtab === 'acled-hdx' && <AcledHdxPanel />}
      {subtab === 'comparison' && <ConflictEventsTab />}
    </div>
  );
}
