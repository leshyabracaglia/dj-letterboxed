import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, FormMessage, Text, TextField } from "@/components/ui";

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
      <AuthScreen
        title={isSignInCode ? "Check your email" : "Verify it's you"}
        subtitle={
          isSignInCode ? (
            <>We sent a sign-in code to {email.trim()}.</>
          ) : (
            <>We sent a code to {email.trim()} to confirm this new device.</>
          )
        }
      >
        <TextField
          placeholder={isSignInCode ? "Sign-in code" : "Verification code"}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
          className="w-full"
        />
        <FormMessage>{error}</FormMessage>
        <Button onPress={onVerify} disabled={busy} className="w-full py-3">
          <Text className="text-center font-semibold text-paper">{isSignInCode ? "Sign in" : "Verify"}</Text>
        </Button>
        {isSignInCode && (
          <View className="mt-3 items-center gap-4">
            <Pressable onPress={sendSignInCode} disabled={busy}>
              <Text className="text-primary-dark">Resend code</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError(null);
                setCodeStep(null);
              }}
            >
              <Text className="text-muted">Use your password instead</Text>
            </Pressable>
          </View>
        )}
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
      <Button onPress={onSubmit} disabled={busy} className="w-full py-3">
        <Text className="text-center font-semibold text-paper">Sign in</Text>
      </Button>
      <Pressable onPress={sendSignInCode} disabled={busy} className="mt-3">
        <Text className="text-primary-dark">Email me a sign-in code instead</Text>
      </Pressable>
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
