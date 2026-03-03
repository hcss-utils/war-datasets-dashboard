/**
 * Apply a centered 7-day rolling average to smooth batch-reporting spikes.
 * Returns a new array with the specified numeric keys smoothed.
 */
export function smooth7Day<T extends Record<string, any>>(
  data: T[],
  keys: string[],
  window = 7,
): T[] {
  const half = Math.floor(window / 2);
  return data.map((d, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    const count = end - start + 1;
    const smoothed: Record<string, number> = {};
    for (const key of keys) {
      let sum = 0;
      for (let j = start; j <= end; j++) {
        const v = data[j][key];
        if (v != null) sum += v;
      }
      smoothed[key] = Math.round(sum / count);
    }
    return { ...d, ...smoothed };
  });
}
