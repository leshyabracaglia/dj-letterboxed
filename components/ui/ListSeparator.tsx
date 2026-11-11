import { View } from "react-native";

// Space between stacked torn cards in a plain View (a `gap` class, for
// laying them out without a FlatList): room for their ragged edges and the
// stamps hanging off them.
export const TORN_CARD_GAP = "gap-10";

// Space between a FlatList's items, as its ItemSeparatorComponent (a
// FlatList's content can't take a gap: it would also space out the header,
// footer and virtualized blanks). Torn card ones match TORN_CARD_GAP.

export function RowSeparator() {
  return <View className="h-2" />;
}

export function CardSeparator() {
  return <View className="h-4" />;
}

export function TornCardSeparator() {
  return <View className="h-10" />;
}
