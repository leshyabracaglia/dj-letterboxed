// Where the marketing site sends people. The app's web version lives on its
// own subdomain; beatboxd.com is this site.
export const SITE_URL = "https://beatboxd.com";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.beatboxd.com";
export const APP_STORE_URL = "https://apps.apple.com/app/id6812424146";

export const TERMS_URL = `${APP_URL}/terms`;
export const PRIVACY_URL = `${APP_URL}/privacy`;
export const SUPPORT_URL = `${APP_URL}/support`;
