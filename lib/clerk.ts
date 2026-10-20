import { isClerkAPIResponseError } from "@clerk/expo";

/** What to show the user for a Clerk failure: a thrown API error, or the
 * `error` a signIn/signUp step resolves with. Prefers Clerk's user-facing
 * `longMessage`. */
export function clerkErrorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? fallback;
  }
  if (err && typeof err === "object" && "message" in err) {
    const { longMessage, message } = err as { longMessage?: string; message?: string };
    return longMessage || message || fallback;
  }
  return fallback;
}
