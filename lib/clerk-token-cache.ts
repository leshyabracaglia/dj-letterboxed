import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Clerk's Expo token cache: SecureStore on native, a no-op on web since
// Clerk's web SDK path already persists sessions via its own storage.
export const tokenCache =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key: string) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        async saveToken(key: string, value: string) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            // ignore
          }
        },
      };
