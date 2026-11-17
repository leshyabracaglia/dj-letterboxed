// A ragged edge, like the app's torn paper: uneven teeth hanging off the
// bottom of a block in its color (or off its top with `side="top"`).
const TEETH =
  "M0,0 L4,3.5 L8,0 L16,6.4 L25,0 L30,6.1 L34,0 L41,9.4 L48,0 L54,7.5 L60,0 L66,4.6 L73,0 L80,6.0 L87,0 L92,4.5 L97,0 L102,5.5 L108,0 L114,8.6 L121,0 L130,8.7 L139,0 L147,8.4 L155,0 L160,5.1 L165,0 L174,9.8 L183,0 L191,8.1 L199,0 L205,4.1 L211,0 L220,6.7 L228,0 L234,3.8 L240,0 L247,6.8 L254,0 L260,5.2 L265,0 L273,5.6 L281,0 L288,9.3 L295,0 L302,7.6 L310,0 L316,9.6 L322,0 L326,9.7 L331,0 L336,5.5 L342,0 L348,6.5 L355,0 L358,3.5 L358,0Z";

export function TornEdge({ color, side = "bottom" }: { color: string; side?: "top" | "bottom" }) {
  return (
    <svg
      className={`torn torn-${side}`}
      viewBox="0 0 358 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TEETH} fill={color} />
    </svg>
  );
}
