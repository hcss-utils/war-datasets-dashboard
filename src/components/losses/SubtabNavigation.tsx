import React from 'react';
import type { LossesSubtab } from '../../types';

interface SubtabNavigationProps {
  activeSubtab: LossesSubtab;
  onSubtabChange: (subtab: LossesSubtab) => void;
}

const SUBTABS: { id: LossesSubtab; label: string }[] = [
  { id: 'human', label: 'Human' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'territory', label: 'Territory' },
  { id: 'changes', label: 'Net Changes' },
  { id: 'aid', label: 'Aid & Expenditure' },
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
