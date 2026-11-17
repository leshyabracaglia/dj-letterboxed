import { useSignIn } from "@clerk/expo";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AuthBrand, AuthButton, AuthField, AuthTitle, WallPanelScreen } from "@/components/auth/parts";
import { FormMessage, Text } from "@/components/ui";

import { clerkErrorMessage } from "@/lib/clerk";
import { ROUTES } from "@/lib/routes";

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
      setError(clerkErrorMessage(createError));
      return;
    }
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) {
      setError(clerkErrorMessage(sendError));
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
        setError(clerkErrorMessage(verifyError));
        return;
      }
    }
    const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });
    if (submitError) {
      setError(clerkErrorMessage(submitError));
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl(ROUTES.FEED as string);
          if (url.startsWith("http")) window.location.href = url;
          else router.dismissTo(ROUTES.FEED);
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
      <WallPanelScreen>
        <AuthBrand />
        <AuthTitle className="text-[52px] leading-[48px]">Reset password</AuthTitle>
        <Text className="text-zine-purple-ink">
          We sent a code to {email.trim()}. Enter it below with your new password.
        </Text>
        <AuthField
          label="Reset code"
          labelClassName="text-zine-purple-ink"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
        />
        <AuthField
          label="New password"
          labelClassName="text-zine-purple-ink"
          secureTextEntry
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
        />
        <AuthField
          label="Confirm new password"
          labelClassName="text-zine-purple-ink"
          secureTextEntry
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <FormMessage>{error}</FormMessage>
        <View className="pt-1">
          <AuthButton label={busy ? "Resetting…" : "Reset password"} onPress={onReset} disabled={busy} />
        </View>
        <Pressable onPress={sendCode} disabled={busy} className="items-center py-1">
          <Text className="text-sm text-paper">Resend code</Text>
        </Pressable>
      </WallPanelScreen>
    );
  }

  return (
    <WallPanelScreen>
      <AuthBrand />
      <AuthTitle className="text-[52px] leading-[48px]">Forgot password</AuthTitle>
      <Text className="text-zine-purple-ink">
        Enter the email on your account and we&apos;ll send you a code to reset your password.
      </Text>
      <AuthField
        label="Email"
        labelClassName="text-zine-purple-ink"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
      />
      <FormMessage>{error}</FormMessage>
      <View className="pt-1">
        <AuthButton label={busy ? "Sending…" : "Send reset code"} onPress={sendCode} disabled={busy} />
      </View>
      <View className="mt-4 border-t border-white/25 pt-3">
        <Link href={ROUTES.SIGN_IN}>
          <Text className="text-sm text-paper">Back to sign in</Text>
        </Link>
      </View>
    </WallPanelScreen>
  );
}
