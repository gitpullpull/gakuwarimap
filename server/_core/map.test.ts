import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest, resolveMapsServiceConfig } from "./map";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("resolveMapsServiceConfig", () => {
  it("builds forge config in manus mode", () => {
    expect(
      resolveMapsServiceConfig({
        DEPLOY_MODE: "manus",
        BUILT_IN_FORGE_API_URL: "https://forge.example.com/",
        BUILT_IN_FORGE_API_KEY: "forge-key",
      })
    ).toEqual({
      mapsMode: "forge",
      baseUrl: "https://forge.example.com",
      apiKey: "forge-key",
    });
  });

  it("builds google config in external mode", () => {
    expect(
      resolveMapsServiceConfig({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      })
    ).toEqual({
      mapsMode: "google",
      baseUrl: "https://maps.googleapis.com",
      apiKey: "google-key",
    });
  });
});

describe("makeRequest", () => {
  it("uses the forge proxy path in manus mode", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "manus",
      BUILT_IN_FORGE_API_URL: "https://forge.example.com",
      BUILT_IN_FORGE_API_KEY: "forge-key",
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await makeRequest("/maps/api/place/nearbysearch/json", {
      location: "35.0,139.0",
      radius: 500,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://forge.example.com/v1/maps/proxy/maps/api/place/nearbysearch/json?key=forge-key&location=35.0%2C139.0&radius=500",
      expect.any(Object)
    );
  });

  it("uses the direct google endpoint in external mode", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "external",
      GOOGLE_MAPS_SERVER_API_KEY: "google-key",
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await makeRequest("/maps/api/place/details/json", {
      place_id: "place-1",
      language: "ja",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://maps.googleapis.com/maps/api/place/details/json?key=google-key&place_id=place-1&language=ja",
      expect.any(Object)
    );
  });
});
