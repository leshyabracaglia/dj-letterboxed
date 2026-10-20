import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ListFormSheet } from "./ListFormSheet";
import { Avatar, Button, Icon, KEYBOARD_DISMISS_PROPS, Sheet, Skeleton, Stamp, Text } from "./ui";
import { router } from "expo-router";

import { errorMessage, unwrap, useApi } from "@/lib/api/client";
import { useUserLists, useUserStats } from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/queryKeys";
import { useCurrentUser } from "@/lib/auth";
import { plural } from "@/lib/format";
import type { UserStats } from "@/lib/api/types";
import { ROUTES } from "@/lib/routes";

const DJ_RANKING_TYPES = {
  RECENT: "recent",
  MOST: "most",
};

type DjRankingType = (typeof DJ_RANKING_TYPES)[keyof typeof DJ_RANKING_TYPES];

const DJ_RANKING_TYPE_OPTIONS: { value: DjRankingType; label: string }[] = [
  { value: DJ_RANKING_TYPES.RECENT, label: "Recently seen" },
  { value: DJ_RANKING_TYPES.MOST, label: "Most seen" },
];

// "Sep 14", in the device's locale.
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function SeenDjs({ stats }: { stats: UserStats }) {
  const [selectedRankingType, setSelectedRankingType] = useState<DjRankingType>(DJ_RANKING_TYPES.RECENT);

  return (
    <View>
      <View className="flex-row gap-4">
        {DJ_RANKING_TYPE_OPTIONS.map((rankOption) => {
          const isSelected = rankOption.value === selectedRankingType;
          return (
            <Pressable
              key={rankOption.value}
              onPress={() => setSelectedRankingType(rankOption.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              hitSlop={6}
            >
              <Text variant="display" className={`text-xl ${isSelected ? "text-paper underline" : "text-paper/40"}`}>
                {rankOption.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row flex-wrap gap-3">
        {selectedRankingType === DJ_RANKING_TYPES.RECENT &&
          stats.recentDjs.map(({ dj, lastSeenAt }) => (
            <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
              <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
              <Text variant="display" className="mt-1 text-center text-base leading-5 text-paper" numberOfLines={1}>
                {dj.name}
              </Text>
              <Text variant="display" className="text-sm text-paper/60">
                {shortDate(lastSeenAt)}
              </Text>
            </Pressable>
          ))}
        {selectedRankingType === DJ_RANKING_TYPES.MOST &&
          stats.topDjs.map(({ dj, timesSeen }) => (
            <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
              <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
              <Text variant="display" className="mt-1 text-center text-base leading-5 text-paper" numberOfLines={1}>
                {dj.name}
              </Text>
              <Text variant="display" className="text-sm text-paper/60">
                seen <Text className="font-numeric text-sm text-paper">{timesSeen}</Text>
              </Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

// How many passport stamps show before "+N".
const PASSPORT_SHOWN = 8;
const PASSPORT_STAMP_SIZE = 76;
// Stamps land a little crooked, each its own way.
const PASSPORT_TILTS = [-8, 5, -3, 9, -6, 3];

/** A venue's name for the middle of its stamp, a word to a line (three at
 * most). */
function stampLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length <= 3 ? words : [...words.slice(0, 2), words.slice(2).join(" ")];
}

type Visit = UserStats["passport"][number];

/** A passport stamp's accessible description: the venue and how they've been. */
function visitLabel(stamp: Visit): string {
  return `${stamp.name}: ${stamp.nights ? plural(stamp.nights, "night") : "checked in"}`;
}

/** The city a stamp's rim names: the first part of "Brooklyn, NY". */
function stampCity(stamp: Visit): string {
  return stamp.city?.split(",")[0] ?? "BEATBOXD";
}

const MAX_FAVORITE_VENUES = 3;

// The clubs they've pinned, as big stamps; their own profile can pick them
// from their passport.
function FavoriteVenues({ stats, username, isSelf }: { stats: UserStats; username: string; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const favorites = stats.favoriteVenues;
  if (!favorites.length && !isSelf) return null;
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text variant="display" className="text-xl text-paper/85">
          Favorite clubs
        </Text>
        {isSelf && !!stats.passport.length && (
          <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button">
            <Text variant="display" className="text-base text-paper/70 underline">
              {favorites.length ? "Edit" : "Pick yours"}
            </Text>
          </Pressable>
        )}
      </View>
      {favorites.length ? (
        <View className="mt-2 flex-row gap-3">
          {favorites.map((stamp, i) => (
            <Pressable
              key={stamp.venueId}
              onPress={() => router.push(ROUTES.VENUE(stamp.venueId))}
              accessibilityRole="link"
              className="active:opacity-80"
            >
              <Stamp
                label={stampLines(stamp.name)}
                rim={`#${i + 1} · ${stampCity(stamp)} · `}
                size={96}
                color={i % 2 ? "purple" : "red"}
                rotate={PASSPORT_TILTS[i]}
                accessibilityLabel={`Favorite #${i + 1}, ${visitLabel(stamp)}`}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text className="mt-1 text-sm text-paper/60">
          {stats.passport.length
            ? "Pin up to three clubs you love."
            : "Log a night or check in somewhere to pin your favorite clubs."}
        </Text>
      )}
      {editing && (
        <FavoriteVenuesSheet
          username={username}
          passport={stats.passport}
          current={favorites.map((stamp) => stamp.venueId)}
          onClose={() => setEditing(false)}
        />
      )}
    </View>
  );
}

// Picking favorite clubs from everywhere they've been: tap in the order to
// show them, tap again to unpin.
function FavoriteVenuesSheet({
  username,
  passport,
  current,
  onClose,
}: {
  username: string;
  passport: Visit[];
  current: string[];
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_FAVORITE_VENUES ? [...prev, id] : prev,
    );

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const result = await unwrap(api.PATCH("/api/users/me/favorite-venues", { body: { venueIds: selected } }));
      queryClient.setQueryData<UserStats>(queryKeys.users.stats(username), (old) =>
        old ? { ...old, favoriteVenues: result.items } : old,
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your favorites"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Favorite clubs" tag={`${selected.length} of ${MAX_FAVORITE_VENUES}`} onClose={onClose}>
      <Text className="px-4 text-sm text-paper/60">Tap in the order you want them shown. Tap again to unpin.</Text>
      <ScrollView className="mt-3 shrink" {...KEYBOARD_DISMISS_PROPS}>
        {passport.map((stamp) => {
          const rank = selected.indexOf(stamp.venueId);
          return (
            <Pressable
              key={stamp.venueId}
              onPress={() => toggle(stamp.venueId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rank !== -1 }}
              className={`flex-row items-center gap-3 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20 ${
                rank !== -1 ? "bg-zine-purple/20" : ""
              }`}
            >
              <View className="flex-1">
                <Text variant="display" className="text-lg leading-5 text-paper">
                  {stamp.name}
                </Text>
                <Text className="text-xs text-paper/60">
                  {[stamp.city, stamp.nights ? plural(stamp.nights, "night") : "Checked in"]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {rank !== -1 ? (
                <Text className="font-numeric text-xl text-paper">#{rank + 1}</Text>
              ) : (
                <Icon name="add" size={18} className="text-paper/50" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <View className="gap-2 px-4 pt-3">
        {!!error && <Text className="text-danger-dark">{error}</Text>}
        <Button onPress={save} disabled={saving} className="py-3">
          <Text variant="display" className="text-xl text-paper">
            {saving ? "Saving…" : "Save"}
          </Text>
        </Button>
      </View>
    </Sheet>
  );
}

// Their lists, each with a strip of the DJs on it; their own profile can
// start one.
function Lists({ username, isSelf }: { username: string; isSelf: boolean }) {
  const { data: lists } = useUserLists(username);
  const [creating, setCreating] = useState(false);
  if (!lists?.length && !isSelf) return null;
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text variant="display" className="text-xl text-paper/85">
          Lists
        </Text>
        {isSelf && (
          <Pressable onPress={() => setCreating(true)} hitSlop={8} accessibilityRole="button">
            <Text variant="display" className="text-base text-paper/70 underline">
              New list
            </Text>
          </Pressable>
        )}
      </View>
      {lists?.length ? (
        <View className="mt-2 gap-2">
          {lists.map((list) => (
            <Pressable
              key={list.id}
              onPress={() => router.push(ROUTES.LIST(list.id))}
              accessibilityRole="link"
              className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 p-3 active:opacity-80"
            >
              <View className="flex-row">
                {list.coverImages.slice(0, 3).map((uri, i) => (
                  <View key={uri} style={{ marginLeft: i ? -14 : 0 }}>
                    <Avatar uri={uri} name={list.title} size={36} />
                  </View>
                ))}
                {!list.coverImages.length && <Icon name="list" size={28} className="text-paper/60" />}
              </View>
              <View className="flex-1">
                <Text variant="display" className="text-xl leading-6 text-paper" numberOfLines={1}>
                  {list.title}
                </Text>
                <Text className="text-xs text-paper/60">{plural(list.itemCount, "entry", "entries")}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text className="mt-1 text-sm text-paper/60">
          Gather nights and sets that belong together: best closers, sunrise sets, the nights that got you into it.
        </Text>
      )}
      {creating && (
        <ListFormSheet
          onSaved={(list) => {
            setCreating(false);
            router.push(ROUTES.LIST(list.id));
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </View>
  );
}

// Every club they've been to (logged a night at or checked in at), as
// stamps in a passport, first visit first.
function Passport({ stamps }: { stamps: UserStats["passport"] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? stamps : stamps.slice(0, PASSPORT_SHOWN);
  const hidden = stamps.length - shown.length;
  const cities = new Set(stamps.map((stamp) => stamp.city?.split(",")[0].trim().toLowerCase()).filter(Boolean));
  return (
    <View>
      <Text variant="display" className="text-xl text-paper/85">
        Passport · {plural(stamps.length, "club")}
        {!!cities.size && ` · ${plural(cities.size, "city", "cities")}`}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {shown.map((stamp, i) => (
          <Pressable
            key={stamp.venueId}
            onPress={() => router.push(ROUTES.VENUE(stamp.venueId))}
            accessibilityRole="link"
            className="active:opacity-80"
          >
            <Stamp
              label={stampLines(stamp.name)}
              rim={`${stampCity(stamp)} · `}
              size={PASSPORT_STAMP_SIZE}
              color={i % 2 ? "purple" : "red"}
              rotate={PASSPORT_TILTS[i % PASSPORT_TILTS.length]}
              accessibilityLabel={visitLabel(stamp)}
            />
          </Pressable>
        ))}
        {!!hidden && (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${plural(hidden, "more club")}`}
            className="active:opacity-80"
          >
            <Stamp
              label={`+${hidden}`}
              size={PASSPORT_STAMP_SIZE}
              color="purple"
              rotate={0}
              accessibilityLabel={`${hidden} more`}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Profile stats below the counts row: recently/most seen DJs and the
 * passport of venues they've been to. The
 * optional `favorites` slot (FavoritesShowcase, currently unused) renders
 * above them. */
export function StatsSummary({ username, favorites }: { username: string; favorites?: ReactNode }) {
  const { data: stats } = useUserStats(username);
  const { me } = useCurrentUser();
  const isSelf = me?.username === username;

  if (!stats) {
    return (
      <View className="border-t border-white/10 pt-3">
        <Skeleton className="h-4 w-20" />
        <View className="mt-2 flex-row gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </View>
      </View>
    );
  }

  const hasDjs = !!stats.recentDjs?.length || !!stats.topDjs.length;
  if (!favorites && !hasDjs && !stats.passport.length && !isSelf) return null;

  return (
    <View className="border-t border-white/10 pt-3">
      {favorites}

      {hasDjs && (
        <View className="mt-3">
          <SeenDjs stats={stats} />
        </View>
      )}

      <View className="mt-3">
        <FavoriteVenues stats={stats} username={username} isSelf={isSelf} />
      </View>

      {!!stats.passport.length && (
        <View className="mt-3">
          <Passport stamps={stats.passport} />
        </View>
      )}

      <View className="mt-3">
        <Lists username={username} isSelf={isSelf} />
      </View>
    </View>
  );
}
