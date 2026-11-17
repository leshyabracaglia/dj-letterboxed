import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AuthBrand, AuthButton, AuthField, AuthTitle, WallPanelScreen } from "@/components/auth/parts";
import { FormMessage, Text } from "@/components/ui";

import { clerkErrorMessage } from "@/lib/clerk";
import { ROUTES } from "@/lib/routes";

// Which emailed code the code screen is waiting for: a one-time code to sign
// in without a password, or Clerk's second-factor / new-device check.
type CodeStep = "sign_in" | "mfa";

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";

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

  // After a first factor (password or emailed code) is accepted: finish, or
  // move on to the emailed second-factor / new-device check.
  const continueSignIn = async () => {
    if (signIn.status === "complete") {
      await navigateAfterAuth();
    } else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const emailFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === "email_code");
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        setCode("");
        setCodeStep("mfa");
      } else {
        setError("This sign-in needs verification we don't support yet.");
      }
    }
  };

  const onSubmit = async () => {
    setError(null);
    const { error: submitError } = await signIn.password({
      identifier: email,
      password,
    });
    if (submitError) return;
    await continueSignIn();
  };

  const sendSignInCode = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }
    const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
    if (sendError) {
      setError(clerkErrorMessage(sendError));
      return;
    }
    setCode("");
    setCodeStep("sign_in");
  };

  const onVerify = async () => {
    setError(null);
    const { error: verifyError } =
      codeStep === "sign_in"
        ? await signIn.emailCode.verifyCode({ code: code.trim() })
        : await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (verifyError) {
      setError(clerkErrorMessage(verifyError));
      return;
    }
    await continueSignIn();
  };

  if (codeStep) {
    const isSignInCode = codeStep === "sign_in";
    return (
      <WallPanelScreen>
        <AuthBrand />
        <AuthTitle className="text-[52px] leading-[48px]">
          {isSignInCode ? "Check your email" : "Verify it's you"}
        </AuthTitle>
        <Text className="text-zine-purple-ink">
          {isSignInCode
            ? `We sent a sign-in code to ${email.trim()}.`
            : `We sent a code to ${email.trim()} to confirm this new device.`}
        </Text>
        <AuthField
          label={isSignInCode ? "Sign-in code" : "Verification code"}
          labelClassName="text-zine-purple-ink"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
        />
        <FormMessage>{error}</FormMessage>
        <AuthButton label={isSignInCode ? "Sign in" : "Verify"} onPress={onVerify} disabled={busy} />
        {isSignInCode && (
          <View className="items-center gap-4 pt-2">
            <Pressable onPress={sendSignInCode} disabled={busy}>
              <Text className="text-paper">Resend code</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError(null);
                setCodeStep(null);
              }}
            >
              <Text className="text-zine-purple-ink">Use your password instead</Text>
            </Pressable>
          </View>
        )}
      </WallPanelScreen>
    );
  }

  return (
    <WallPanelScreen>
      <AuthBrand />
      <AuthTitle className="text-[52px] leading-[48px]">Welcome back</AuthTitle>
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
      <AuthField
        label="Password"
        labelClassName="text-zine-purple-ink"
        aside={
          <Link href={ROUTES.FORGOT_PASSWORD(email.trim() ? { email: email.trim() } : undefined)}>
            <Text className="text-sm text-paper">Forgot?</Text>
          </Link>
        }
        secureTextEntry
        autoComplete="password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
      />
      <FormMessage>{errors.fields.identifier?.message}</FormMessage>
      <FormMessage>{errors.fields.password?.message}</FormMessage>
      <FormMessage>{error}</FormMessage>
      <View className="pt-1">
        <AuthButton label="Sign in" onPress={onSubmit} disabled={busy} />
      </View>
      <Pressable onPress={sendSignInCode} disabled={busy} className="items-center py-1">
        <Text className="text-sm text-paper">Email me a sign-in code instead</Text>
      </Pressable>
      <View className="mt-4 flex-row justify-between border-t border-white/25 pt-3">
        <Link href={ROUTES.SIGN_UP}>
          <Text className="text-sm text-paper">
            New here? <Text className="font-bold text-sm text-paper">Sign up</Text>
          </Text>
        </Link>
        <Link href={ROUTES.FEED} replace>
          <Text className="text-sm text-zine-purple-ink">Just browse</Text>
        </Link>
      </View>
    </WallPanelScreen>
  );
}
