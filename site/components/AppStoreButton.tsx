import { APP_STORE_URL } from "@/lib/links";

/** The white "Download on the App Store" key. */
export function AppStoreButton({ className = "" }: { className?: string }) {
  return (
    <a className={`button-white ${className}`} href={APP_STORE_URL} rel="noopener">
      Download on the App Store
    </a>
  );
}
