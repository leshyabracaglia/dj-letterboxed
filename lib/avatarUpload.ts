import * as ImagePicker from "expo-image-picker";

type AvatarUploadableUser = {
  setProfileImage: (params: { file: Blob }) => Promise<{ publicUrl: string | null }>;
};

/** Picks an image from the library and uploads it via Clerk's hosted avatar
 * storage (avatar_url then syncs to our DB through the existing Clerk
 * webhook). Returns the resulting image URL, or null if the user cancelled
 * or denied library access. */
export async function pickAndUploadAvatar(user: AvatarUploadableUser): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;

  const response = await fetch(result.assets[0].uri);
  const blob = await response.blob();
  const image = await user.setProfileImage({ file: blob });
  return image.publicUrl;
}
