import { useSignUp } from "@clerk/expo/legacy";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Could not sign up");
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)/feed");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Invalid code");
    }
  };

  if (pendingVerification) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Text className="mb-8 text-3xl font-bold text-ink">Check your email</Text>
        <TextInput
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          className="mb-4 w-full rounded-lg border border-muted/30 bg-white px-4 py-3"
        />
        {error ? <Text className="mb-3 text-accent">{error}</Text> : null}
        <Pressable onPress={onVerify} className="w-full rounded-lg bg-ink py-3">
          <Text className="text-center font-semibold text-paper">Verify</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Text className="mb-8 text-3xl font-bold text-ink">Create your account</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mb-3 w-full rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        className="mb-4 w-full rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      {error ? <Text className="mb-3 text-accent">{error}</Text> : null}
      <Pressable onPress={onSubmit} className="w-full rounded-lg bg-ink py-3">
        <Text className="text-center font-semibold text-paper">Sign up</Text>
      </Pressable>
      <Link href="/(auth)/sign-in" className="mt-6 text-muted">
        Already have an account? Sign in
      </Link>
    </View>
  );
}
