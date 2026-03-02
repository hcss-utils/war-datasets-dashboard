import type { SabotageSubtab } from '../../types';

const SUBTABS: { id: SabotageSubtab; label: string }[] = [
  { id: 'cyber', label: 'Cyber Incidents' },
  { id: 'disinfo', label: 'Disinformation' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'hybrid', label: 'Hybrid Events' },
];

interface Props {
  active: SabotageSubtab;
  onChange: (subtab: SabotageSubtab) => void;
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
