import { useState } from 'react';

/**
 * Hook for click-to-isolate legend interactivity on Recharts charts.
 * Click a legend item → only that series visible. Click again → show all.
 *
 * @param groupMap Optional mapping of dataKey → groupKey for dual-pane charts
 *   where top/bottom panes share series (e.g., { acled_events: 'acled', acled_rate: 'acled' })
 */
export function useSeriesToggle(groupMap?: Record<string, string>) {
  const [isolated, setIsolated] = useState<string | null>(null);

  const getGroup = (dataKey: string) => groupMap?.[dataKey] ?? dataKey;

  const toggle = (dataKey: string) => {
    const group = getGroup(dataKey);
    setIsolated(prev => (prev === group ? null : group));
  };

  const isVisible = (dataKey: string) =>
    isolated === null || getGroup(dataKey) === isolated;

  return { isolated, toggle, isVisible };
}
