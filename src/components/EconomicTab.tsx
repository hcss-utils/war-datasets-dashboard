import { useState } from 'react';
import type { EconomicSubtab } from '../types';
import SubtabNavigation from './economic/SubtabNavigation';
import EnergyPanel from './economic/EnergyPanel';
import AidSanctionsPanel from './economic/AidSanctionsPanel';
import MilitarySpendingPanel from './economic/MilitarySpendingPanel';

export default function EconomicTab() {
  const [subtab, setSubtab] = useState<EconomicSubtab>('energy');

  return (
    <div className="economic-tab">
      <h2>Economic Impact</h2>
      <p className="tab-subtitle">Energy flows, aid tracking, sanctions, and military expenditure</p>
      <SubtabNavigation active={subtab} onChange={setSubtab} />
      {subtab === 'energy' && <EnergyPanel />}
      {subtab === 'aid' && <AidSanctionsPanel />}
      {subtab === 'military' && <MilitarySpendingPanel />}
    </div>
  );
}
