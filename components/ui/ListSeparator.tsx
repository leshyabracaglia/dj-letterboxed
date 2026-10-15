import { View } from "react-native";

// Space between stacked cards in a plain View: `gap` classes, for laying
// cards out without a FlatList. Torn cards need more room for their ragged
// edges and the stamps hanging off them.
export const CARD_GAP = "gap-4";
export const TORN_CARD_GAP = "gap-10";

// Space between a FlatList's items, as its ItemSeparatorComponent (a
// FlatList's content can't take a gap: it would also space out the header,
// footer and virtualized blanks). Card ones match CARD_GAP / TORN_CARD_GAP.

export function RowSeparator() {
  return <View className="h-2" />;
}

export function CardSeparator() {
  return <View className="h-4" />;
}

export function TornCardSeparator() {
  return <View className="h-10" />;
}
