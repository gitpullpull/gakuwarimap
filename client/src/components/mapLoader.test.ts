import { describe, expect, it } from "vitest";
import {
  buildProxyMapScriptUrl,
  resolveDirectMapScriptCandidate,
  resolveMapId,
  resolveMapScriptAttempts,
} from "./mapLoader";

describe("resolveDirectMapScriptCandidate", () => {
  it("prefers forge direct loading when manus browser envs exist", () => {
    expect(
      resolveDirectMapScriptCandidate({
        VITE_FRONTEND_FORGE_API_URL: "https://forge.example.com",
        VITE_FRONTEND_FORGE_API_KEY: "forge-key",
        VITE_GOOGLE_MAPS_BROWSER_API_KEY: "google-key",
      })
    ).toEqual({
      source: "direct",
      provider: "forge",
      src: "https://forge.example.com/v1/maps/proxy/maps/api/js?key=forge-key&v=weekly&libraries=marker%2Cplaces%2Cgeocoding%2Cgeometry",
    });
  });

  it("uses google direct loading when only google browser envs exist", () => {
    expect(
      resolveDirectMapScriptCandidate({
        VITE_GOOGLE_MAPS_BROWSER_API_KEY: "google-key",
      })
    ).toEqual({
      source: "direct",
      provider: "google",
      src: "https://maps.googleapis.com/maps/api/js?key=google-key&v=weekly&libraries=marker%2Cplaces%2Cgeocoding%2Cgeometry",
    });
  });

  it("returns null when no direct config exists", () => {
    expect(resolveDirectMapScriptCandidate({})).toBeNull();
  });
});

describe("resolveMapScriptAttempts", () => {
  it("keeps /api/maps-js as the fallback", () => {
    expect(resolveMapScriptAttempts({})).toEqual([
      {
        source: "proxy",
        provider: "proxy",
        src: buildProxyMapScriptUrl(),
      },
    ]);
  });
});

describe("resolveMapId", () => {
  it("uses the configured map id when present", () => {
    expect(resolveMapId({ VITE_GOOGLE_MAP_ID: "custom-map-id" })).toBe(
      "custom-map-id"
    );
  });

  it("falls back to the default demo map id", () => {
    expect(resolveMapId({})).toBe("DEMO_MAP_ID");
  });
});
