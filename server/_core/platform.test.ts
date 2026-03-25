import { describe, expect, it } from "vitest";
import {
  getSystemCapabilities,
  resolveDeployMode,
  resolveStorageMode,
} from "./platform";

describe("resolveDeployMode", () => {
  it("prefers manus in auto mode when forge credentials exist", () => {
    expect(
      resolveDeployMode({
        DEPLOY_MODE: "auto",
        BUILT_IN_FORGE_API_URL: "https://forge.example.com",
        BUILT_IN_FORGE_API_KEY: "forge-key",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      })
    ).toBe("manus");
  });

  it("chooses external in auto mode when only google server credentials exist", () => {
    expect(
      resolveDeployMode({
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      })
    ).toBe("external");
  });

  it("fails fast for invalid manus config", () => {
    expect(() => resolveDeployMode({ DEPLOY_MODE: "manus" })).toThrow(
      "DEPLOY_MODE=manus requires BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  });

  it("fails fast for invalid external config", () => {
    expect(() => resolveDeployMode({ DEPLOY_MODE: "external" })).toThrow(
      "DEPLOY_MODE=external requires GOOGLE_MAPS_SERVER_API_KEY"
    );
  });
});

describe("resolveStorageMode", () => {
  it("returns disabled in external mode when S3 config is incomplete", () => {
    expect(
      resolveStorageMode({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
        STORAGE_PROVIDER: "s3",
      })
    ).toBe("disabled");
  });

  it("returns s3 in external mode when public CDN config is complete", () => {
    expect(
      resolveStorageMode({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "bucket",
        S3_REGION: "ap-northeast-1",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_PUBLIC_BASE_URL: "https://cdn.example.com/assets",
      })
    ).toBe("s3");
  });
});

describe("getSystemCapabilities", () => {
  it("returns the fixed capability shape for manus", () => {
    expect(
      getSystemCapabilities({
        DEPLOY_MODE: "manus",
        BUILT_IN_FORGE_API_URL: "https://forge.example.com",
        BUILT_IN_FORGE_API_KEY: "forge-key",
      })
    ).toEqual({
      deployMode: "manus",
      authMode: "manus",
      mapsMode: "forge",
      storageMode: "forge",
      canUploadImages: true,
    });
  });

  it("returns disabled upload capability for external without S3", () => {
    expect(
      getSystemCapabilities({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      })
    ).toEqual({
      deployMode: "external",
      authMode: "none",
      mapsMode: "google",
      storageMode: "disabled",
      canUploadImages: false,
    });
  });
});
