import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CARD_COLORS } from "./Card";
import { TornEdge } from "./TornEdge";
import { Text } from "./Text";

/** A bottom sheet of near-black panel paper with a torn top edge, sliding up
 * over a dimmed screen. Tapping the backdrop closes it. Mount it only while
 * open so its contents start fresh each time. `tag` is the small label
 * opposite the title ("Optional"); `tagClassName` colors it. */
export function Sheet({
  title,
  tag,
  tagClassName = "text-paper/50",
  onClose,
  children,
}: {
  title: string;
  tag?: string;
  tagClassName?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Pressable onPress={onClose} className="flex-1 bg-ink/60" accessibilityLabel="Close" />
        <View
          className="max-h-[85%] w-full max-w-[680px] self-center bg-zine-panel pt-3"
          style={{ paddingBottom: 12 + bottom }}
        >
          <TornEdge color={CARD_COLORS.neutral} side="top" height={12} />
          <View className="h-1 w-10 self-center rounded-full bg-paper/25" />
          <View className="mt-3 flex-row items-center justify-between px-4">
            <Text className="font-display text-2xl uppercase text-paper">{title}</Text>
            {!!tag && <Text className={`font-display text-base uppercase ${tagClassName}`}>{tag}</Text>}
          </View>
          <View className="mt-3 shrink">{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
