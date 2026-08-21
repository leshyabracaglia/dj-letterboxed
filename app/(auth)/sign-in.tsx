import { useSignIn } from "@clerk/expo/legacy";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)/feed");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Could not sign in");
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Text className="mb-8 text-3xl font-bold text-ink">Welcome back</Text>
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
        <Text className="text-center font-semibold text-paper">Sign in</Text>
      </Pressable>
      <Link href="/(auth)/sign-up" className="mt-6 text-muted">
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}
