import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";

import { ROUTES } from "../lib/routes";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  return <Redirect href={isSignedIn ? ROUTES.FEED : ROUTES.SIGN_IN} />;
}
