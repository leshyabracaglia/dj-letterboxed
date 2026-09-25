import { Redirect } from "expo-router";

import { ROUTES } from "../lib/routes";

// Feed itself handles both the signed-in (following/popular) and
// signed-out (popular only) cases, so home just lands there.
export default function Index() {
  return <Redirect href={ROUTES.FEED} />;
}
