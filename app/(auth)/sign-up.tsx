import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthScreen } from "../../components/AuthScreen";
import { Button, FormMessage, Text, TextField } from "../../components/ui";

import { ROUTES } from "../../lib/routes";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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
    const { error: submitError } = await signUp.password({
      emailAddress: email,
      password,
    });
    if (submitError) return;

    await signUp.verifications.sendEmailCode();
    setPendingVerification(true);
  };

  const onVerify = async () => {
    setError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) {
      setError(verifyError.longMessage ?? verifyError.message);
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
      <FormMessage>{errors.fields.emailAddress?.message}</FormMessage>
      <FormMessage>{errors.fields.password?.message}</FormMessage>
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
