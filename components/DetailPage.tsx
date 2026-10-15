import { Link, Stack } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import { ApiError } from "../lib/api/client";
import { ROUTES } from "../lib/routes";
import { Button, Page, Text } from "./ui";

type StackOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

/** A centered message for a page with nothing to show, with a way out:
 * "Try again" when `onRetry` is given, else a link home. */
export function MissingState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 py-16">
      <Text className="text-center font-display text-3xl uppercase text-paper">{message}</Text>
      {onRetry ? (
        <Button onPress={onRetry} className="px-5 py-2.5">
          <Text className="font-semibold text-paper">Try again</Text>
        </Button>
      ) : (
        <Link href={ROUTES.HOME}>
          <Text className="text-primary-dark">Go back home</Text>
        </Link>
      )}
    </View>
  );
}


/** The shell of a page about one thing loaded by a query (a DJ, event,
 * venue, user or review): `skeleton` while it loads, a not-found or retry
 * state if it fails - so a deleted or mistyped link never leaves the
 * skeleton up forever - and `children(data)` once it's here. `title` names
 * the stack header from the data; the rest goes to Page. */
export function DetailPage<T>({
  query,
  title,
  screenOptions,
  skeleton,
  missing,
  children,
  ...pageProps
}: {
  query: { data: T | undefined; error: unknown; refetch: () => unknown };
  title?: (data: T) => string;
  screenOptions?: StackOptions;
  skeleton: ReactNode;
  // What to say when it doesn't exist: "This DJ isn't on Beatboxd."
  missing: string;
  children: (data: T) => ReactNode;
} & Omit<ComponentProps<typeof Page>, "children" | "title">) {
  const { data, error, refetch } = query;
  const options: StackOptions = { ...screenOptions, ...(data && title ? { title: title(data) } : {}) };
  let body: ReactNode;

  if (data) body = children(data);

  else if (!error) body = skeleton;

  else if (error instanceof ApiError && error.status === 404) body = <MissingState message={missing} />;

  else body = <MissingState message="Couldn't load this page." onRetry={() => void refetch()} />;

  return (
    <Page {...pageProps}>
      <Stack.Screen options={options} />
      {body}
    </Page>
  );
}
