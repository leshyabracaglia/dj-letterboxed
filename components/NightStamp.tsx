import { Stamp } from "@/components/ui";
import type { Review } from "@/lib/api/types";
import { formatStampDate } from "@/lib/format";

/** A night's passport stamp: its date, "LOGGED" around the rim. Red and
 * purple alternate by day of the month, so a column of nights reads like a
 * page of stamps. */
export function NightStamp({
  review,
  size = 64,
  rotate,
}: {
  review: Pick<Review, "seenAt">;
  size?: number;
  rotate?: number;
}) {
  const [month, day] = formatStampDate(review.seenAt);
  return (
    <Stamp
      label={[month, day]}
      rim="LOGGED · BEATBOXD · "
      color={Number(day) % 2 === 0 ? "purple" : "red"}
      size={size}
      rotate={rotate}
      accessibilityLabel={`Logged ${month} ${day}`}
    />
  );
}
