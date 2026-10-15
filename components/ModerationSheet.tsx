import { useAuth } from "@clerk/expo";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Icon, type IconName, Sheet, Text } from "./ui";
import { useApi } from "../lib/api/client";
import { useBlockedUsers, useSetBlocked } from "../lib/api/hooks";
import type { CreateReportInput, ReportReason, User } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

type ReportTarget = { reviewId: string } | { commentId: string } | { userId: string };

const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
  { reason: "spam", label: "Spam" },
  { reason: "harassment", label: "Harassment or bullying" },
  { reason: "hate", label: "Hate speech" },
  { reason: "sexual", label: "Sexual content" },
  { reason: "violence", label: "Violence or threats" },
  { reason: "other", label: "Something else" },
];

function Row({
  icon,
  title,
  pending = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  pending?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      className="flex-row items-center gap-3 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20"
    >
      <View className="w-8 items-center">
        {pending ? (
          <ActivityIndicator size="small" color="#F6F6F9" />
        ) : (
          <Icon name={icon} size={20} className="text-paper/80" />
        )}
      </View>
      <Text className="flex-1 text-paper">{title}</Text>
    </Pressable>
  );
}

const MODERATION_STEPS = {
  MENU: "menu",
  REASONS: "reasons",
  REPORTED: "reported",
  BLOCKED: "blocked",
};

type ModerationStep = (typeof MODERATION_STEPS)[keyof typeof MODERATION_STEPS];

/** Report something `user` posted (or `user` themself) and block or unblock
 * them, as a bottom sheet: the App Store's moderation requirement for apps
 * with user posts. */
function ModerationSheet({ user, target, onClose }: { user: User; target: ReportTarget; onClose: () => void }) {
  const api = useApi();
  const [moderationStep, setModerationStep] = useState<ModerationStep>(MODERATION_STEPS.MENU);
  const { data: blocked } = useBlockedUsers();
  const isBlocked = !!blocked?.some((u) => u.id === user.id);
  const setBlocked = useSetBlocked(user.id);
  const report = useMutation({
    mutationFn: (reason: ReportReason) => api.post("/reports", { ...target, reason } satisfies CreateReportInput),
    onSuccess: () => setModerationStep(MODERATION_STEPS.REPORTED),
  });

  const block = () => setBlocked.mutate(true, { onSuccess: () => setModerationStep(MODERATION_STEPS.BLOCKED) });
  const blockRow = !isBlocked && (
    <Row icon="ban-outline" title={`Block @${user.username}`} pending={setBlocked.isPending} onPress={block} />
  );
  const error = report.error ?? setBlocked.error;

  return (
    <Sheet
      title={moderationStep === MODERATION_STEPS.REASONS ? "Why report this?" : `@${user.username}`}
      onClose={onClose}
    >
      {moderationStep === MODERATION_STEPS.MENU && (
        <>
          <Row icon="flag-outline" title="Report" onPress={() => setModerationStep(MODERATION_STEPS.REASONS)} />
          {isBlocked ? (
            <Row
              icon="checkmark-circle-outline"
              title={`Unblock @${user.username}`}
              pending={setBlocked.isPending}
              onPress={() => setBlocked.mutate(false, { onSuccess: onClose })}
            />
          ) : (
            blockRow
          )}
        </>
      )}
      {moderationStep === MODERATION_STEPS.REASONS &&
        REPORT_REASONS.map(({ reason, label }) => (
          <Row
            key={reason}
            icon="flag-outline"
            title={label}
            pending={report.isPending && report.variables === reason}
            onPress={() => report.mutate(reason)}
          />
        ))}
      {moderationStep === MODERATION_STEPS.REPORTED && (
        <>
          <Text className="px-4 pb-3 text-paper/80">
            Thanks for letting us know. We review every report within 24 hours.
          </Text>
          {blockRow}
        </>
      )}
      {moderationStep === MODERATION_STEPS.BLOCKED && (
        <Text className="px-4 pb-3 text-paper/80">
          You&apos;ve blocked @{user.username}. You won&apos;t see each other&apos;s reviews or comments, and they
          can&apos;t follow you or interact with your reviews.
        </Text>
      )}
      {!!error && (
        <Text className="px-4 pt-2 text-sm text-zine-red">{error.message ?? "Something went wrong. Try again."}</Text>
      )}
    </Sheet>
  );
}

/** Opens the report/block sheet: an ellipsis icon, or with `label` a text
 * button. Signed-out users go to sign in instead. */
export function ModerationButton({ user, target, label }: { user: User; target: ReportTarget; label?: string }) {
  const { isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const onPress = () => (isSignedIn ? setIsOpen(true) : router.push(ROUTES.SIGN_IN));

  return (
    <>
      {label ? (
        <Pressable onPress={onPress} className="flex-row items-center gap-1.5 self-center px-3 py-2 active:opacity-70">
          <Icon name="flag-outline" size={16} className="text-paper/60" />
          <Text className="font-display text-lg uppercase text-paper/60">{label}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onPress}
          hitSlop={10}
          accessibilityLabel="Report or block"
          className="p-1 active:opacity-70"
        >
          <Icon name="ellipsis-horizontal" size={18} className="text-paper/60" />
        </Pressable>
      )}
      {isOpen && <ModerationSheet user={user} target={target} onClose={() => setIsOpen(false)} />}
    </>
  );
}
