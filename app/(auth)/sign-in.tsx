import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { MetalButton } from "../../components/MetalButton";
import { Text } from "../../components/Text";

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
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink px-6">
        <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Verify it&apos;s you</Text>
        <Text className="mb-4 text-center text-muted">
          We sent a code to {email} to confirm this new device.
        </Text>
        <TextInput
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          className="mb-4 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
        />
        {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}
        <MetalButton
          onPress={onVerify}
          disabled={fetchStatus === "fetching"}
          className="w-full max-w-sm rounded-xl py-3"
        >
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </MetalButton>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-paper dark:bg-ink px-6">
      <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Welcome back</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mb-3 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="mb-4 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      {errors.fields.identifier ? (
        <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.identifier.message}</Text>
      ) : null}
      {errors.fields.password ? (
        <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.password.message}</Text>
      ) : null}
      {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}
      <MetalButton
        onPress={onSubmit}
        disabled={fetchStatus === "fetching"}
        className="w-full max-w-sm rounded-xl py-3"
      >
        <Text className="text-center font-semibold text-paper">Sign in</Text>
      </MetalButton>
      <View className="mt-10">
        <Link href={ROUTES.SIGN_UP}>
          <Text className="text-primary dark:text-primary-dark">Don&apos;t have an account? Sign up</Text>
        </Link>
      </View>
    </View>
  );
}
