import { type ReactNode, useEffect, useRef } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";

import { Icon, type IconName, Skeleton, Text } from "../ui";

// Small form and sheet pieces shared across the log screen.

export const INPUT_CLASS =
  "rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-ink dark:text-paper placeholder:text-muted";

// Inputs drawn inside their own frame (search boxes, ruled paper) drop the
// browser's focus ring.
export const NO_WEB_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined;

// Small pixel-type label above a field ("YOUR RATING").
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text className="font-display text-base uppercase text-paper/60">{children}</Text>;
}

// A search box for the sheets: white rule, magnifier, focused on open.
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  // On web the modal's focus trap grabs focus as the sheet slides in, after
  // autoFocus has run; take it back once the slide has finished.
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View className="mx-4 flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
      <Icon name="search" size={16} className="text-paper/70" />
      <TextInput
        ref={ref}
        autoFocus
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        className="flex-1 py-3 text-paper placeholder:text-paper/40"
        style={NO_WEB_OUTLINE}
      />
    </View>
  );
}

// Multiline text on a ruled page: the lines sit behind the input at its line
// height.
const RULE_HEIGHT = 28;
export function LinedInput({
  value,
  onChangeText,
  placeholder,
  lines = 4,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  lines?: number;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ minHeight: RULE_HEIGHT * lines }}>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          className="absolute left-0 right-0 border-b border-paper/15"
          style={{ top: RULE_HEIGHT * (i + 1) - 1 }}
        />
      ))}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        multiline
        textAlignVertical="top"
        className="p-0 text-base text-paper placeholder:text-paper/40"
        style={[NO_WEB_OUTLINE, { lineHeight: RULE_HEIGHT, minHeight: RULE_HEIGHT * lines }]}
      />
    </View>
  );
}

// One result in a sheet: something on the left (badge/icon), a pixel-type
// title, a small subtitle, and a check when it's the current pick.
export function SheetRow({
  left,
  title,
  subtitle,
  selected = false,
  plain = false,
  onPress,
}: {
  left: ReactNode;
  title: string;
  subtitle?: string;
  selected?: boolean;
  // Body type instead of the uppercase display face (action rows).
  plain?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20 ${
        selected ? "bg-zine-purple/20" : ""
      }`}
    >
      <View className="w-8 items-center">{left}</View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={plain ? "text-primary-dark" : "font-display text-lg uppercase leading-5 text-paper"}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} className="text-xs text-paper/60">
            {subtitle}
          </Text>
        )}
      </View>
      {selected && <Icon name="checkmark" size={18} className="text-primary-dark" />}
    </Pressable>
  );
}

export function SheetSectionLabel({ children }: { children: ReactNode }) {
  return <Text className="px-4 pb-1 pt-2 font-display text-sm uppercase text-paper/50">{children}</Text>;
}

export function CircleIcon({ name }: { name: IconName }) {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full border border-paper/40">
      <Icon name={name} size={16} className="text-paper" />
    </View>
  );
}

export function SheetSkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 border-b border-white/10 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <View>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </View>
    </View>
  );
}

// "01 RATE THE SETS ………… OPTIONAL"
export function SectionHeading({
  number,
  title,
  numberClassName,
  aside = "Optional",
  asideClassName = "text-paper/50",
}: {
  number: string;
  title: string;
  numberClassName: string;
  aside?: string;
  asideClassName?: string;
}) {
  return (
    <View className="flex-row items-end justify-between">
      <View className="flex-row items-end gap-2">
        <Text className={`font-numeric text-4xl leading-9 ${numberClassName}`}>{number}</Text>
        <Text className="font-display text-2xl uppercase leading-7 text-paper">{title}</Text>
      </View>
      <Text className={`font-display text-sm uppercase ${asideClassName}`}>{aside}</Text>
    </View>
  );
}
