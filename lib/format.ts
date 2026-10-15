/** "1 night", "3 nights". */
export function plural(n: number, word: string): string {
  return `${n} ${pluralWord(n, word)}`;
}

/** Just the word: "night" for 1, "nights" otherwise - for when the count is
 * rendered separately. */
export function pluralWord(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

// rating is whole stars (1-5); averages keep one decimal.
export function formatRating(rating: number | null | undefined): string {
  if (!rating) return "—";
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

// Date-only: for when something was reviewed/seen, where the exact time isn't meaningful.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// A calendar day as "YYYY-MM-DD" in the device's local time zone (what date
// inputs/pickers work in), and back. Local, not UTC: toISOString() would roll
// an evening in the Americas over to tomorrow.
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** When someone went, from their log's day/night flags. */
export function formatLogTiming(log: { isDay: boolean; isNight: boolean }): string {
  if (log.isDay && log.isNight) return "Day into night";
  return log.isDay ? "Day" : "Night";
}

/** Short day label for the zine cards: "Sat 14 Sep" (uppercased by the
 * cards' pixel type). Weekday/month names follow the device locale. */
export function formatCardDate(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${date.getDate()} ${month}`;
}

// How long ago, compactly ("now", "5m", "3h", "2d", "4w"), then the date.
export function formatTimeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 35) return `${Math.floor(days / 7)}w`;
  return formatDate(iso);
}
