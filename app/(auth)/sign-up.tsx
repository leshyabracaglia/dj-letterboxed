import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "../../components/Text";

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
        else router.replace(ROUTES.FEED);
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
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink px-6">
        <Text className="mb-8 text-3xl font-display text-ink dark:text-paper">Check your email</Text>
        <TextInput
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          className="mb-4 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
        />
        {error ? <Text className="mb-3 text-danger">{error}</Text> : null}
        <Pressable
          onPress={onVerify}
          disabled={fetchStatus === "fetching"}
          className="w-full max-w-sm rounded-xl bg-primary py-3 active:opacity-90"
        >
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-paper dark:bg-ink px-6">
      <Text className="mb-8 text-3xl font-display text-ink dark:text-paper">Create your account</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mb-3 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="mb-4 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      {errors.fields.emailAddress ? (
        <Text className="mb-3 text-danger">{errors.fields.emailAddress.message}</Text>
      ) : null}
      {errors.fields.password ? (
        <Text className="mb-3 text-danger">{errors.fields.password.message}</Text>
      ) : null}
      {error ? <Text className="mb-3 text-danger">{error}</Text> : null}
      <View nativeID="clerk-captcha" />
      <Pressable
        onPress={onSubmit}
        disabled={fetchStatus === "fetching"}
        className="w-full max-w-sm rounded-xl bg-primary py-3 active:opacity-90"
      >
        <Text className="text-center font-semibold text-paper">Sign up</Text>
      </Pressable>
      <View className="mt-10">
        <Link href={ROUTES.SIGN_IN}>
          <Text className="text-muted">Already have an account? Sign in</Text>
        </Link>
      </View>
    </View>
  );
}
