/**
 * Redistribute UCDP batch-reporting artifacts then apply rolling average.
 *
 * UCDP dumps fatalities onto the 1st of each month as a catch-all date
 * (avg 2,610 fatalities on day 1 vs ~105 on all other days). This function:
 * 1. Detects 1st-of-month spikes and redistributes them across the month
 * 2. Applies a centered 7-day rolling average for additional smoothing
 */
export function smoothUcdpBatchSpikes<T extends Record<string, any>>(
  data: T[],
  keys: string[],
  dateKey = 'date',
): T[] {
  if (data.length === 0) return data;

  // Step 1: Redistribute 1st-of-month spikes across their month
  const redistributed: Record<string, any>[] = data.map(d => ({ ...d }));

  // Group indices by year-month
  const monthGroups: Record<string, number[]> = {};
  redistributed.forEach((d, i) => {
    const dateStr = String(d[dateKey]);
    const ym = dateStr.slice(0, 7); // "YYYY-MM"
    if (!monthGroups[ym]) monthGroups[ym] = [];
    monthGroups[ym].push(i);
  });

  // For each month, if day-1 value is >3x the median of other days, redistribute
  for (const indices of Object.values(monthGroups)) {
    if (indices.length < 3) continue;

    // Find which index is day 1 (or close to it)
    const day1Idx = indices.find(i => {
      const dateStr = String(redistributed[i][dateKey]);
      const day = parseInt(dateStr.slice(8, 10));
      return day === 1;
    });
    if (day1Idx === undefined) continue;

    const otherIndices = indices.filter(i => i !== day1Idx);

    for (const key of keys) {
      const day1Val = redistributed[day1Idx][key] as number;
      if (day1Val == null || day1Val === 0) continue;

      // Median of non-day-1 values
      const otherVals = otherIndices.map(i => (redistributed[i][key] as number) || 0).sort((a, b) => a - b);
      const median = otherVals[Math.floor(otherVals.length / 2)];

      // Only redistribute if day-1 is >3x the median (clear batch artifact)
      if (day1Val > median * 3 && median > 0) {
        const excess = day1Val - median;
        const share = excess / indices.length;
        // Set day-1 to median, distribute excess evenly
        redistributed[day1Idx][key] = Math.round(median + share);
        for (const idx of otherIndices) {
          redistributed[idx][key] = Math.round(((redistributed[idx][key] as number) || 0) + share);
        }
      }
    }
  }

  // Step 2: Apply centered 7-day rolling average
  const half = 3;
  return redistributed.map((d, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(redistributed.length - 1, i + half);
    const count = end - start + 1;
    const smoothed: Record<string, number> = {};
    for (const key of keys) {
      let sum = 0;
      for (let j = start; j <= end; j++) {
        const v = redistributed[j][key];
        if (v != null) sum += v;
      }
      smoothed[key] = Math.round(sum / count);
    }
    return { ...d, ...smoothed } as T;
  });
}
