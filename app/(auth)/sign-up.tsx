import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { type ReactNode, useState } from "react";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton, AuthField, FieldLabel, LOGO } from "@/components/auth/parts";
import { Checkbox, FormMessage, KeyboardScrollView, Text, WallView } from "@/components/ui";

import { clerkErrorMessage } from "@/lib/clerk";
import { ROUTES } from "@/lib/routes";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isOldEnough, setIsOldEnough] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateAfterAuth = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        const url = decorateUrl(ROUTES.FEED as string);
        if (url.startsWith("http")) window.location.href = url;
        else router.dismissTo(ROUTES.FEED);
      },
    });
  };

  const onSubmit = async () => {
    setError(null);
    if (!isOldEnough || !acceptedTerms) {
      setError("To sign up, confirm you're 16 or older and agree to the Terms of Service and Privacy Policy.");
      return;
    }
    // legalAccepted records the agreement (legal_accepted_at) on the Clerk user.
    const { error: submitError } = await signUp.password({
      emailAddress: email,
      password,
      legalAccepted: true,
    });
    if (submitError) return;

    await signUp.verifications.sendEmailCode();
    setPendingVerification(true);
  };

  const onVerify = async () => {
    setError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) {
      setError(clerkErrorMessage(verifyError));
      return;
    }
    if (signUp.status === "complete") {
      await navigateAfterAuth();
    }
  };

  if (pendingVerification) {
    return (
      <TicketScreen>
        <Text variant="display" className="pr-24 text-[28px] uppercase leading-7 text-paper">
          Check your email
        </Text>
        <Text className="text-paper/70">We sent a code to {email.trim()}.</Text>
        <AuthField
          label="Verification code"
          variant="outlined"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
        />
        <FormMessage>{error}</FormMessage>
        <AuthButton label="Verify" onPress={onVerify} disabled={fetchStatus === "fetching"} />
      </TicketScreen>
    );
  }

  return (
    <TicketScreen
      footer={
        <>
          <Link href={ROUTES.SIGN_IN}>
            <Text className="text-sm text-paper">
              Already in? <Text className="font-bold text-sm text-paper">Sign in</Text>
            </Text>
          </Link>
          <Link href={ROUTES.FEED} replace>
            <Text className="text-sm text-primary-dark">Just browse</Text>
          </Link>
        </>
      }
    >
      <Text variant="display" className="pr-24 text-[28px] uppercase leading-7 text-paper">
        Create your account
      </Text>
      <AuthField
        label="Email"
        variant="outlined"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
      />
      <AuthField
        label="Password"
        variant="outlined"
        secureTextEntry
        autoComplete="new-password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
      />
      <View className="gap-3 py-1">
        <Checkbox checked={isOldEnough} onCheckedChange={setIsOldEnough} label="I'm 16 or older">
          <Text className="text-sm text-paper">I&apos;m 16 or older</Text>
        </Checkbox>
        <Checkbox
          checked={acceptedTerms}
          onCheckedChange={setAcceptedTerms}
          label="I agree to the Terms of Service and Privacy Policy"
        >
          <Text className="text-sm text-paper">
            I agree to the{" "}
            <Link href={ROUTES.TERMS} className="text-primary-dark underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href={ROUTES.PRIVACY} className="text-primary-dark underline">
              Privacy Policy
            </Link>
            , including the zero-tolerance rules for abusive content
          </Text>
        </Checkbox>
      </View>
      <FormMessage>{errors.fields.emailAddress?.message}</FormMessage>
      <FormMessage>{errors.fields.password?.message}</FormMessage>
      <FormMessage>{errors.fields.legalAccepted?.message}</FormMessage>
      <FormMessage>{error}</FormMessage>
      <View nativeID="clerk-captcha" />
      <AuthButton label="Get stamped in" onPress={onSubmit} disabled={fetchStatus === "fetching"} />
    </TicketScreen>
  );
}

const NOTCH = 26;

// The perforation across a ticket: a dashed line between two half-circle
// bites out of its edges.
function Perforation() {
  return (
    <View className="h-0 justify-center">
      <View className="mx-[18px] border-t-2 border-dashed border-paper/35" />
      <View
        className="absolute rounded-full bg-ink"
        style={{ left: -NOTCH / 2, width: NOTCH, height: NOTCH, top: -NOTCH / 2 }}
      />
      <View
        className="absolute rounded-full bg-ink"
        style={{ right: -NOTCH / 2, width: NOTCH, height: NOTCH, top: -NOTCH / 2 }}
      />
    </View>
  );
}

// Sign up as an "admit one" ticket: a violet stub with the logo stamped half
// over its edge, a perforation, and the form on the dark half. `footer` is
// the row of links under it.
function TicketScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const issued = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  return (
    <WallView>
      <SafeAreaView className="flex-1">
        <KeyboardScrollView className="flex-1" contentContainerClassName="flex-grow px-[22px] pb-7 pt-12">
          <View className="w-full max-w-md self-center shadow-2xl shadow-black/60">
            <View className="h-[168px] justify-between bg-zine-purple px-[22px] py-5">
              <View className="flex-row justify-between">
                <FieldLabel className="text-zine-purple-ink">Admit one</FieldLabel>
                <FieldLabel className="text-zine-purple-ink">{issued}</FieldLabel>
              </View>
              <View>
                <Text variant="display" className="text-[22px] text-zine-purple-ink">
                  BeatBox&apos;d presents
                </Text>
                <Text variant="display" className="text-[46px] uppercase leading-[42px] text-paper">
                  Your nights,{"\n"}logged
                </Text>
              </View>
              <Image
                source={LOGO}
                accessibilityIgnoresInvertColors
                className="absolute"
                style={{ right: 14, bottom: -40, width: 96, height: 96, zIndex: 2, transform: [{ rotate: "10deg" }] }}
              />
            </View>
            <Perforation />
            <View className="gap-3 bg-zine-panel p-[22px]">{children}</View>
          </View>
          {!!footer && (
            <>
              <View className="min-h-8 flex-grow" />
              <View className="w-full max-w-md flex-row justify-between self-center">{footer}</View>
            </>
          )}
        </KeyboardScrollView>
      </SafeAreaView>
    </WallView>
  );
}
