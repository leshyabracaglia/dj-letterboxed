import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, Text, View } from "react-native";

import { ROUTES } from "../lib/routes";

const ACTIVE_COLOR = "#ff5470";
const INACTIVE_COLOR = "#8a8a99";

export function WebTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-ink/10 bg-paper px-6 py-3">
      <Link href={ROUTES.FEED} asChild>
        <Pressable className="flex-row items-center gap-2">
          <Ionicons name="disc" size={22} color={ACTIVE_COLOR} />
          <Text className="text-lg font-bold text-ink">DJ Letterboxed</Text>
        </Pressable>
      </Link>

      <View className="flex-row items-center gap-1">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
                isFocused ? "bg-accent/10" : ""
              }`}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 18 })}
              <Text className={isFocused ? "font-semibold text-accent" : "text-muted"}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
