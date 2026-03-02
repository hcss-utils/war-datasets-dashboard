import type { EconomicSubtab } from '../../types';

const SUBTABS: { id: EconomicSubtab; label: string }[] = [
  { id: 'energy', label: 'Energy' },
  { id: 'aid', label: 'Aid & Sanctions' },
  { id: 'military', label: 'Military Spending' },
];

interface Props {
  active: EconomicSubtab;
  onChange: (subtab: EconomicSubtab) => void;
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
