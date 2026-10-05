import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { parseDateInputValue, toDateInputValue } from "../../lib/format";
import { Text } from "./Text";

export type DateInputProps = {
  // Calendar day as "YYYY-MM-DD" (local time).
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
  className?: string;
};

// Tappable field showing the picked day; opens the system date picker
// (Android dialog, iOS inline calendar under the field). DateInput.web.tsx
// is the browser's native <input type="date"> instead.
export function DateInput({ value, onChange, maximumDate, className = "" }: DateInputProps) {
  const { colorScheme } = useColorScheme();
  const [showIosCalendar, setShowIosCalendar] = useState(false);
  const date = parseDateInputValue(value) ?? new Date();

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        maximumDate,
        onValueChange: (_event, picked) => onChange(toDateInputValue(picked)),
      });
    } else {
      setShowIosCalendar((shown) => !shown);
    }
  };

  return (
    <View>
      <Pressable onPress={open} className={className}>
        <Text className="text-ink dark:text-paper">{date.toLocaleDateString()}</Text>
      </Pressable>
      {showIosCalendar && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          themeVariant={colorScheme === "dark" ? "dark" : "light"}
          onValueChange={(_event, picked) => {
            onChange(toDateInputValue(picked));
            setShowIosCalendar(false);
          }}
        />
      )}
    </View>
  );
}
