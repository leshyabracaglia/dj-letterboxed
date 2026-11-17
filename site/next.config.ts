import type { NextConfig } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.beatboxd.com";

// Every path the app's web version serves. beatboxd.com used to be the app,
// so links to these are out there (App Store Connect's privacy and support
// links, the review links on shared story images): send them to the app.
const APP_PATHS = [
  "/feed",
  "/browse",
  "/review",
  "/profile",
  "/notifications",
  "/settings",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/onboarding",
  "/privacy",
  "/terms",
  "/support",
];
const APP_PREFIXES = ["/review", "/dj", "/event", "/venue", "/user", "/list"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...APP_PATHS.map((path) => ({ source: path, destination: `${APP_URL}${path}`, permanent: false })),
      ...APP_PREFIXES.map((prefix) => ({
        source: `${prefix}/:rest*`,
        destination: `${APP_URL}${prefix}/:rest*`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
