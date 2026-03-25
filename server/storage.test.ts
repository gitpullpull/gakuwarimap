import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: class PutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
  S3Client: class S3Client {
    send = sendMock;
  },
}));

import { resolveStorageConfig, storageGet, storagePut } from "./storage";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  sendMock.mockReset();
  vi.unstubAllGlobals();
});

describe("resolveStorageConfig", () => {
  it("uses forge storage in manus mode", () => {
    expect(
      resolveStorageConfig({
        DEPLOY_MODE: "manus",
        BUILT_IN_FORGE_API_URL: "https://forge.example.com",
        BUILT_IN_FORGE_API_KEY: "forge-key",
      })
    ).toEqual({
      mode: "forge",
      baseUrl: "https://forge.example.com",
      apiKey: "forge-key",
    });
  });

  it("uses disabled storage in external mode without S3", () => {
    expect(
      resolveStorageConfig({
        DEPLOY_MODE: "external",
        GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      })
    ).toMatchObject({
      mode: "disabled",
    });
  });
});

describe("storagePut", () => {
  it("uploads through forge in manus mode", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "manus",
      BUILT_IN_FORGE_API_URL: "https://forge.example.com",
      BUILT_IN_FORGE_API_KEY: "forge-key",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://forge.example.com/file.png" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    await expect(storagePut("images/test.png", Buffer.from("hello"), "image/png")).resolves.toEqual({
      key: "images/test.png",
      url: "https://forge.example.com/file.png",
    });
  });

  it("uploads to s3 and returns a public CDN url in external mode", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "external",
      GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "bucket",
      S3_REGION: "ap-northeast-1",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      S3_PUBLIC_BASE_URL: "https://cdn.example.com/assets",
      S3_FORCE_PATH_STYLE: "true",
    };

    sendMock.mockResolvedValue({});

    await expect(storagePut("images/test.png", Buffer.from("hello"), "image/png")).resolves.toEqual({
      key: "images/test.png",
      url: "https://cdn.example.com/assets/images/test.png",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("storageGet", () => {
  it("returns a forge download url", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "manus",
      BUILT_IN_FORGE_API_URL: "https://forge.example.com",
      BUILT_IN_FORGE_API_KEY: "forge-key",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://forge.example.com/download.png" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    await expect(storageGet("images/test.png")).resolves.toEqual({
      key: "images/test.png",
      url: "https://forge.example.com/download.png",
    });
  });

  it("returns a stable public url in external s3 mode", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      DEPLOY_MODE: "external",
      GOOGLE_MAPS_SERVER_API_KEY: "google-key",
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "bucket",
      S3_REGION: "ap-northeast-1",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      S3_PUBLIC_BASE_URL: "https://cdn.example.com/assets",
    };

    await expect(storageGet("images/test.png")).resolves.toEqual({
      key: "images/test.png",
      url: "https://cdn.example.com/assets/images/test.png",
    });
  });
});
