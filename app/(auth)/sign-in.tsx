import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

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
        else router.replace(ROUTES.FEED);
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
    } else if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      const emailFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
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
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Text className="mb-8 text-3xl font-bold text-ink">Verify it&apos;s you</Text>
        <Text className="mb-4 text-center text-muted">
          We sent a code to {email} to confirm this new device.
        </Text>
        <TextInput
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          className="mb-4 w-full max-w-sm rounded-lg border border-muted/30 bg-white px-4 py-3"
        />
        {error ? <Text className="mb-3 text-accent">{error}</Text> : null}
        <Pressable
          onPress={onVerify}
          disabled={fetchStatus === "fetching"}
          className="w-full max-w-sm rounded-lg bg-ink py-3"
        >
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Text className="mb-8 text-3xl font-bold text-ink">Welcome back</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mb-3 w-full max-w-sm rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="mb-4 w-full max-w-sm rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      {errors.fields.identifier ? (
        <Text className="mb-3 text-accent">{errors.fields.identifier.message}</Text>
      ) : null}
      {errors.fields.password ? (
        <Text className="mb-3 text-accent">{errors.fields.password.message}</Text>
      ) : null}
      {error ? <Text className="mb-3 text-accent">{error}</Text> : null}
      <Pressable
        onPress={onSubmit}
        disabled={fetchStatus === "fetching"}
        className="w-full max-w-sm rounded-lg bg-ink py-3"
      >
        <Text className="text-center font-semibold text-paper">Sign in</Text>
      </Pressable>
      <View className="mt-10">
        <Link href={ROUTES.SIGN_UP}>
          <Text className="text-muted">Don&apos;t have an account? Sign up</Text>
        </Link>
      </View>
    </View>
  );
}
