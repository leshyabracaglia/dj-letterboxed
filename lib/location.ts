import * as Location from "expo-location";

/** Where the person is right now: coordinates and, where the device can
 * tell, the city and region (state/province) they're in. */
export type CurrentPlace = {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
};

// A fix from the last half hour is close enough to find nights nearby, and
// returns instantly where a fresh one can take seconds indoors.
const LAST_KNOWN_MAX_AGE_MS = 30 * 60 * 1000;

/** Asks for location (the OS only prompts the first time) and resolves the
 * person's city on the device. Null if they say no or no fix comes. */
export async function getCurrentPlace(): Promise<CurrentPlace | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const { latitude, longitude } = position.coords;
  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  return {
    latitude,
    longitude,
    city: address?.city ?? address?.subregion ?? address?.district ?? undefined,
    region: address?.region ?? undefined,
  };
}

/** Where the device is, as precisely as it can tell right now: a fresh,
 * high-accuracy fix (never a cached one) for checking in at a venue.
 * accuracy is in meters. Null if they say no. */
export type PreciseFix = { latitude: number; longitude: number; accuracy?: number };

export async function getPreciseFix(): Promise<PreciseFix | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy ?? undefined };
}
