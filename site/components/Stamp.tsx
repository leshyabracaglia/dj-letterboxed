import { useId } from "react";

// The ten points of a five-pointed star around (50, 50), tips at radius r.
function starPoints(r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.42 : r;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(52 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

/** A rubber-stamp seal like the app's: a black disc, `rim` set around its
 * edge, an inner ring, and either `lines` of text or the logo's star in the
 * middle. `ring` is the ring and rim color. */
export function Stamp({
  lines,
  star = false,
  rim = "LOGGED · BEATBOXD · LOGGED · BEATBOXD · ",
  ring = "var(--paper)",
  size = 96,
  rotate = -8,
  label,
  className,
}: {
  lines?: string[];
  star?: boolean;
  rim?: string;
  ring?: string;
  size?: number;
  rotate?: number;
  // Read out by screen readers; leave empty for a purely decorative stamp.
  label: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const lineHeight = lines && lines.length > 1 ? 18 : 0;
  // One line fills the inner ring, shrinking so a longer one ("08·11") still
  // fits inside it (Jersey 10 runs about half an em wide).
  const longest = Math.max(1, ...(lines ?? []).map((line) => line.length));
  const fontSize = lines && lines.length > 1 ? 19 : Math.min(30, 100 / longest);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={className}
      style={{ transform: `rotate(${rotate}deg)`, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.55))" }}
    >
      <defs>
        <path id={`rim-${id}`} d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="#050405" stroke={ring} strokeWidth="2.5" />
      <text fontFamily="var(--font-display)" fontSize="10" fill={ring} letterSpacing="1.4">
        <textPath href={`#rim-${id}`}>{rim}</textPath>
      </text>
      <circle cx="50" cy="50" r="30" fill="none" stroke={ring} strokeWidth="1.5" />
      {star && <polygon points={starPoints(21)} fill="#FFFFFF" />}
      {lines?.map((line, i) => (
        <text
          key={line}
          x="50"
          y={56 + (i - (lines.length - 1) / 2) * lineHeight}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={fontSize}
          fill="#FFFFFF"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}
