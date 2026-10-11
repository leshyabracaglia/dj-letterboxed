import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { Tape } from "./ui";

// The gig-poster look shared by the log form's night poster and the event
// page: a cream frame around a near-black print, with concentric rings
// radiating from a "record" disc in the top right.
export const POSTER_FRAME = "bg-[#E9E2D0]";
export const POSTER_PRINT = "bg-[#0B090A]";

// Red and purple in turn, centred on the record.
const RING_RADII = [62, 80, 100, 124, 150, 180, 214, 252];
const RECORD_SIZE = 96;
const RECORD_TOP = 40;
const RECORD_RIGHT = 14;

/** Position + shape for the record disc; add the fill and contents. */
export const POSTER_RECORD_STYLE: ViewStyle = {
  position: "absolute",
  top: RECORD_TOP,
  right: RECORD_RIGHT,
  width: RECORD_SIZE,
  height: RECORD_SIZE,
  borderRadius: RECORD_SIZE / 2,
  zIndex: 1,
};

function PosterRings() {
  const cx = RECORD_RIGHT + RECORD_SIZE / 2;
  const cy = RECORD_TOP + RECORD_SIZE / 2;
  return (
    <>
      {RING_RADII.map((r, i) => (
        <View
          key={r}
          pointerEvents="none"
          style={{
            position: "absolute",
            right: cx - r,
            top: cy - r,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            borderWidth: 1,
            borderColor: i % 2 ? "rgba(185,160,240,0.4)" : "rgba(229,72,77,0.45)",
          }}
        />
      ))}
    </>
  );
}

/** The taped-up frame and ringed print; lay the poster's contents inside. */
export function Poster({ children }: { children: ReactNode }) {
  return (
    <View className={`p-3 shadow-lg shadow-black/70 ${POSTER_FRAME}`}>
      <Tape style={{ top: -10, left: 120 }} rotate={-3} />
      <View className={`overflow-hidden ${POSTER_PRINT}`}>
        <PosterRings />
        {children}
      </View>
    </View>
  );
}
