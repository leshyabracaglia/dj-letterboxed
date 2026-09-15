// Matches the server-generated fallback username ("user_" + last 8 chars of
// the Clerk id) set by CreateUserFallback/UpsertUserFromClerk when a user
// hasn't chosen their own yet - see server/internal/httpapi/middleware.go
// and webhooks_handlers.go.
const FALLBACK_USERNAME_RE = /^user_[a-zA-Z0-9]{8}$/;

export function needsOnboarding(username: string | undefined | null) {
  return !!username && FALLBACK_USERNAME_RE.test(username);
}
