import type { ConflictSubtab } from '../../types';

const SUBTABS: { id: ConflictSubtab; label: string }[] = [
  { id: 'acled', label: 'ACLED' },
  { id: 'ucdp', label: 'UCDP' },
  { id: 'viina', label: 'VIINA' },
  { id: 'bellingcat', label: 'Bellingcat' },
  { id: 'acled-hdx', label: 'ACLED HDX' },
  { id: 'comparison', label: 'Comparison' },
];

interface Props {
  active: ConflictSubtab;
  onChange: (subtab: ConflictSubtab) => void;
}

export default function SubtabNavigation({ active, onChange }: Props) {
  return (
    <div className="subtab-nav">
      {SUBTABS.map((st) => (
        <button
          key={st.id}
          className={`subtab-btn ${active === st.id ? 'active' : ''}`}
          onClick={() => onChange(st.id)}
        >
          {st.label}
        </button>
      ))}
    </div>
  );
}
