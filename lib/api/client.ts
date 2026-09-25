import { useAuth } from "@clerk/expo";
import Constants from "expo-constants";
import { useMemo } from "react";
import { Platform } from "react-native";

// In dev, point at the local API on whatever machine is serving the bundle, so
// a changed LAN IP (new wifi) never needs a .env edit. Web uses the page's own
// host; native uses the Metro host the device connected to. Production builds
// (and dev on a tunnel, where there's no reachable LAN host) fall back to
// EXPO_PUBLIC_API_URL.
function resolveApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
  if (!__DEV__) return configured;

  const host =
    Platform.OS === "web"
      ? globalThis.location?.hostname
      : Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host || host.endsWith(".exp.direct")) return configured;
  return `http://${host}:8080`;
}

const API_URL = resolveApiUrl();

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Params = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: Params) {
  const url = new URL(API_URL + "/api" + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  getToken: () => Promise<string | null>,
  opts?: { params?: Params; body?: unknown },
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, opts?.params), {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const data = await res.json();
      code = data?.error?.code ?? code;
      message = data?.error?.message ?? message;
    } catch {
      // response body wasn't JSON - fall back to statusText above
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ApiClient = {
  get<T>(path: string, params?: Params): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string, body?: unknown): Promise<T>;
};

/** Thin fetch wrapper: base URL (+ "/api" prefix) + Clerk bearer token, replacing hooks/trpc.ts. Call paths omit "/api". */
export function useApi(): ApiClient {
  const { getToken } = useAuth();

  return useMemo(
    () => ({
      get: <T,>(path: string, params?: Params) => request<T>("GET", path, getToken, { params }),
      post: <T,>(path: string, body?: unknown) => request<T>("POST", path, getToken, { body }),
      patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, getToken, { body }),
      del: <T,>(path: string, body?: unknown) => request<T>("DELETE", path, getToken, { body }),
    }),
    [getToken],
  );
}
