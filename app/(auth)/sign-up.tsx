import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button, Text } from "../../components/ui";

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
        <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Check your email</Text>
        <TextInput
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          className="mb-4 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
        />
        {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}
        <Button
          onPress={onVerify}
          disabled={fetchStatus === "fetching"}
          className="w-full max-w-sm py-3"
        >
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-paper dark:bg-ink px-6">
      <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Create your account</Text>
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
      {errors.fields.emailAddress ? (
        <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.emailAddress.message}</Text>
      ) : null}
      {errors.fields.password ? (
        <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.password.message}</Text>
      ) : null}
      {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}
      <View nativeID="clerk-captcha" />
      <Button
        onPress={onSubmit}
        disabled={fetchStatus === "fetching"}
        className="w-full max-w-sm py-3"
      >
        <Text className="text-center font-semibold text-paper">Sign up</Text>
      </Button>
      <View className="mt-10">
        <Link href={ROUTES.SIGN_IN}>
          <Text className="text-primary dark:text-primary-dark">Already have an account? Sign in</Text>
        </Link>
      </View>
    </View>
  );
}
