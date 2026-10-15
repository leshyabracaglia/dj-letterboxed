import { Link } from "expo-router";
import { View } from "react-native";

import { SectionTitle, Text } from "../components/ui";
import { ContactEmailLink, InfoPage, type InfoSection } from "../components/InfoPage";
import { ROUTES } from "../lib/routes";

// The App Store support page (linked from App Store Connect as
// https://beatboxd.com/support). Keep the answers in step with the app.
const SECTIONS: InfoSection[] = [
  {
    title: "Logging a night",
    body: [
      "Open the log tab to see nights near you, or search for the event, venue or DJ. Rate the night and any DJs you caught, add a review and tags, and tag the friends you went with.",
      "Once a night is logged it can't be edited, except for who you tagged as being there (“Tag who was there” on its page). To change anything else, delete the review from its page and log it again.",
    ],
  },
  {
    title: "Wrong DJ, venue or event",
    body: [
      "DJs, venues and events are added by the community. If one is a duplicate, misspelled or wrong, email us with a link to its page and we'll fix it.",
    ],
  },
  {
    title: "Reporting and blocking",
    body: [
      "To report a review, comment or user, tap “Report or block” under a review, or the … button on a comment or profile, and pick a reason. We review every report within 24 hours.",
      "Blocking someone from the same menu hides each of you from the other: you won't see each other's reviews or comments, and they can't follow you or interact with your reviews. You can unblock them from their profile.",
    ],
  },
  {
    title: "Location",
    body: [
      "The log tab uses your approximate location to show nights in your city. It's optional: if you decline, pick your city by hand. You can change location access at any time in your phone's settings.",
    ],
  },
  {
    title: "Notifications",
    body: [
      "Beatboxd can notify you about new followers, likes and comments. Turn them on or off in your phone's settings, under Notifications › Beatboxd.",
    ],
  },
  {
    title: "Your account",
    body: [
      "Change your username, bio, photo or password in Settings. To delete your account and everything you've posted, go to Settings › Delete account. This can't be undone.",
    ],
  },
];

export default function SupportScreen() {
  return (
    <InfoPage title="Support" subtitle="Help with Beatboxd" sections={SECTIONS}>
      <SectionTitle>Contact us</SectionTitle>
      <Text className="mt-2 text-base leading-6 text-paper/80">
        Something else, a bug, or feedback? Email <ContactEmailLink /> and we'll get back to you.
      </Text>
      <View className="mt-4">
        <Link href={ROUTES.PRIVACY}>
          <Text className="text-sm text-primary-dark underline">Privacy policy</Text>
        </Link>
      </View>
    </InfoPage>
  );
}
