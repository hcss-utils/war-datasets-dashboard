import React from 'react';

interface EventTypeFilterPanelProps<T extends string> {
  eventTypes: readonly T[];
  selectedTypes: Set<T>;
  onToggleType: (type: T) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  label?: string;
  colorMap?: Record<T, string>;
}

export default function EventTypeFilterPanel<T extends string>({
  eventTypes,
  selectedTypes,
  onToggleType,
  onSelectAll,
  onClearAll,
  label = 'Event Types',
  colorMap,
}: EventTypeFilterPanelProps<T>) {
  const allSelected = selectedTypes.size === eventTypes.length;
  const noneSelected = selectedTypes.size === 0;

  return (
    <div className="event-filter-panel">
      <div className="filter-header">
        <span className="filter-label">{label}</span>
        <div className="filter-actions">
          <button
            className="filter-action-btn"
            onClick={onSelectAll}
            disabled={allSelected}
          >
            All
          </button>
          <button
            className="filter-action-btn"
            onClick={onClearAll}
            disabled={noneSelected}
          >
            None
          </button>
        </div>
      </div>
      <div className="filter-chips">
        {eventTypes.map((type) => {
          const isSelected = selectedTypes.has(type);
          const chipColor = colorMap?.[type];
          return (
            <button
              key={type}
              className={`filter-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggleType(type)}
              style={isSelected && chipColor ? {
                backgroundColor: chipColor,
                borderColor: chipColor,
              } : undefined}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
