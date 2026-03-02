import { useState } from 'react';
import type { SabotageSubtab } from '../types';
import SubtabNavigation from './sabotage/SubtabNavigation';
import CyberPanel from './sabotage/CyberPanel';
import DisinfoPanel from './sabotage/DisinfoPanel';
import InfrastructurePanel from './sabotage/InfrastructurePanel';
import HybridPanel from './sabotage/HybridPanel';

export default function SabotageTab() {
  const [subtab, setSubtab] = useState<SabotageSubtab>('cyber');

  return (
    <div className="sabotage-tab">
      <h2>Sabotage &amp; Disinformation</h2>
      <p className="tab-subtitle">Cyber operations, disinformation campaigns, infrastructure sabotage, and hybrid threats</p>
      <SubtabNavigation active={subtab} onChange={setSubtab} />
      {subtab === 'cyber' && <CyberPanel />}
      {subtab === 'disinfo' && <DisinfoPanel />}
      {subtab === 'infrastructure' && <InfrastructurePanel />}
      {subtab === 'hybrid' && <HybridPanel />}
    </div>
  );
}
