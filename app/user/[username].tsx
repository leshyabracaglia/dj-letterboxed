import { useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { Button, EmptyState, Text, TornCardSeparator, usePageContentStyle } from "../../components/ui";

import { DetailPage } from "../../components/DetailPage";
import { FollowButton } from "../../components/FollowButton";
import { ModerationButton } from "../../components/ModerationSheet";
import { ProfileHeader } from "../../components/ProfileHeader";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useCurrentUser } from "../../lib/auth";
import { useBlockedUsers, useSetBlocked, useUserProfile, useUserReviews } from "../../lib/api/hooks";
import type { UserProfile } from "../../lib/api/types";

function UserProfileSkeleton() {
  const contentStyle = usePageContentStyle("roomy");
  return (
    <View style={contentStyle} className="gap-4">
      <ProfileHeader user={undefined} profile={undefined} />
      <ReviewCardSkeleton count={3} />
    </View>
  );
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const query = useUserProfile(username);

  return (
    <DetailPage
      underHeader
      query={query}
      title={(profile) => `@${profile.user.username}`}
      skeleton={<UserProfileSkeleton />}
      missing="There's no one here by that name."
    >
      {(profile) => <UserProfileList profile={profile} />}
    </DetailPage>
  );
}

function UserProfileList({ profile }: { profile: UserProfile }) {
  const contentStyle = usePageContentStyle("roomy");
  const { me } = useCurrentUser();
  const { data: reviews } = useUserReviews(profile.user.username);
  const { data: blocked } = useBlockedUsers();
  const setBlocked = useSetBlocked(profile.user.id);

  const isSelf = me?.id === profile.user.id;
  const isBlocked = !!blocked?.some((u) => u.id === profile.user.id);

  return (
    <FlatList
      contentContainerStyle={contentStyle}
      ListHeaderComponent={
        <>
          <ProfileHeader
            user={profile.user}
            profile={profile}
            action={
              !isSelf && (
                <View className="flex-row items-center gap-3">
                  <ModerationButton user={profile.user} target={{ userId: profile.user.id }} />
                  {!isBlocked && <FollowButton userId={profile.user.id} username={profile.user.username} />}
                </View>
              )
            }
          />
          <View className="h-4" />
        </>
      }
      data={isBlocked ? [] : (reviews?.items ?? [])}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => <ReviewCard review={{ ...item, user: profile.user }} index={index} />}
      ItemSeparatorComponent={TornCardSeparator}
      ListEmptyComponent={
        isBlocked ? (
          <View className="items-center gap-3 py-8">
            <Text className="text-paper/70">You&apos;ve blocked @{profile.user.username}.</Text>
            <Button onPress={() => setBlocked.mutate(false)} disabled={setBlocked.isPending} className="px-4 py-2">
              <Text className="text-paper">Unblock</Text>
            </Button>
          </View>
        ) : reviews ? (
          <View className="mt-10" >
            <EmptyState message="No reviews yet." />
          </View > 
        ) : (
          <ReviewCardSkeleton count={3} />
        )
      }
    />
  );
}
