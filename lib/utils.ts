import { Platform } from "react-native";

export const isIos =  Platform.OS === "ios";
export const isWeb =  Platform.OS === "web";

/** Resolves to the promise's value, or null if it hasn't settled within ms. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
