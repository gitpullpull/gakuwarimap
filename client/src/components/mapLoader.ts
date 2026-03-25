type BrowserEnv = Record<string, string | undefined>;

export type MapScriptAttempt = {
  source: "direct" | "proxy";
  provider: "forge" | "google" | "proxy";
  src: string;
};

export const MAPS_VERSION = "weekly";
export const MAPS_LIBRARIES = "marker,places,geocoding,geometry";

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function buildMapsQuery(): string {
  return new URLSearchParams({
    v: MAPS_VERSION,
    libraries: MAPS_LIBRARIES,
  }).toString();
}

export function buildProxyMapScriptUrl(): string {
  return `/api/maps-js?${buildMapsQuery()}`;
}

export function buildForgeMapsJsUrl(baseUrl: string, apiKey: string): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/maps/proxy/maps/api/js`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("v", MAPS_VERSION);
  url.searchParams.set("libraries", MAPS_LIBRARIES);
  return url.toString();
}

export function buildGoogleMapsJsUrl(apiKey: string): string {
  const url = new URL("https://maps.googleapis.com/maps/api/js");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("v", MAPS_VERSION);
  url.searchParams.set("libraries", MAPS_LIBRARIES);
  return url.toString();
}

export function resolveDirectMapScriptCandidate(
  env: BrowserEnv = import.meta.env as BrowserEnv
): MapScriptAttempt | null {
  const forgeApiUrl = normalizeEnvValue(env.VITE_FRONTEND_FORGE_API_URL);
  const forgeApiKey = normalizeEnvValue(env.VITE_FRONTEND_FORGE_API_KEY);

  if (forgeApiUrl && forgeApiKey) {
    return {
      source: "direct",
      provider: "forge",
      src: buildForgeMapsJsUrl(forgeApiUrl, forgeApiKey),
    };
  }

  const googleApiKey = normalizeEnvValue(
    env.VITE_GOOGLE_MAPS_BROWSER_API_KEY || env.GOOGLE_MAPS_BROWSER_API_KEY
  );

  if (googleApiKey) {
    return {
      source: "direct",
      provider: "google",
      src: buildGoogleMapsJsUrl(googleApiKey),
    };
  }

  return null;
}

export function resolveMapScriptAttempts(
  env: BrowserEnv = import.meta.env as BrowserEnv
): MapScriptAttempt[] {
  const directAttempt = resolveDirectMapScriptCandidate(env);
  const fallbackAttempt: MapScriptAttempt = {
    source: "proxy",
    provider: "proxy",
    src: buildProxyMapScriptUrl(),
  };

  return directAttempt ? [directAttempt, fallbackAttempt] : [fallbackAttempt];
}

export function resolveMapId(
  env: BrowserEnv = import.meta.env as BrowserEnv
): string {
  return normalizeEnvValue(env.VITE_GOOGLE_MAP_ID) || "DEMO_MAP_ID";
}
