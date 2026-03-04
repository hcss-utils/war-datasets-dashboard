/**
 * Filter an array of data objects by a date range.
 * Handles date strings in ISO format (YYYY-MM-DD, YYYY-MM-01, YYYY-MM).
 * Skips filtering for yearly data (year as number).
 */
export function filterByDateRange<T>(
  data: T[],
  dateKey: keyof T,
  range: [Date, Date]
): T[] {
  const [start, end] = range;
  return data.filter(row => {
    const val = row[dateKey];
    if (typeof val === 'number') return true; // yearly data — don't filter
    if (typeof val !== 'string') return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return true;
    return d >= start && d <= end;
  });
}

/**
 * Format a Date to a human-readable month-year string.
 */
export function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
}

/**
 * Check if two date ranges are approximately the same (within 1 day).
 */
export function isFullRange(current: [Date, Date], full: [Date, Date]): boolean {
  const DAY = 86400000;
  return (
    Math.abs(current[0].getTime() - full[0].getTime()) < DAY &&
    Math.abs(current[1].getTime() - full[1].getTime()) < DAY
  );
}
