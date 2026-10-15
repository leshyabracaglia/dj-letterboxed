import { SectionTitle, Text } from "../components/ui";
import { ContactEmailLink, InfoPage, type InfoSection } from "../components/InfoPage";

const EFFECTIVE_DATE = "October 12, 2026";

// The App Store privacy policy (linked from App Store Connect as
// https://beatboxd.com/privacy). Keep it in step with what the app actually
// collects and the App Privacy answers given there.
const SECTIONS: InfoSection[] = [
  {
    title: "Who we are",
    body: [
      "Beatboxd is an app for logging, rating and reviewing DJ sets and nights out, operated by Leshya Bracaglia, an individual developer (“we”, “us”). This policy explains what we collect when you use the Beatboxd app or website, why, and the choices you have.",
    ],
  },
  {
    title: "What we collect",
    body: [
      "Account details: your email address, username, and (if you add them) your display name, bio and profile photo. Sign-in is handled by Clerk, which stores your email, password (hashed) or sign-in provider, and profile photo on our behalf.",
      "What you post: the nights you log (event, venue, date, DJs), your ratings, reviews, tags, comments and likes, the friends you tag, who you follow, and the reviews you showcase as favorites.",
      "Approximate location: when you open the log tab, the app uses your device’s location, at low accuracy, to find nights near you. On iPhone and Android your device turns it into a city name and only the city is sent to us; on the web, coordinates rounded to about 1km are sent and turned into a city. We use it for that search and don’t store it. You can decline location access and pick a city by hand instead.",
      "Check-ins: when you tap Check in on the log tab, the app takes one precise reading of your device’s location and sends it to us to find the venue you’re at. We compare it with the venue’s location and then discard it. We keep only that you checked in at that venue, when, and roughly how far from it you were, so your log of that night can show as verified. Nothing is read in the background.",
      "Device push token: if you allow notifications, we store your device’s push token so we can tell you about new followers, likes and comments.",
      "Safety reports and blocks: if you report a review, comment or user, we keep the report, including a copy of the reported text, and who you block.",
      "We don’t use advertising, analytics or crash-reporting SDKs, and we don’t track you across other apps or websites.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To run Beatboxd: create your account, show your logs and reviews, build the feed and DJ, event and venue pages, find nights near you, send the notifications you’ve allowed, and keep the community safe by reviewing reports and enforcing blocks.",
      "We don’t sell your data, share it for advertising, or use it to profile you.",
    ],
  },
  {
    title: "What’s public",
    body: [
      "Beatboxd is a social app. Your username, display name, bio, profile photo, followers and following, and everything you post (logs, ratings, reviews, comments, tags and favorites) can be seen by anyone, including people who aren’t signed in. Friends you tag on a night are shown on it. Your email address is never shown.",
    ],
  },
  {
    title: "Services we use",
    body: [
      "We share data only with the service providers that run Beatboxd for us, and only what each needs:",
      "Clerk (sign-in and accounts). Amazon Web Services (our servers and database, in the United States). Vercel (hosting the website). Expo (delivering push notifications). Resend (emailing safety reports to us; a report email contains the reported content and the usernames involved). Google Maps Platform (venue search, and turning web coordinates into a city). Spotify and Resident Advisor (we search their catalogs for DJs and nights from our servers; we don’t send them anything about you).",
      "We may also disclose information if the law requires it, or to protect the safety of our users or others.",
    ],
  },
  {
    title: "Keeping and deleting your data",
    body: [
      "We keep your data while your account exists. You can delete your account at any time in Settings. That deletes your profile and everything you’ve posted (logs, ratings, reviews, comments, likes, follows, tags and favorites). DJs, events and venues you added to the shared database stay, without your name on them. Copies in backups are removed as the backups expire.",
      "Safety reports are kept as long as we need them to deal with abuse.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can see and edit your profile in the app at any time, and delete your account in Settings. Depending on where you live (for example, under the GDPR in the EU and UK or the CCPA in California), you may also have the right to request a copy of your data, to correct it, to object to or restrict how we use it, and to complain to your local data protection authority. To make a request, email us at the address below.",
    ],
  },
  {
    title: "Age",
    body: [
      "Beatboxd is meant for people 16 and older. We don’t knowingly collect data from anyone under 16; if you believe a child has made an account, contact us and we’ll delete it.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If we change this policy, we’ll update it here and change the date at the top. For significant changes, we’ll let you know in the app.",
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <InfoPage title="Privacy policy" subtitle={`Effective ${EFFECTIVE_DATE}`} sections={SECTIONS}>
      <SectionTitle>Contact</SectionTitle>
      <Text className="mt-2 text-base leading-6 text-paper/80">
        Questions or requests about your data: <ContactEmailLink />
      </Text>
    </InfoPage>
  );
}
