// ratingHalfStars is stored in half-star units (1-10); divide by 2 for the 0.5-5.0 display scale.
export function formatStars(halfStars: number | null | undefined): string {
  return halfStars ? (halfStars / 2).toFixed(1) : "—";
}

// Date-only: for when something was logged/seen, where the exact time isn't meaningful.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// Date+time: for an event's actual scheduled start.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
