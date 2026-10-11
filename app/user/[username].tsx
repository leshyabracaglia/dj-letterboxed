import { useAuth } from "@clerk/expo";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { EmptyState, Page, usePageContentStyle } from "../../components/ui";

import { FollowButton } from "../../components/FollowButton";
import { ProfileHeader } from "../../components/ProfileHeader";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useCurrentUser } from "../../lib/auth";
import { useUserProfile, useUserReviews } from "../../lib/api/hooks";

function UserProfileSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page underHeader>
      <View style={{ ...contentStyle, paddingTop: 0 }}>
        <ProfileHeader user={undefined} profile={undefined} />
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
    <Page underHeader>
      <Stack.Screen options={{ title: `@${profile.user.username}` }} />
      <FlatList
        contentContainerStyle={{ ...contentStyle, paddingTop: 0 }}
        ListHeaderComponent={
          <ProfileHeader
            user={profile.user}
            profile={profile}
            action={!isSelf && <FollowButton userId={profile.user.id} username={profile.user.username} />}
          />
        }
        data={reviews?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ReviewCard review={{ ...item, user: profile.user }} index={index} />}
        ListEmptyComponent={reviews ? <EmptyState message="No reviews yet." /> : <ReviewCardSkeleton count={3} />}
      />
    </Page>
  );
}
