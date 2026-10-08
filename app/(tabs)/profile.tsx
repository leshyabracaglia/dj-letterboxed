import { router } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { EmptyState, Icon, Page, usePageContentStyle } from "../../components/ui";
import { ProfileHeader } from "../../components/ProfileHeader";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
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
      <ProfileHeader
        user={me}
        profile={profile}
        channel="CH 04 · Profile"
        action={
          <Pressable
            onPress={() => router.push(ROUTES.SETTINGS)}
            accessibilityLabel="Settings"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-xl bg-black/85 active:opacity-80"
          >
            <Icon name="settings-outline" size={20} className="text-paper" />
          </Pressable>
        }
      />
      <FlatList
        contentContainerStyle={contentStyle}
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ReviewCard review={{ ...item, user: me }} index={index} />}
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
