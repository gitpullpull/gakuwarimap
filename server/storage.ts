import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  resolveDeployMode,
  resolveForgeConfig,
  resolveS3StorageConfig,
  resolveStorageMode,
} from "./_core/platform";

type ForgeStorageConfig = {
  mode: "forge";
  baseUrl: string;
  apiKey: string;
};

type S3ProviderConfig = {
  mode: "s3";
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
};

type DisabledStorageConfig = {
  mode: "disabled";
  reason: string;
};

type StorageConfig = ForgeStorageConfig | S3ProviderConfig | DisabledStorageConfig;

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildPublicUrl(baseUrl: string, relKey: string): string {
  return new URL(normalizeKey(relKey), ensureTrailingSlash(baseUrl)).toString();
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage download URL request failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  return (await response.json()).url;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function createS3Client(config = resolveS3StorageConfig()): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function resolveStorageConfig(
  env: NodeJS.ProcessEnv = process.env
): StorageConfig {
  const deployMode = resolveDeployMode(env);

  if (deployMode === "manus") {
    const forgeConfig = resolveForgeConfig(env);
    return {
      mode: "forge",
      baseUrl: forgeConfig.baseUrl,
      apiKey: forgeConfig.apiKey,
    };
  }

  if (resolveStorageMode(env) !== "s3") {
    return {
      mode: "disabled",
      reason:
        "Image upload is disabled in external mode. Set STORAGE_PROVIDER=s3 and provide S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL.",
    };
  }

  const s3Config = resolveS3StorageConfig(env);
  return {
    mode: "s3",
    client: createS3Client(s3Config),
    bucket: s3Config.bucket,
    publicBaseUrl: s3Config.publicBaseUrl,
  };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = resolveStorageConfig();
  const key = normalizeKey(relKey);

  if (config.mode === "disabled") {
    throw new Error(config.reason);
  }

  if (config.mode === "forge") {
    const uploadUrl = buildUploadUrl(config.baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(config.apiKey),
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage upload failed (${response.status} ${response.statusText}): ${message}`
      );
    }

    const url = (await response.json()).url;
    return { key, url };
  }

  const body =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: buildPublicUrl(config.publicBaseUrl, key),
  };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const config = resolveStorageConfig();
  const key = normalizeKey(relKey);

  if (config.mode === "disabled") {
    throw new Error(config.reason);
  }

  if (config.mode === "forge") {
    return {
      key,
      url: await buildDownloadUrl(config.baseUrl, key, config.apiKey),
    };
  }

  return {
    key,
    url: buildPublicUrl(config.publicBaseUrl, key),
  };
}
