import { Link } from "expo-router";
import { View } from "react-native";

import { SectionTitle, Text } from "@/components/ui";
import { ContactEmailLink, InfoPage, type InfoSection } from "@/components/InfoPage";
import { ROUTES } from "@/lib/routes";

const EFFECTIVE_DATE = "October 15, 2026";

// The terms everyone agrees to when they sign up (app/(auth)/sign-up.tsx),
// served at https://beatboxd.com/terms. The community rules are what Apple's
// guideline 1.2 asks of an app with user-generated content.
const SECTIONS: InfoSection[] = [
  {
    title: "Agreeing to these terms",
    body: [
      "Beatboxd is operated by Leshya Bracaglia, an individual developer (“we”, “us”). By creating an account or using the Beatboxd app or website, you agree to these terms and to our Privacy Policy. If you don’t agree, don’t use Beatboxd.",
    ],
  },
  {
    title: "Who can use Beatboxd",
    body: [
      "You must be 16 or older to create an account. You’re responsible for your account and what’s done with it, so keep your password to yourself, and use one account for yourself rather than sharing it or making accounts for others.",
    ],
  },
  {
    title: "Community rules",
    body: [
      "We have zero tolerance for objectionable content or abusive users. Don’t post, or use Beatboxd to:",
      "• Harass, bully, threaten or intimidate anyone, or post hate speech or content that attacks people for who they are.",
      "• Post sexual content or nudity, or anything that sexualizes minors.",
      "• Promote violence, self-harm or illegal activity, including buying or selling drugs.",
      "• Share someone’s private information, or tag people to reveal where they were when they wouldn’t want it known.",
      "• Make false statements of fact about real people or businesses. Reviews should be your honest opinion of a night you were actually at.",
      "• Spam, run fake accounts, impersonate anyone, or manipulate ratings.",
      "• Post content you don’t have the rights to.",
      "• Interfere with Beatboxd: attack, overload, scrape or reverse engineer it, or get around blocks or limits.",
    ],
  },
  {
    title: "Reporting and enforcement",
    body: [
      "You can report any review, comment or user from the app, and block anyone you don’t want to see or hear from. We review reports within 24 hours. We may remove content and suspend or delete accounts that break these rules, without notice, and ban repeat or serious offenders from Beatboxd.",
    ],
  },
  {
    title: "Your content",
    body: [
      "You own what you post. By posting it, you give us a worldwide, non-exclusive, royalty-free license to host, store, display, reproduce and share it to run and promote Beatboxd. The license ends when you delete the content or your account, except for copies in backups until they expire and content others have already shared.",
      "You’re responsible for what you post, and you confirm you have the right to post it. What users post is their own view, not ours.",
    ],
  },
  {
    title: "DJs, venues and events",
    body: [
      "DJ, venue and event pages are built from what the community logs. Beatboxd isn’t affiliated with or endorsed by the artists, venues or promoters on it. Information about events, such as dates, lineups and venues, may be incomplete or wrong. If a page is wrong, email us and we’ll fix it.",
      "Some details come from Spotify, Resident Advisor and Google, which aren’t affiliated with Beatboxd.",
    ],
  },
  {
    title: "Copyright",
    body: [
      "If you believe something on Beatboxd infringes your copyright, email us with a link to it, a description of the work, and your contact details, and we’ll look into it promptly.",
    ],
  },
  {
    title: "Ending your account",
    body: [
      "You can delete your account at any time in Settings. We may suspend or end your access if you break these terms or if we need to in order to protect Beatboxd or its users.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "Beatboxd is provided “as is” and “as available”, without warranties of any kind. We don’t guarantee it will always be available, secure or error-free, or that anything on it is accurate.",
      "Going out is your own responsibility: Beatboxd doesn’t run, check or vouch for any event or venue on it.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "To the fullest extent the law allows, we aren’t liable for any indirect, incidental, special or consequential damages, or for lost data or profits, arising from your use of Beatboxd or from content other users post, and our total liability for any claim relating to Beatboxd is limited to $50.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update these terms. We’ll change the date at the top, and for significant changes we’ll let you know in the app. Continuing to use Beatboxd after a change means you accept the new terms.",
    ],
  },
];

export default function TermsScreen() {
  return (
    <InfoPage title="Terms of service" subtitle={`Effective ${EFFECTIVE_DATE}`} sections={SECTIONS}>
      <SectionTitle>Contact</SectionTitle>
      <Text className="mt-2 text-base leading-6 text-paper/80">
        Questions about these terms, or something to report: <ContactEmailLink />
      </Text>
      <View className="mt-4">
        <Link href={ROUTES.PRIVACY}>
          <Text className="text-sm text-primary-dark underline">Privacy policy</Text>
        </Link>
      </View>
    </InfoPage>
  );
}
