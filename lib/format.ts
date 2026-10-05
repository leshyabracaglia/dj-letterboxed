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
