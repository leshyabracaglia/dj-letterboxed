import { useEffect, useRef, useState, type RefObject } from "react";
import { ActivityIndicator, Image, Modal, Pressable, useWindowDimensions, View, type ViewInstance } from "react-native";

import { Button, Icon, type Paper, Tape, Text, TornEdge, useCardColors, WallBackground } from "@/components/ui";
import { NightStamp } from "@/components/NightStamp";
import { errorMessage } from "@/lib/api/client";
import type { ReviewDetail } from "@/lib/api/types";
import { colors } from "@/lib/colors";
import { isWeb } from "@/lib/platform";
import { nightDateParts, reviewSubject, soloSet } from "@/lib/review";
import { ROUTES } from "@/lib/routes";
import { captureStory, shareStory, WEB_URL, type CapturedStory } from "@/lib/shareStory";

function snippet(text: string, max = 150) {
  const flat = text.trim().replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function storyPhoto(review: ReviewDetail) {
  return (
    reviewSubject(review, soloSet(review)).imageUrl ??
    review.lineup.find((entry) => entry.dj.imageUrl)?.dj.imageUrl ??
    null
  );
}

// The 9:16 Instagram story image, in the app's zine look: a torn, taped
// paper card (the same purple/red the review was opened on) pinned to the
// concrete wall, with a framed snapshot and the night's passport stamp. Laid out on a
// 360-wide design grid and scaled by `width` so the on-screen preview and the
// 1080×1920 capture are the same drawing. Key content stays clear of the top
// ~10% / bottom ~12%, where Instagram overlays its progress bar, header and
// reply box. Shadows are native-only extras; web capture via html2canvas
// drops them.
function StoryCard({
  review,
  paper,
  width,
  cardRef,
  onImageSettled,
}: {
  review: ReviewDetail;
  paper: Paper;
  width: number;
  cardRef: RefObject<ViewInstance | null>;
  onImageSettled: () => void;
}) {
  const u = (n: number) => (n * width) / 360;
  const height = (width * 16) / 9;
  // A post that's just one DJ's review (see soloSet) shares as that DJ's.
  const set = soloSet(review);
  const subject = reviewSubject(review, set);
  const photo = storyPhoto(review);
  const reviewText = set ? set.reviewText : review.reviewText;
  const cardColors = useCardColors();
  const paperColor = cardColors[paper.tint];
  const label = nightDateParts(review, { wholeNight: subject.isNight, withYear: true }).join(" · ");
  const where = review.venue
    ? `${!subject.isNight && review.event ? `${review.event.name} ` : ""}@ ${review.venue}`
    : null;
  const nameSize = subject.name.length > 22 ? 34 : subject.name.length > 12 ? 42 : 54;
  const tags = review.tags?.slice(0, 3) ?? [];

  return (
    <View ref={cardRef} collapsable={false} style={{ width, height, overflow: "hidden", backgroundColor: colors.ink }}>
      <WallBackground />

      <View
        style={{
          flex: 1,
          paddingTop: u(62),
          paddingBottom: u(82),
          paddingHorizontal: u(26),
          justifyContent: "space-between",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: u(8) }}>
            <Image source={require("@/assets/logo-mark.png")} style={{ width: u(34), height: u(34) }} />
            <Text
              className="font-display text-paper"
              style={{
                fontSize: u(38),
                lineHeight: u(40),
                textShadowColor: "rgba(255,255,255,0.35)",
                textShadowRadius: u(8),
              }}
            >
              BeatBox&apos;d
            </Text>
          </View>
          <Text
            variant="display"
            className="text-paper/75"
            style={{ fontSize: u(17), lineHeight: u(20), marginTop: u(4) }}
          >
            @{review.user.username} caught
          </Text>
        </View>

        {/* The paper card, tilted like it's tacked to the wall. */}
        <View
          style={{
            transform: [{ rotate: "-1.5deg" }],
            shadowColor: "#000",
            shadowOpacity: 0.6,
            shadowRadius: u(10),
            shadowOffset: { width: 0, height: u(6) },
          }}
        >
          <View style={{ backgroundColor: paperColor, padding: u(16), paddingBottom: u(20) }}>
            <TornEdge color={paperColor} height={u(10)} />
            <Tape style={{ top: -u(11), left: u(24) }} width={u(84)} rotate={-5} />

            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View
                style={{
                  width: u(122),
                  height: u(122),
                  borderWidth: u(4),
                  borderColor: colors.paper,
                  overflow: "hidden",
                  transform: [{ rotate: "-3deg" }],
                }}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    onLoad={onImageSettled}
                    onError={onImageSettled}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <View
                    className={`flex-1 items-center justify-end overflow-hidden ${paper.photoPlaceholderClassName}`}
                  >
                    <Icon name="person" size={u(110)} className={paper.photoSilhouetteClassName} />
                  </View>
                )}
              </View>
              <View style={{ marginTop: u(4), marginRight: u(2) }}>
                <NightStamp review={review} size={u(104)} rotate={-10} />
              </View>
            </View>

            <Text
              variant="display"
              className={`${paper.inkClassName}`}
              style={{ fontSize: u(16), lineHeight: u(18), marginTop: u(16) }}
            >
              {label}
            </Text>
            <Text
              variant="display"
              className="text-paper"
              style={{ fontSize: u(nameSize), lineHeight: u(nameSize * 0.92), marginTop: u(4) }}
            >
              {subject.name}
            </Text>
            {!!where && (
              <Text
                variant="display"
                className="text-paper"
                style={{ fontSize: u(19), lineHeight: u(21), marginTop: u(2) }}
              >
                {where}
              </Text>
            )}

            {!!reviewText && (
              <Text className="text-paper" style={{ fontSize: u(14), lineHeight: u(20), marginTop: u(12) }}>
                “{snippet(reviewText, 140)}”
              </Text>
            )}

            {!!tags.length && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: u(6), marginTop: u(12) }}>
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      borderWidth: u(2),
                      borderColor: "rgba(246,246,249,0.9)",
                      paddingHorizontal: u(6),
                      paddingVertical: u(1),
                    }}
                  >
                    <Text variant="display" className="text-paper" style={{ fontSize: u(14), lineHeight: u(16) }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Call to action on a scrap of the near-black panel. */}
        <View
          style={{
            alignSelf: "center",
            alignItems: "center",
            marginTop: u(28),
            transform: [{ rotate: "1.5deg" }],
            backgroundColor: cardColors.neutral,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            paddingHorizontal: u(18),
            paddingVertical: u(10),
          }}
        >
          <Text variant="display" className="text-paper" style={{ fontSize: u(22), lineHeight: u(24) }}>
            Log the sets you&apos;ve seen
          </Text>
          <Text
            variant="display"
            className="text-primary-dark"
            style={{ fontSize: u(15), lineHeight: u(17), marginTop: u(2) }}
          >
            {WEB_URL.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ShareStorySheet({ review, paper, onClose }: { review: ReviewDetail; paper: Paper; onClose: () => void }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // A multiple of 9 keeps the 9:16 height a whole number of pixels.
  const previewWidth = Math.floor(Math.min(297, windowWidth - 64, ((windowHeight - 280) * 9) / 16) / 9) * 9;
  const cardRef = useRef<ViewInstance>(null);
  const prepared = useRef<CapturedStory | null>(null);
  const set = soloSet(review);
  const [imageSettled, setImageSettled] = useState(!storyPhoto(review));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filename = `beatboxd-${set?.dj.slug ?? "night"}.png`;
  const link = `${WEB_URL}${ROUTES.REVIEW_DETAIL(review.id) as string}`;

  // On web, render the PNG as soon as the preview has settled: html2canvas is
  // slow enough that doing it on tap can outlive the tap's user activation,
  // and navigator.share() then refuses to open.
  useEffect(() => {
    if (!isWeb || !imageSettled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      captureStory(cardRef, filename)
        .then((story) => {
          if (!cancelled) prepared.current = story;
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageSettled, filename]);

  const onShare = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const story = prepared.current ?? (await captureStory(cardRef, filename));
      const result = await shareStory(story, link);
      if (result === "downloaded") {
        setNotice("Image downloaded — post it to your story from your phone. Your review link is copied.");
      } else if (result === "shared") {
        setNotice("Review link copied — add a Link sticker in Instagram and paste it.");
      }
    } catch (err) {
      setNotice(errorMessage(err, "Couldn't create the image"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-ink/70 px-4">
      <Pressable onPress={(e) => e.stopPropagation()} className="items-center rounded-2xl p-5 bg-surface-dark">
        <Text className="text-lg font-display text-paper">Share to your story</Text>
        <View className="mt-3 overflow-hidden rounded-xl">
          <StoryCard
            review={review}
            paper={paper}
            width={previewWidth}
            cardRef={cardRef}
            onImageSettled={() => setImageSettled(true)}
          />
        </View>
        <Text className="mt-3 text-center text-xs text-muted" style={{ maxWidth: previewWidth + 40 }}>
          {notice ?? "We'll copy a link to this review too — paste it into a Link sticker so friends can tap through."}
        </Text>
        <View className="mt-4 flex-row gap-3" style={{ width: previewWidth + 40 }}>
          <Button onPress={onShare} disabled={busy} className="flex-1 flex-row gap-2 py-3">
            {busy ? (
              <ActivityIndicator color={colors.paper} />
            ) : (
              <Icon name="logo-instagram" size={18} className="text-paper" />
            )}
            <Text className="font-semibold text-paper">Share</Text>
          </Button>
          <Pressable
            onPress={onClose}
            className="flex-1 items-center justify-center rounded-full border border-primary/30 py-3"
          >
            <Text className="font-semibold text-paper">Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

export function ShareStoryButton({
  review,
  paper,
  justLogged,
}: {
  review: ReviewDetail;
  paper: Paper;
  justLogged: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View
      className={`w-full max-w-xl items-center gap-3 rounded-2xl p-4 ${
        justLogged ? "border border-accent/40 bg-accent/10" : ""
      }`}
    >
      {justLogged && (
        <Text className="text-center text-base text-paper">Set logged! Let your followers know who you saw.</Text>
      )}
      <Button onPress={() => setOpen(true)} className="w-full flex-row gap-2 py-3">
        <Icon name="logo-instagram" size={18} className="text-paper" />
        <Text className="font-semibold text-paper">Share to Instagram story</Text>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && <ShareStorySheet review={review} paper={paper} onClose={() => setOpen(false)} />}
      </Modal>
    </View>
  );
}
