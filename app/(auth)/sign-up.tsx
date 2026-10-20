import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Checkbox, FormMessage, Text, TextField } from "@/components/ui";

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
      <AuthScreen title="Check your email">
        <TextField placeholder="Verification code" value={code} onChangeText={setCode} className="w-full" />
        <FormMessage>{error}</FormMessage>
        <Button onPress={onVerify} disabled={fetchStatus === "fetching"} className="w-full py-3">
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Create your account" wordmark>
      <TextField
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="w-full"
      />
      <TextField
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="w-full"
      />
      <View className="mt-2 w-full gap-3">
        <Checkbox checked={isOldEnough} onCheckedChange={setIsOldEnough} label="I'm 16 or older">
          <Text className="text-sm text-paper/80">I&apos;m 16 or older</Text>
        </Checkbox>
        <Checkbox
          checked={acceptedTerms}
          onCheckedChange={setAcceptedTerms}
          label="I agree to the Terms of Service and Privacy Policy"
        >
          <Text className="text-sm text-paper/80">
            I agree to the{" "}
            <Link href={ROUTES.TERMS} className="text-primary-dark underline">
              Terms of Service
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
      <Button onPress={onSubmit} disabled={fetchStatus === "fetching"} className="w-full py-3">
        <Text className="text-center font-semibold text-paper">Sign up</Text>
      </Button>
      <View className="mt-7 items-center gap-4">
        <Link href={ROUTES.SIGN_IN}>
          <Text className="text-primary-dark">Already have an account? Sign in</Text>
        </Link>
        <Link href={ROUTES.FEED} replace>
          <Text className="text-muted">Continue without an account</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
