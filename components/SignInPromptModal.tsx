import { router } from "expo-router";
import { Modal, Pressable, View } from "react-native";
import { MetalButton } from "./MetalButton";
import { Text } from "./Text";

import { ROUTES } from "../lib/routes";

export function SignInPromptModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-ink/40 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-paper dark:bg-surface-dark p-6 shadow-lg"
        >
          <Text className="mb-2 text-center text-xl font-display text-ink dark:text-paper">
            Sign in required
          </Text>
          <Text className="mb-5 text-center text-muted">
            Create an account or log in to do that.
          </Text>
          <View className="flex-row gap-3">
            <MetalButton
              onPress={() => {
                onClose();
                router.push(ROUTES.SIGN_UP);
              }}
              className="flex-1 rounded-xl py-3"
            >
              <Text className="text-center font-semibold text-paper">Sign up</Text>
            </MetalButton>
            <Pressable
              onPress={() => {
                onClose();
                router.push(ROUTES.SIGN_IN);
              }}
              className="flex-1 rounded-xl border border-primary/30 py-3 active:opacity-80"
            >
              <Text className="text-center font-semibold text-ink dark:text-paper">Log in</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} className="mt-4">
            <Text className="text-center text-muted">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
