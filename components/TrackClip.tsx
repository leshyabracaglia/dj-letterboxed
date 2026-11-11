import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { Icon, Text } from "./ui";
import { showAlert } from "@/lib/dialog";
import { isWeb } from "@/lib/platform";

/** The longest a clip can be (the server allows a little slack over it). */
export const MAX_CLIP_SECONDS = 15;

/** A recording made on this device, before it's uploaded. */
export type LocalClip = { uri: string; durationMs: number };

/** Recording a clip of a track nobody could name: up to MAX_CLIP_SECONDS,
 * stopping by itself at the limit. Only in the native app: browsers record
 * a format iPhones can't play, and you record at the club on your phone. */
export function ClipRecorder({ onRecorded }: { onRecorded: (clip: LocalClip) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(false);
  const wasRecording = useRef(false);

  // However it stopped (the button, or the limit), hand over the file once
  // it has.
  useEffect(() => {
    if (wasRecording.current && !state.isRecording) {
      const { uri } = recorder;
      void setAudioModeAsync({ allowsRecording: false });
      if (uri) onRecorded({ uri, durationMs: Math.min(state.durationMillis, MAX_CLIP_SECONDS * 1000) });
    }
    wasRecording.current = state.isRecording;
  }, [state.isRecording, state.durationMillis, recorder, onRecorded]);

  if (isWeb) {
    return <Text className="text-sm text-paper/60">Record a clip from the Beatboxd app on your phone.</Text>;
  }

  const start = async () => {
    setStarting(true);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showAlert("Microphone needed", "Allow Beatboxd to use the microphone in Settings to record a clip.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_CLIP_SECONDS });
    } catch {
      showAlert("Couldn't record", "Try again in a moment.");
    } finally {
      setStarting(false);
    }
  };

  const seconds = Math.floor(state.durationMillis / 1000);
  return state.isRecording ? (
    <Pressable
      onPress={() => void recorder.stop()}
      accessibilityRole="button"
      accessibilityLabel="Stop recording"
      className="flex-row items-center gap-3 border-2 border-stamp-red bg-black/30 px-3 py-2 active:opacity-80"
    >
      <Icon name="stop-circle" size={22} className="text-stamp-red" />
      <Text variant="display" className="flex-1 text-lg text-paper">
        Recording… {seconds}s of {MAX_CLIP_SECONDS}s
      </Text>
    </Pressable>
  ) : (
    <Pressable
      onPress={start}
      disabled={starting}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-2 border-dashed border-paper/60 bg-black/15 px-3 py-2 active:opacity-70"
    >
      <Icon name="mic" size={20} className="text-paper" />
      <View className="flex-1">
        <Text variant="display" className="text-lg leading-5 text-paper">
          Record a clip
        </Text>
        <Text className="text-xs text-paper/60">
          Up to {MAX_CLIP_SECONDS} seconds, so others can listen and name it
        </Text>
      </View>
    </Pressable>
  );
}

/** Plays a clip in place: a local recording, or one streamed from the API.
 * There's deliberately no download or share. */
export function ClipPlayer({ uri, durationMs }: { uri: string; durationMs: number }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const total = status.duration || durationMs / 1000;
  const progress = total ? Math.min(1, status.currentTime / total) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (total && status.currentTime >= total - 0.05)) void player.seekTo(0);
    player.play();
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? "Pause the clip" : "Play the clip"}
      className="flex-row items-center gap-3 border border-paper/30 bg-black/30 px-3 py-2 active:opacity-80"
    >
      <Icon name={status.playing ? "pause" : "play"} size={20} className="text-paper" />
      <View className="h-1.5 flex-1 bg-paper/20">
        <View className="h-full bg-paper" style={{ width: `${progress * 100}%` }} />
      </View>
      <Text className="font-numeric text-sm text-paper/80">{Math.round(total)}s</Text>
    </Pressable>
  );
}
