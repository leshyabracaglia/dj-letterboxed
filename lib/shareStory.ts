import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import { Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

// Public web origin for links printed on / copied alongside shared images.
// The web export is served here; review pages are viewable signed out.
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://beatboxd.com").replace(/\/$/, "");

// Instagram story canvas (9:16).
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export type CapturedStory =
  | { platform: "native"; uri: string }
  | { platform: "web"; dataUri: string; file: File };

// Rasterizes `ref` to a full-resolution story PNG. On web this runs
// html2canvas-pro, which can take a moment — capture ahead of the tap where
// possible, since navigator.share() needs the tap's user activation.
export async function captureStory(
  ref: RefObject<View | null>,
  filename: string,
): Promise<CapturedStory> {
  if (Platform.OS === "web") {
    // Called directly rather than through view-shot's web shim, which renders
    // at the on-screen size and then upscales (blurry). html2canvas-pro also
    // fixes html2canvas's text baseline drift with custom fonts. Imported
    // lazily so the DOM-only library stays out of the native path.
    const { default: html2canvas } = await import("html2canvas-pro");
    const el = ref.current as unknown as HTMLElement;
    const canvas = await html2canvas(el, {
      useCORS: true,
      backgroundColor: null,
      scale: STORY_WIDTH / el.offsetWidth,
    });
    const dataUri = canvas.toDataURL("image/png");
    const blob = await (await fetch(dataUri)).blob();
    return { platform: "web", dataUri, file: new File([blob], filename, { type: "image/png" }) };
  }
  const uri = await captureRef(ref, {
    format: "png",
    result: "tmpfile",
    fileName: filename.replace(/\.png$/, ""),
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
  });
  return { platform: "native", uri };
}

// Hands the image to the OS share sheet (Instagram shows up there as
// "Stories"). Instagram doesn't let a shared image carry a tappable link, so
// the link is copied first for the user to paste into a Link sticker.
// Resolves "downloaded" on web browsers without file sharing (desktop).
export async function shareStory(
  story: CapturedStory,
  link: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  await Clipboard.setStringAsync(link).catch(() => {});

  if (story.platform === "native") {
    await Sharing.shareAsync(story.uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: "Share to your story",
    });
    return "shared";
  }

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [story.file] })) {
    try {
      await navigator.share({ files: [story.file] });
      return "shared";
    } catch (err: any) {
      if (err?.name === "AbortError") return "cancelled";
      // NotAllowedError etc. (e.g. lost user activation) — fall back to a download.
    }
  }

  const a = document.createElement("a");
  a.href = story.dataUri;
  a.download = story.file.name;
  a.click();
  return "downloaded";
}
