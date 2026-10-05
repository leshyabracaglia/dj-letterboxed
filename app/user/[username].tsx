import { useAuth } from "@clerk/expo";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
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
import { FollowButton } from "../../components/FollowButton";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useCurrentUser } from "../../lib/auth";
import { useUserProfile, useUserReviews } from "../../lib/api/hooks";
import { ROUTES } from "../../lib/routes";

function UserProfileSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="primary">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <View>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-24" />
          </View>
        </View>
        <View className="mt-3 flex-row gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </View>
      </PageHeader>
      <View style={contentStyle}>
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { isSignedIn } = useAuth();
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();
  const { data: profile } = useUserProfile(username);
  const { data: reviews } = useUserReviews(username);

  if (!profile) {
    return <UserProfileSkeleton />;
  }

  const isSelf = me?.id === profile.user.id;

  return (
    <Page>
      <Stack.Screen options={{ title: `@${profile.user.username}` }} />
      <PageHeader border="primary">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar
              uri={profile.user.avatarUrl}
              name={profile.user.username}
              size={48}
            />
            <View>
              <Text className="text-2xl font-bold text-ink dark:text-paper">
                {profile.user.username}
              </Text>
            </View>
          </View>
          {!isSelf && (
            <FollowButton userId={profile.user.id} username={profile.user.username} />
          )}
        </View>
        {!!profile.user.bio && (
          <Text className="mt-2 text-ink dark:text-paper">{profile.user.bio}</Text>
        )}
        <View className="mt-3 flex-row gap-4">
          <Text className="text-muted">
            <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.reviewCount}</Text> review{profile.reviewCount === 1 ? "" : "s"}
          </Text>
          <Link href={ROUTES.USER_FOLLOWERS(profile.user.username)}>
            <Text className="text-muted">
              <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.followerCount}</Text>{" "}
              follower{profile.followerCount === 1 ? "" : "s"}
            </Text>
          </Link>
          <Link href={ROUTES.USER_FOLLOWING(profile.user.username)}>
            <Text className="text-muted">
              <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.followingCount}</Text>{" "}
              following{profile.followingCount === 1 ? "" : "s"}
            </Text>
          </Link>
        </View>
        <StatsSummary username={profile.user.username} />
        <FavoritesShowcase
          username={profile.user.username}
          isSelf={isSelf}
          ownReviews={isSelf ? (reviews?.items ?? []) : undefined}
        />
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={reviews?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={{ ...item, user: profile.user }} />}
        ListEmptyComponent={
          reviews ? <EmptyState message="No reviews yet." /> : <ReviewCardSkeleton count={3} />
        }
      />
    </Page>
  );
}
