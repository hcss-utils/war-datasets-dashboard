import React from 'react';
import type { ConflictSubtab } from '../../types';

interface SubtabNavigationProps {
  activeSubtab: ConflictSubtab;
  onSubtabChange: (subtab: ConflictSubtab) => void;
}

const SUBTABS: { id: ConflictSubtab; label: string }[] = [
  { id: 'acled', label: 'ACLED' },
  { id: 'ucdp', label: 'UCDP' },
  { id: 'viina', label: 'VIINA' },
  { id: 'bellingcat', label: 'Bellingcat' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'threats', label: 'GDELT Threats' },
];

export default function SubtabNavigation({ activeSubtab, onSubtabChange }: SubtabNavigationProps) {
  return (
    <nav className="subtab-nav">
      {SUBTABS.map((subtab) => (
        <button
          key={subtab.id}
          className={`subtab-btn ${activeSubtab === subtab.id ? 'active' : ''}`}
          onClick={() => onSubtabChange(subtab.id)}
        >
          {subtab.label}
        </button>
      ))}
    </nav>
  );
}
