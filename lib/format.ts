// rating is whole stars (1-5); averages keep one decimal.
export function formatRating(rating: number | null | undefined): string {
  if (!rating) return "—";
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

// Date-only: for when something was reviewed/seen, where the exact time isn't meaningful.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// Date+time: for an event's actual scheduled start.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
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

/** When a party ran, from its event's day/night flags. */
export function formatEventTiming(event: { isDay: boolean; isNight: boolean }): string {
  if (event.isDay && event.isNight) return "Day into night";
  return event.isDay ? "Day" : "Night";
}

/** Short day label for the zine cards: "Sat 14 Sep" (uppercased by the
 * cards' pixel type). Weekday/month names follow the device locale. */
export function formatCardDate(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${date.getDate()} ${month}`;
}
