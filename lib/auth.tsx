import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { useApi } from "./api/client";
import { queryKeys } from "./api/queryKeys";
import type { UpdateProfileInput, User } from "./api/types";

type AuthContextValue = {
  /** The signed-in user's local `users` row; undefined while signed out or still loading. */
  me: User | undefined;
  isSignedIn: boolean;
  /** Clerk has finished restoring the session. */
  isLoaded: boolean;
  /** Signed in, but `/users/me` hasn't resolved yet. */
  isLoadingMe: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Fetches /users/me once for the whole app. Must sit inside ClerkProvider and
// QueryClientProvider. Writes to queryKeys.users.me() (e.g. setQueryData after
// a profile edit) flow through here, since this is the query that owns that key.
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const signedIn = !!isSignedIn;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
    enabled: signedIn,
  });

  return (
    <AuthContext.Provider
      value={{
        // Gate on isSignedIn so a previous session's cached user never leaks
        // past sign-out.
        me: signedIn ? data : undefined,
        isSignedIn: signedIn,
        isLoaded,
        isLoadingMe: signedIn && isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside <AuthProvider>");
  return ctx;
}

// PATCH /users/me. On success the response is written straight into the
// current-user cache *before* the caller's onSuccess runs — onboarding
// navigates into (tabs) right away, and the tabs layout's onboarding gate
// reads `me` on mount; an async invalidate wouldn't land in time and would
// bounce the user back to onboarding with the stale fallback username.
export function useUpdateProfile({
  onSuccess,
  onError,
}: {
  onSuccess?: (user: User) => void;
  /** Receives a user-facing message (username-taken is mapped for you). */
  onError?: (message: string) => void;
} = {}) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<User>("/users/me", input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.users.me(), updated);
      onSuccess?.(updated);
    },
    onError: (err: any) => {
      onError?.(
        err?.code === "USERNAME_TAKEN"
          ? "That username is already taken."
          : (err?.message ?? "Could not save your profile."),
      );
    },
  });
}
