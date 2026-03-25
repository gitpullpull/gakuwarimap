import { describe, expect, it } from "vitest";
import { resolveMapsJsConfig, resolveMapsRequestOrigin } from "./index";

describe("resolveMapsJsConfig", () => {
  it("prefers frontend forge values in manus mode", () => {
    const config = resolveMapsJsConfig({
      DEPLOY_MODE: "manus",
      VITE_FRONTEND_FORGE_API_URL: "https://frontend.example.com/",
      BUILT_IN_FORGE_API_URL: "https://builtin.example.com",
      VITE_FRONTEND_FORGE_API_KEY: "frontend-key",
      BUILT_IN_FORGE_API_KEY: "builtin-key",
    });

    expect(config).toEqual({
      mapsMode: "forge",
      upstreamBaseUrl:
        "https://frontend.example.com/v1/maps/proxy/maps/api/js",
      apiKey: "frontend-key",
      urlSource: "VITE_FRONTEND_FORGE_API_URL",
      keySource: "VITE_FRONTEND_FORGE_API_KEY",
      fallbackPath: "forge-proxy",
    });
  });

  it("falls back to built-in forge values in manus mode", () => {
    const config = resolveMapsJsConfig({
      DEPLOY_MODE: "manus",
      BUILT_IN_FORGE_API_URL: "https://builtin.example.com/",
      BUILT_IN_FORGE_API_KEY: "builtin-key",
    });

    expect(config.upstreamBaseUrl).toBe(
      "https://builtin.example.com/v1/maps/proxy/maps/api/js"
    );
    expect(config.keySource).toBe("BUILT_IN_FORGE_API_KEY");
  });

  it("uses google browser keys in external mode", () => {
    const config = resolveMapsJsConfig({
      DEPLOY_MODE: "external",
      GOOGLE_MAPS_SERVER_API_KEY: "server-key",
      VITE_GOOGLE_MAPS_BROWSER_API_KEY: "browser-key",
    });

    expect(config).toEqual({
      mapsMode: "google",
      upstreamBaseUrl: "https://maps.googleapis.com/maps/api/js",
      apiKey: "browser-key",
      urlSource: "google-official",
      keySource: "VITE_GOOGLE_MAPS_BROWSER_API_KEY",
      fallbackPath: "google-proxy",
    });
  });

  it("never falls back to the google server key for browser js", () => {
    expect(() =>
      resolveMapsJsConfig({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "server-key",
      })
    ).toThrow(
      "Google Maps browser configuration requires VITE_GOOGLE_MAPS_BROWSER_API_KEY or GOOGLE_MAPS_BROWSER_API_KEY"
    );
  });
});

describe("resolveMapsRequestOrigin", () => {
  it("prefers the Origin header", () => {
    expect(
      resolveMapsRequestOrigin({
        origin: "https://origin.example.com",
        referer: "https://referer.example.com/page",
        protocol: "http",
        host: "localhost:3000",
      })
    ).toBe("https://origin.example.com");
  });

  it("falls back to Referer origin", () => {
    expect(
      resolveMapsRequestOrigin({
        referer: "https://referer.example.com/path?q=1",
        protocol: "http",
        host: "localhost:3000",
      })
    ).toBe("https://referer.example.com");
  });

  it("falls back to forwarded proto and host", () => {
    expect(
      resolveMapsRequestOrigin({
        forwardedProto: "https",
        forwardedHost: "proxy.example.com",
        protocol: "http",
        host: "localhost:3000",
      })
    ).toBe("https://proxy.example.com");
  });

  it("falls back to protocol and host", () => {
    expect(
      resolveMapsRequestOrigin({
        protocol: "http",
        host: "localhost:3000",
      })
    ).toBe("http://localhost:3000");
  });
});
