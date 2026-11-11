import * as Location from "expo-location";

import { withTimeout } from "@/lib/async";

/** Where the device is for checking in at a venue. accuracy is in meters. */
export type PreciseFix = { latitude: number; longitude: number; accuracy?: number };

/** A fix, or why there isn't one: location permission refused, location
 * turned off on the device, or no fix came in time (indoors on mobile data,
 * typically). */
export type PreciseFixError = "denied" | "services_off" | "unavailable";
export type PreciseFixResult = { fix: PreciseFix } | { error: PreciseFixError };

// GPS alone, indoors without Wi-Fi, can take a good while to settle.
const HIGH_ACCURACY_TIMEOUT_MS = 20_000;
// Cell towers and Wi-Fi answer fast; a rougher fix still beats none, and
// the server turns down one too rough to check in with (IMPRECISE_LOCATION).
const BALANCED_TIMEOUT_MS = 8_000;
// A fix from the last few minutes is still where they are tonight.
const RECENT_FIX_MAX_AGE_MS = 5 * 60 * 1000;

function toFix(position: Location.LocationObject): PreciseFix {
  const { latitude, longitude, accuracy } = position.coords;
  return { latitude, longitude, accuracy: accuracy ?? undefined };
}

async function position(accuracy: Location.Accuracy, ms: number) {
  return withTimeout(Location.getCurrentPositionAsync({ accuracy }), ms).catch(() => null);
}

/** As precise a fix as the device can give right now: a fresh high-accuracy
 * one if it comes in time, else a balanced-accuracy one, else one from the
 * last few minutes. Asks for permission the first time. */
export async function getPreciseFix(): Promise<PreciseFixResult> {
  const { granted } = await Location.requestForegroundPermissionsAsync().catch(() => ({ granted: false }));
  if (!granted) return { error: "denied" };
  const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesOn) return { error: "services_off" };

  const found =
    (await position(Location.Accuracy.High, HIGH_ACCURACY_TIMEOUT_MS)) ??
    (await position(Location.Accuracy.Balanced, BALANCED_TIMEOUT_MS)) ??
    (await Location.getLastKnownPositionAsync({ maxAge: RECENT_FIX_MAX_AGE_MS }).catch(() => null));
  return found ? { fix: toFix(found) } : { error: "unavailable" };
}
