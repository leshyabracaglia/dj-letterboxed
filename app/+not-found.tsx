import { Link, Stack } from "expo-router";

import { Page, Text } from "../components/ui";
import { ROUTES } from "../lib/routes";

export default function NotFoundScreen() {
  return (
    <Page className="items-center justify-center px-6">
      <Stack.Screen options={{ title: "Not found" }} />
      <Text className="mb-3 text-xl font-semibold text-ink dark:text-paper">This page doesn't exist.</Text>
      <Link href={ROUTES.HOME}>
        <Text className="text-primary dark:text-primary-dark">Go back home</Text>
      </Link>
    </Page>
  );
}
