/** Build the last-30-days date buckets (UTC, oldest first) like the Flask app. */
export function last30Days(): string[] {
  const now = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function bucketByDay(dates: (Date | string)[]): { labels: string[]; values: number[] } {
  const labels = last30Days();
  const counts: Record<string, number> = Object.fromEntries(labels.map((d) => [d, 0]));
  for (const dt of dates) {
    const key = new Date(dt).toISOString().slice(0, 10);
    if (key in counts) counts[key]++;
  }
  return { labels, values: labels.map((l) => counts[l]) };
}
