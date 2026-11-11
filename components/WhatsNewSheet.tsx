import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Icon, Sheet, Text, type IconName } from "@/components/ui";

// Bump with new slides for a later release, along with the default of
// users.whats_new_seen (migration 0030) so new accounts skip it.
export const WHATS_NEW_VERSION = 1;

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "chatbubble-ellipses-outline",
    title: "No more ratings",
    body: "Nights and sets aren't scored anymore. Say what made the night, not a number.",
  },
  {
    icon: "document-text-outline",
    title: "Reviews are just reviews",
    body: "Your night is your review: write about the whole night, and about any DJ's set you caught.",
  },
  {
    icon: "musical-notes-outline",
    title: "Tracks that stood out",
    body: "Add up to 10 tracks to a night from Spotify, a pasted link, or typed in. Can't name one? Post it as an ID, and people can suggest what it was. You accept the right one, and they get the credit.",
  },
  {
    icon: "location-outline",
    title: "Check in and get stamped",
    body: "Check in at the club to verify your night. Every club you've logged or checked in at gets stamped in your passport, and you can pin up to three favorites.",
  },
  {
    icon: "people-outline",
    title: "Your friend's here too",
    body: "Check in at a club, and if a friend (someone you both follow) checked in there tonight, you'll both get a heads-up.",
  },
  {
    icon: "list-outline",
    title: "Lists",
    body: 'Curate nights or single sets, such as "best closing sets of the summer", with a note on each.',
  },
  {
    icon: "disc-outline",
    title: "DJ pages, by the crowd",
    body: "Every DJ page now shows the tracks people loved and how people describe their sets.",
  },
];

// The "What's new" walkthrough an existing user sees once on opening a new
// build, one slide per change. Closing it at any point counts as seen.
export function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <Sheet title="What's new" tag={`${index + 1}/${SLIDES.length}`} onClose={onClose}>
      <View className="gap-4 px-4">
        <View className="min-h-48 items-center justify-center gap-3 px-2">
          <Icon name={slide.icon} size={44} className="text-accent-text" />
          <Text variant="display" className="text-center text-3xl text-paper">
            {slide.title}
          </Text>
          <Text className="text-center text-paper/80">{slide.body}</Text>
        </View>

        <View className="flex-row justify-center gap-2">
          {SLIDES.map((s, i) => (
            <View key={s.title} className={`h-2 w-2 rounded-full ${i === index ? "bg-paper" : "bg-paper/25"}`} />
          ))}
        </View>

        <View className="flex-row gap-3">
          {index > 0 && (
            <Pressable
              onPress={() => setIndex(index - 1)}
              className="flex-1 items-center justify-center rounded-lg border border-paper/20 py-3 active:opacity-80"
            >
              <Text className="font-semibold text-paper">Back</Text>
            </Pressable>
          )}
          <Button onPress={isLast ? onClose : () => setIndex(index + 1)} className="flex-1 py-3">
            <Text className="font-semibold text-paper">{isLast ? "Got it" : "Next"}</Text>
          </Button>
        </View>

        {!isLast && (
          <Pressable onPress={onClose} className="self-center py-1">
            <Text className="text-sm text-muted">Skip</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}
