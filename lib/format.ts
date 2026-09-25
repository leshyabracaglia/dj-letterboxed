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
