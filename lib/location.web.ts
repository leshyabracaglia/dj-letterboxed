import * as Location from "expo-location";

import type { CurrentPlace, PreciseFix } from "./location";

export type { CurrentPlace, PreciseFix };

/** Web can't reverse geocode on the device, so this returns coordinates
 * only and the server looks up the city. Null if they say no or no fix
 * comes. */
export async function getCurrentPlace(): Promise<CurrentPlace | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

/** A fresh, high-accuracy fix for checking in at a venue (see location.ts). */
export async function getPreciseFix(): Promise<PreciseFix | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy ?? undefined };
}
