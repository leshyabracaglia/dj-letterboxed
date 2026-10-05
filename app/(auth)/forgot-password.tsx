import { useSignIn } from "@clerk/expo";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, KeyboardScrollView, Text } from "../../components/ui";

import { ROUTES } from "../../lib/routes";

const inputClassName =
  "mb-3 w-full max-w-sm rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted";

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";

  const sendCode = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter the email on your account");
      return;
    }
    const { error: createError } = await signIn.create({ identifier: email.trim() });
    if (createError) {
      setError(createError.longMessage ?? createError.message);
      return;
    }
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) {
      setError(sendError.longMessage ?? sendError.message);
      return;
    }
    setCode("");
    setCodeSent(true);
  };

  const onReset = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Enter the code from your email");
      return;
    }
    if (!password) {
      setError("Enter a new password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    // The code only needs verifying once; on a retry after a rejected
    // password the sign-in is already waiting for the new password.
    if (signIn.status !== "needs_new_password") {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.longMessage ?? verifyError.message);
        return;
      }
    }
    const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });
    if (submitError) {
      setError(submitError.longMessage ?? submitError.message);
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl(ROUTES.FEED as string);
          if (url.startsWith("http")) window.location.href = url;
          else router.replace(ROUTES.FEED);
        },
      });
    } else {
      // e.g. a second factor is required — the password is already changed,
      // so the regular sign-in flow can take it from here.
      router.replace(ROUTES.SIGN_IN);
    }
  };

  if (codeSent) {
    return (
      <KeyboardScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="flex-grow items-center justify-center px-6"
      >
        <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Reset password</Text>
        <Text className="mb-4 text-center text-muted">
          We sent a code to {email.trim()}. Enter it below with your new password.
        </Text>
        <TextInput
          placeholder="Reset code"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
          className={inputClassName}
        />
        <TextInput
          secureTextEntry
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          className={inputClassName}
        />
        <TextInput
          secureTextEntry
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          className={inputClassName}
        />
        {!!error && <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text>}
        <Button onPress={onReset} disabled={busy} className="mt-1 w-full max-w-sm py-3">
          <Text className="text-center font-semibold text-paper">
            {busy ? "Resetting..." : "Reset password"}
          </Text>
        </Button>
        <Pressable onPress={sendCode} disabled={busy} className="mt-6">
          <Text className="text-primary dark:text-primary-dark">Resend code</Text>
        </Pressable>
      </KeyboardScrollView>
    );
  }

  return (
    <KeyboardScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="flex-grow items-center justify-center px-6"
    >
      <Text className="mb-8 text-4xl font-display text-ink dark:text-paper">Forgot password</Text>
      <Text className="mb-4 text-center text-muted">
        Enter the email on your account and we&apos;ll send you a code to reset your password.
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className={inputClassName}
      />
      {!!error && <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text>}
      <Button onPress={sendCode} disabled={busy} className="mt-1 w-full max-w-sm py-3">
        <Text className="text-center font-semibold text-paper">
          {busy ? "Sending..." : "Send reset code"}
        </Text>
      </Button>
      <View className="mt-10">
        <Link href={ROUTES.SIGN_IN}>
          <Text className="text-primary dark:text-primary-dark">Back to sign in</Text>
        </Link>
      </View>
    </KeyboardScrollView>
  );
}
