import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthScreen } from "../../components/AuthScreen";
import { Button, FormMessage, Text, TextField } from "../../components/ui";

import { ROUTES } from "../../lib/routes";

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateAfterAuth = async () => {
    await signIn.finalize({
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
    const { error: submitError } = await signIn.password({
      identifier: email,
      password,
    });
    if (submitError) return;

    if (signIn.status === "complete") {
      await navigateAfterAuth();
    } else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const emailFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === "email_code");
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        setNeedsVerification(true);
      } else {
        setError("This sign-in needs verification we don't support yet.");
      }
    }
  };

  const onVerify = async () => {
    setError(null);
    const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code });
    if (verifyError) {
      setError(verifyError.longMessage ?? verifyError.message);
      return;
    }
    if (signIn.status === "complete") {
      await navigateAfterAuth();
    }
  };

  if (needsVerification) {
    return (
      <AuthScreen title="Verify it's you" subtitle={<>We sent a code to {email} to confirm this new device.</>}>
        <TextField placeholder="Verification code" value={code} onChangeText={setCode} className="w-full" />
        <FormMessage>{error}</FormMessage>
        <Button onPress={onVerify} disabled={fetchStatus === "fetching"} className="w-full py-3">
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Welcome back" wordmark>
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
      <View className="w-full items-end">
        <Link href={ROUTES.FORGOT_PASSWORD(email.trim() ? { email: email.trim() } : undefined)}>
          <Text className="text-sm text-primary-dark">Forgot password?</Text>
        </Link>
      </View>
      <FormMessage>{errors.fields.identifier?.message}</FormMessage>
      <FormMessage>{errors.fields.password?.message}</FormMessage>
      <FormMessage>{error}</FormMessage>
      <Button onPress={onSubmit} disabled={fetchStatus === "fetching"} className="w-full py-3">
        <Text className="text-center font-semibold text-paper">Sign in</Text>
      </Button>
      <View className="mt-7 items-center gap-4">
        <Link href={ROUTES.SIGN_UP}>
          <Text className="text-primary-dark">Don&apos;t have an account? Sign up</Text>
        </Link>
        <Link href={ROUTES.FEED} replace>
          <Text className="text-muted">Continue without an account</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
