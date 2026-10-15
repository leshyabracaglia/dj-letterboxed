import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { Linking, ScrollView, View } from "react-native";

import { Page, SectionTitle, Text, usePageContentStyle } from "./ui";

export const CONTACT_EMAIL = "leshyabracaglia@gmail.com";

export type InfoSection = { title: string; body: string[] };

/** The contact email as a mailto link, for inside a paragraph. */
export function ContactEmailLink() {
  return (
    <Text onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} className="text-primary-dark underline">
      {CONTACT_EMAIL}
    </Text>
  );
}

/** A plain reading page (privacy policy, support): a big title, an optional
 * line under it, titled sections of paragraphs, and anything after them. */
export function InfoPage({
  title,
  subtitle,
  sections,
  children,
}: {
  title: string;
  subtitle?: string;
  sections: InfoSection[];
  children?: ReactNode;
}) {
  const contentStyle = usePageContentStyle("roomy");
  return (
    <Page fullBleed>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={contentStyle}>
        <View className="w-full max-w-2xl self-center pb-8">
          <Text className="font-display text-4xl uppercase text-paper">{title}</Text>
          {!!subtitle && <Text className="text-sm text-paper/60">{subtitle}</Text>}
          <View className="mt-6 gap-6">
            {sections.map((section, i) => (
              <View key={section.title} className="gap-2">
                <SectionTitle>{section.title}</SectionTitle>
                {section.body.map((paragraph, i) => (
                  <Text key={i} className="text-base leading-6 text-paper/80">
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          {!!children && <View className="mt-6">{children}</View>}
        </View>
      </ScrollView>
    </Page>
  );
}
