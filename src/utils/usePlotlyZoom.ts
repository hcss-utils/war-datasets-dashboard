import { useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { isFullRange } from './dateFilter';

/**
 * Hook that provides Plotly zoom integration with global dateRange context.
 *
 * Returns:
 * - xaxisRange: [string, string] to pass as layout.xaxis.range (or undefined if full range)
 * - onRelayout: handler to pass to Plot onRelayout prop to sync zoom to context
 */
export function usePlotlyZoom() {
  const { state, dispatch } = useDashboard();
  const zoomed = !isFullRange(state.dateRange, state.fullDateRange);

  const xaxisRange = zoomed
    ? [
        state.dateRange[0].toISOString().substring(0, 10),
        state.dateRange[1].toISOString().substring(0, 10),
      ]
    : undefined;

  const onRelayout = useCallback(
    (e: Record<string, unknown>) => {
      // Plotly fires relayout with xaxis.range[0] and xaxis.range[1] on zoom
      const r0 = e['xaxis.range[0]'] as string | undefined;
      const r1 = e['xaxis.range[1]'] as string | undefined;

      if (r0 && r1) {
        const start = new Date(r0);
        const end = new Date(r1);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dispatch({ type: 'SET_DATE_RANGE', payload: [start, end] });
        }
      }

      // Handle autorange (double-click to reset)
      if (e['xaxis.autorange'] === true) {
        dispatch({
          type: 'SET_DATE_RANGE',
          payload: [...state.fullDateRange] as [Date, Date],
        });
      }
    },
    [dispatch, state.fullDateRange]
  );

  return { xaxisRange, onRelayout, zoomed };
}
