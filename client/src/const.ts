export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type ClientAuthMode = "manus" | "none";

export const getAuthModeFromEnv = (): ClientAuthMode => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();

  return oauthPortalUrl && appId ? "manus" : "none";
};

export const isLoginEnabled = () => getAuthModeFromEnv() === "manus";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (): string | null => {
  if (typeof window === "undefined" || !isLoginEnabled()) {
    return null;
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
