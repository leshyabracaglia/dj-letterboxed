# beatboxd.com — the marketing site

A single static, SEO-first landing page (Next.js App Router), separate from
the Expo app. It lives at **beatboxd.com**; the app's web version lives at
**app.beatboxd.com**.

```
npm --prefix site install
npm --prefix site run dev        # http://localhost:3100
npm --prefix site run build
npm --prefix site run typecheck
```

It's its own npm project (own `node_modules`, its own React): the root
`tsconfig.json`, ESLint config and Metro all skip `site/`.

## What's in it

- `app/page.tsx` — the page: hero with a write-up card, "what happened at
  4am", the record (write-ups), track IDs, profile, passport stamps, the
  three points (DJ pages, no editors, free), call to action.
- `app/layout.tsx` — fonts (Jersey 10 + Roboto via `next/font`), title,
  description, canonical URL, Open Graph/Twitter cards (`public/og.png`), the
  App Store smart banner (`itunes.appId`) and `MobileApplication` structured
  data. The page adds `FAQPage` structured data for "Is BeatBox'd free?".
- `app/sitemap.ts`, `app/robots.ts`, `app/icon.png`, `app/apple-icon.png`.
- `next.config.ts` — redirects every path the app serves (`/feed`, `/dj/…`,
  `/review/…`, `/privacy`, `/support`, …) to app.beatboxd.com, since
  beatboxd.com used to be the app and those links are out there (App Store
  Connect's privacy and support URLs, links on shared story images).
- `public/` — the concrete wall, the night photos, the logo and `og.png`
  (copied from the app's `assets/`; re-copy them if those change).

## Deploying (one time)

1. In Vercel, create a new project from this repo with **Root Directory
   `site`** (framework: Next.js).
2. Move the domains: point **app.beatboxd.com** at the existing Expo web
   project, then move **beatboxd.com** (and www) to this project.
3. In Clerk's production instance, add `https://app.beatboxd.com` to the
   allowed origins / redirect URLs if it isn't covered already.
4. Optionally set `EXPO_PUBLIC_WEB_URL=https://app.beatboxd.com` for app
   builds and `WEB_URL=https://app.beatboxd.com` on the API, so share-image
   and report-email links skip the redirect. Leaving them on beatboxd.com
   works too.
5. App Store Connect's privacy and support URLs can stay on beatboxd.com
   (they redirect), or be changed to app.beatboxd.com.
