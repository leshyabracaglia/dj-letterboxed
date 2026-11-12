import { useAuth } from "@clerk/expo";
import Constants from "expo-constants";
import createClient from "openapi-fetch";
import { useMemo } from "react";

import type { paths } from "./generated";
import { isWeb } from "@/lib/platform";

// In dev, point at the local API on whatever machine is serving the bundle, so
// a changed LAN IP (new wifi) never needs a .env edit. Web uses the page's own
// host; native uses the Metro host the device connected to. Production builds
// (and dev on a tunnel, where there's no reachable LAN host) fall back to
// EXPO_PUBLIC_API_URL.
function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
  if (!__DEV__) return configured;

  const host = isWeb ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host || host.endsWith(".exp.direct") || host.endsWith(".on.expo.app")) return configured;
  // The e2e suite runs its own API (on its own seeded DB) on another port.
  return `http://${host}:${process.env.EXPO_PUBLIC_DEV_API_PORT ?? "8080"}`;
}

const API_URL = resolveApiUrl();

/** A full URL for an API path, for the little openapi-fetch doesn't cover:
 * a media URL handed to a player, or a raw file upload. */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** A caught error's message to show the user, or fallback when it has none
 * (something thrown that isn't an Error, or an empty message). */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// The server's error body: `{ error: { code, message } }`.
type ErrorBody = { error?: { code?: string; message?: string } };

export function toApiError(response: Response, body: unknown): ApiError {
  const { error } = (body ?? {}) as ErrorBody;
  return new ApiError(response.status, error?.code ?? "UNKNOWN", error?.message ?? response.statusText);
}

// What a successful call resolves to: the `data` side of openapi-fetch's
// `{ data } | { error }` result.
type ResponseData<R> = R extends { data: infer D } ? D : never;

/** A call's data, typed from the spec; a failed one throws an ApiError
 * (status, the server's error code and message) instead of resolving to
 * `{ error }`, so react-query sees it as failed. */
export async function unwrap<R extends { data?: unknown; error?: unknown; response: Response }>(
  call: Promise<R>,
): Promise<ResponseData<R>> {
  const { data, error, response } = await call;
  if (!response.ok) throw toApiError(response, error);
  return data as ResponseData<R>;
}

/** The API client, signed in as the current Clerk session. */
export function useApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const client = createClient<paths>({ baseUrl: API_URL });
    client.use({
      async onRequest({ request }) {
        const token = await getToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    });
    return client;
  }, [getToken]);
}
