import { Alert } from "react-native";

import { isWeb } from "@/lib/platform";

// System dialogs on every platform. React Native Web's Alert.alert does
// nothing, so on web these fall back to the browser's own dialogs.

export function showAlert(title: string, message?: string) {
  if (isWeb) window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Asks before something that can't be undone; resolves to whether they
 * went ahead. */
export function confirmDestructive({
  title,
  message,
  confirmLabel = "Delete",
}: {
  title: string;
  message: string;
  confirmLabel?: string;
}): Promise<boolean> {
  if (isWeb) return Promise.resolve(window.confirm(`${title}?\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
