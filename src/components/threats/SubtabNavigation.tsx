import type { ThreatsSubtab } from '../../types';

const SUBTABS: { id: ThreatsSubtab; label: string }[] = [
  { id: 'events', label: 'Threat Events' },
  { id: 'coercive', label: 'Coercive Discourse' },
  { id: 'redlines', label: 'Red Lines' },
  { id: 'varx', label: 'Escalation Index' },
];

interface Props {
  active: ThreatsSubtab;
  onChange: (subtab: ThreatsSubtab) => void;
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
