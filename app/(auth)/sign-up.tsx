import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button, KeyboardScrollView, Text, WallView } from "../../components/ui";

import { BrandWordmark } from "../../components/BrandWordmark";
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
      <WallView>
        <KeyboardScrollView
          className="flex-1"
          contentContainerClassName="flex-grow items-center justify-center px-6"
        >
          <Text className="mb-8 text-center font-display text-5xl uppercase leading-[48px] text-paper">Check your email</Text>
          <TextInput
            placeholder="Verification code"
            value={code}
            onChangeText={setCode}
            className="mb-4 w-full max-w-sm rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-base text-paper"
            placeholderTextColor="rgba(246,246,249,0.4)"
          />
          {!!error && <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text>}
          <Button
            onPress={onVerify}
            disabled={fetchStatus === "fetching"}
            className="w-full max-w-sm py-3"
          >
            <Text className="text-center font-semibold text-paper">Verify</Text>
          </Button>
        </KeyboardScrollView>
      </WallView>
    );
  }

  return (
    <WallView>
      <KeyboardScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center justify-center px-6"
      >
        <BrandWordmark className="mb-6" />
        <Text className="mb-8 text-center font-display text-5xl uppercase leading-[48px] text-paper">Create your account</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          className="mb-3 w-full max-w-sm rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-base text-paper"
            placeholderTextColor="rgba(246,246,249,0.4)"
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          className="mb-4 w-full max-w-sm rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-base text-paper"
            placeholderTextColor="rgba(246,246,249,0.4)"
        />
        {errors.fields.emailAddress && (
          <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.emailAddress.message}</Text>
        )}
        {errors.fields.password && (
          <Text className="mb-3 text-danger dark:text-danger-dark">{errors.fields.password.message}</Text>
        )}
        {!!error && <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text>}
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
        <View className="mt-4">
          <Link href={ROUTES.FEED} replace>
            <Text className="text-muted">Continue without an account</Text>
          </Link>
        </View>
      </KeyboardScrollView>
    </WallView>
  );
}
