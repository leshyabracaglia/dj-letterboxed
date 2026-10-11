import * as Location from "expo-location";

import type { CurrentPlace } from "./location";

export type { CurrentPlace };

/** Web can't reverse geocode on the device, so this returns coordinates
 * only and the server looks up the city. Null if they say no or no fix
 * comes. */
export async function getCurrentPlace(): Promise<CurrentPlace | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
