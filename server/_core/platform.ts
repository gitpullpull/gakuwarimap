export type DeployMode = "manus" | "external";
export type MapsMode = "forge" | "google";
export type StorageMode = "forge" | "s3" | "disabled";
export type AuthMode = "manus" | "none";

export type SystemCapabilities = {
  deployMode: DeployMode;
  authMode: AuthMode;
  mapsMode: MapsMode;
  storageMode: StorageMode;
  canUploadImages: boolean;
};

export type ForgeConfig = {
  baseUrl: string;
  apiKey: string;
  urlSource: string;
  keySource: string;
};

export type GoogleBrowserMapsConfig = {
  apiKey: string;
  keySource: string;
};

export type S3StorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
};

type EnvShape = NodeJS.ProcessEnv;

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function readFirstEnvValue(
  env: EnvShape,
  keys: string[]
): { value: string; source: string } {
  for (const key of keys) {
    const value = normalizeEnvValue(env[key]);
    if (value) {
      return { value, source: key };
    }
  }

  return {
    value: "",
    source: "unset",
  };
}

export function hasForgeServerConfig(env: EnvShape = process.env): boolean {
  return Boolean(
    normalizeEnvValue(env.BUILT_IN_FORGE_API_URL) &&
      normalizeEnvValue(env.BUILT_IN_FORGE_API_KEY)
  );
}

export function hasGoogleServerMapsConfig(
  env: EnvShape = process.env
): boolean {
  return Boolean(normalizeEnvValue(env.GOOGLE_MAPS_SERVER_API_KEY));
}

function hasCompleteExternalS3Config(env: EnvShape = process.env): boolean {
  return Boolean(
    normalizeEnvValue(env.S3_BUCKET) &&
      normalizeEnvValue(env.S3_REGION) &&
      normalizeEnvValue(env.S3_ACCESS_KEY_ID) &&
      normalizeEnvValue(env.S3_SECRET_ACCESS_KEY) &&
      normalizeEnvValue(env.S3_PUBLIC_BASE_URL)
  );
}

export function resolveDeployMode(env: EnvShape = process.env): DeployMode {
  const requestedMode = normalizeEnvValue(env.DEPLOY_MODE).toLowerCase();

  if (!requestedMode || requestedMode === "auto") {
    if (hasForgeServerConfig(env)) {
      return "manus";
    }

    if (hasGoogleServerMapsConfig(env)) {
      return "external";
    }

    throw new Error(
      "DEPLOY_MODE=auto requires either BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY or GOOGLE_MAPS_SERVER_API_KEY"
    );
  }

  if (requestedMode === "manus") {
    if (!hasForgeServerConfig(env)) {
      throw new Error(
        "DEPLOY_MODE=manus requires BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
      );
    }

    return "manus";
  }

  if (requestedMode === "external") {
    if (!hasGoogleServerMapsConfig(env)) {
      throw new Error(
        "DEPLOY_MODE=external requires GOOGLE_MAPS_SERVER_API_KEY"
      );
    }

    return "external";
  }

  throw new Error(
    `Unsupported DEPLOY_MODE "${env.DEPLOY_MODE}". Use manus, external, or auto.`
  );
}

export function resolveMapsMode(env: EnvShape = process.env): MapsMode {
  return resolveDeployMode(env) === "manus" ? "forge" : "google";
}

export function resolveAuthMode(env: EnvShape = process.env): AuthMode {
  return resolveDeployMode(env) === "manus" ? "manus" : "none";
}

export function resolveStorageMode(env: EnvShape = process.env): StorageMode {
  const deployMode = resolveDeployMode(env);
  if (deployMode === "manus") {
    return "forge";
  }

  const requestedProvider = normalizeEnvValue(env.STORAGE_PROVIDER).toLowerCase();
  if (requestedProvider !== "s3") {
    return "disabled";
  }

  return hasCompleteExternalS3Config(env) ? "s3" : "disabled";
}

export function getSystemCapabilities(
  env: EnvShape = process.env
): SystemCapabilities {
  const deployMode = resolveDeployMode(env);
  const storageMode = resolveStorageMode(env);

  return {
    deployMode,
    authMode: deployMode === "manus" ? "manus" : "none",
    mapsMode: deployMode === "manus" ? "forge" : "google",
    storageMode,
    canUploadImages: storageMode !== "disabled",
  };
}

export function resolveForgeConfig(
  env: EnvShape = process.env
): ForgeConfig {
  const urlConfig = readFirstEnvValue(env, ["BUILT_IN_FORGE_API_URL"]);
  const keyConfig = readFirstEnvValue(env, ["BUILT_IN_FORGE_API_KEY"]);

  if (!urlConfig.value || !keyConfig.value) {
    throw new Error(
      "Forge configuration requires BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return {
    baseUrl: urlConfig.value.replace(/\/+$/, ""),
    apiKey: keyConfig.value,
    urlSource: urlConfig.source,
    keySource: keyConfig.source,
  };
}

export function resolveGoogleBrowserMapsConfig(
  env: EnvShape = process.env
): GoogleBrowserMapsConfig {
  const keyConfig = readFirstEnvValue(env, [
    "VITE_GOOGLE_MAPS_BROWSER_API_KEY",
    "GOOGLE_MAPS_BROWSER_API_KEY",
  ]);

  if (!keyConfig.value) {
    throw new Error(
      "Google Maps browser configuration requires VITE_GOOGLE_MAPS_BROWSER_API_KEY or GOOGLE_MAPS_BROWSER_API_KEY"
    );
  }

  return {
    apiKey: keyConfig.value,
    keySource: keyConfig.source,
  };
}

export function resolveS3StorageConfig(
  env: EnvShape = process.env
): S3StorageConfig {
  if (resolveStorageMode(env) !== "s3") {
    throw new Error(
      "S3 storage is not enabled. Set STORAGE_PROVIDER=s3 and provide the required S3_* variables."
    );
  }

  return {
    bucket: normalizeEnvValue(env.S3_BUCKET),
    region: normalizeEnvValue(env.S3_REGION),
    accessKeyId: normalizeEnvValue(env.S3_ACCESS_KEY_ID),
    secretAccessKey: normalizeEnvValue(env.S3_SECRET_ACCESS_KEY),
    endpoint: normalizeEnvValue(env.S3_ENDPOINT) || undefined,
    forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE),
    publicBaseUrl: normalizeEnvValue(env.S3_PUBLIC_BASE_URL).replace(/\/+$/, ""),
  };
}

export function ensureManusOnlyFeature(
  featureName: string,
  env: EnvShape = process.env
) {
  if (resolveDeployMode(env) !== "manus") {
    throw new Error(
      `${featureName} is not supported in external deploy mode`
    );
  }
}
