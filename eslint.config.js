// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

// The conventions in CLAUDE.md that a linter can check, so they're enforced
// rather than remembered.
const PARENT_IMPORT = {
  regex: "^\\.\\./",
  message: 'Import across folders through the "@/" alias, not "../".',
};
const RAW_ICONS = {
  name: "@expo/vector-icons",
  message: "Use Icon from components/ui (it takes a className color).",
};
const RAW_CLERK_AUTH = {
  name: "@clerk/expo",
  importNames: ["useAuth"],
  message: "Read the session with useCurrentUser() from lib/auth; sign out with useSignOut() from lib/push.",
};

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      "dist/*",
      ".expo/*",
      ".agents/*",
      "server/*",
      "infra/*",
      "lib/api/generated.ts",
      "playwright-report/*",
      "test-results/*",
    ],
  },
  {
    rules: {
      "no-restricted-imports": ["error", { paths: [RAW_ICONS, RAW_CLERK_AUTH], patterns: [PARENT_IMPORT] }],
    },
  },
  // Unused imports and variables fail lint rather than piling up as
  // warnings. Prefix a deliberately unused argument with _.
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": require("@typescript-eslint/eslint-plugin") },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
    },
  },
  // The wrappers themselves.
  {
    files: ["components/ui/Icon.tsx"],
    rules: { "no-restricted-imports": ["error", { paths: [RAW_CLERK_AUTH], patterns: [PARENT_IMPORT] }] },
  },
  {
    files: ["lib/**"],
    rules: { "no-restricted-imports": ["error", { paths: [RAW_ICONS], patterns: [PARENT_IMPORT] }] },
  },
]);
