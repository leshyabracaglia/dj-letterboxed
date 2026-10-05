import { router } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import {
  Avatar,
  EmptyState,
  Icon,
  Page,
  PageHeader,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { ProfileCounts } from "../../components/ProfileCounts";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useUserProfile, useUserReviews } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { ROUTES } from "../../lib/routes";

export default function ProfileScreen() {
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();
  const { data } = useUserReviews(me?.username);
  const { data: profile } = useUserProfile(me?.username);

  return (
    <Page>
      <PageHeader>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {me ? (
              <>
                <Avatar uri={me.avatarUrl} name={me.username} size={72} />
                <View>
                  <Text className="text-2xl font-bold text-ink dark:text-paper">
                    {me.username}
                  </Text>
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
          <Pressable
            onPress={() => router.push(ROUTES.SETTINGS)}
            accessibilityLabel="Settings"
            hitSlop={8}
            className="rounded-full border border-primary/25 p-2 active:opacity-80"
          >
            <Icon name="settings-outline" size={20} className="text-ink dark:text-paper" />
          </Pressable>
        </View>
        {!!me?.bio && <Text className="mt-2 text-ink dark:text-paper">{me.bio}</Text>}
        <ProfileCounts profile={profile} />
        {!!me?.username && (
          <StatsSummary username={me.username} />
        )}
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
