import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import {
  Avatar,
  EmptyState,
  Page,
  PageHeader,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { FavoritesShowcase } from "../../components/FavoritesShowcase";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useUserReviews } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { ROUTES } from "../../lib/routes";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();
  const { data } = useUserReviews(me?.username);

  return (
    <Page>
      <PageHeader>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {me ? (
              <>
                <Avatar uri={me.avatarUrl} name={me.displayName ?? me.username} size={72} />
                <View>
                  <Text className="text-2xl font-bold text-ink dark:text-paper">
                    {me.displayName ?? me.username}
                  </Text>
                  <Text className="text-muted">@{me.username}</Text>
                </View>
              </>
            ) : (
              <>
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <View>
                  <Skeleton className="h-7 w-36" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </View>
              </>
            )}
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push(ROUTES.SETTINGS)}
              className="rounded-full border border-primary/25 px-3 py-2"
            >
              <Text className="text-ink dark:text-paper">Settings</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace(ROUTES.SIGN_IN);
              }}
              className="rounded-full border border-primary/25 px-3 py-2"
            >
              <Text className="text-ink dark:text-paper">Sign out</Text>
            </Pressable>
          </View>
        </View>
        {me?.bio ? <Text className="mt-2 text-ink dark:text-paper">{me.bio}</Text> : null}
        {me?.username ? <StatsSummary username={me.username} /> : null}
        {me?.username ? (
          <FavoritesShowcase username={me.username} isSelf ownReviews={data?.items ?? []} />
        ) : null}
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={{ ...item, user: me }} />}
        ListEmptyComponent={
          data ? (
            <EmptyState message="You haven't reviewed any sets yet." />
          ) : (
            <ReviewCardSkeleton count={3} />
          )
        }
      />
    </Page>
  );
}
