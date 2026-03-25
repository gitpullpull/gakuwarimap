import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import net from "net";
import { appRouter } from "../routers";
import { createContext } from "./context";
import {
  getSystemCapabilities,
  readFirstEnvValue,
  resolveAuthMode,
  resolveDeployMode,
  resolveGoogleBrowserMapsConfig,
} from "./platform";
import { serveStatic, setupVite } from "./vite";

type HeaderValue = string | string[] | undefined;

type ResolvedMapsJsConfig = {
  mapsMode: "forge" | "google";
  upstreamBaseUrl: string;
  apiKey: string;
  urlSource: string;
  keySource: string;
  fallbackPath: string;
};

type ResolveOriginInput = {
  origin?: HeaderValue;
  referer?: HeaderValue;
  forwardedProto?: HeaderValue;
  forwardedHost?: HeaderValue;
  protocol?: string;
  host?: HeaderValue;
};

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function normalizeHeaderValue(value: HeaderValue): string {
  if (Array.isArray(value)) {
    return normalizeHeaderValue(value[0]);
  }

  if (!value) {
    return "";
  }

  return value.split(",")[0]?.trim() || "";
}

export function resolveMapsJsConfig(
  env: NodeJS.ProcessEnv = process.env
): ResolvedMapsJsConfig {
  const deployMode = resolveDeployMode(env);

  if (deployMode === "manus") {
    const urlConfig = readFirstEnvValue(env, [
      "VITE_FRONTEND_FORGE_API_URL",
      "BUILT_IN_FORGE_API_URL",
    ]);
    const keyConfig = readFirstEnvValue(env, [
      "VITE_FRONTEND_FORGE_API_KEY",
      "BUILT_IN_FORGE_API_KEY",
    ]);

    return {
      mapsMode: "forge",
      upstreamBaseUrl: `${urlConfig.value.replace(/\/+$/, "")}/v1/maps/proxy/maps/api/js`,
      apiKey: keyConfig.value,
      urlSource: urlConfig.source,
      keySource: keyConfig.source,
      fallbackPath: "forge-proxy",
    };
  }

  const browserConfig = resolveGoogleBrowserMapsConfig(env);

  return {
    mapsMode: "google",
    upstreamBaseUrl: "https://maps.googleapis.com/maps/api/js",
    apiKey: browserConfig.apiKey,
    urlSource: "google-official",
    keySource: browserConfig.keySource,
    fallbackPath: "google-proxy",
  };
}

export function resolveMapsRequestOrigin(input: ResolveOriginInput): string {
  const originHeader = normalizeHeaderValue(input.origin);
  if (originHeader) {
    return originHeader;
  }

  const referer = normalizeHeaderValue(input.referer);
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // Ignore invalid referer values.
    }
  }

  const forwardedProto = normalizeHeaderValue(input.forwardedProto);
  const forwardedHost = normalizeHeaderValue(input.forwardedHost);
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const protocol = input.protocol?.trim();
  const host = normalizeHeaderValue(input.host);
  if (protocol && host) {
    return `${protocol}://${host}`;
  }

  return "";
}

async function startServer() {
  const capabilities = getSystemCapabilities();
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  if (resolveAuthMode() === "manus") {
    const { registerOAuthRoutes } = await import("./oauth");
    registerOAuthRoutes(app);
  }

  app.get("/api/maps-js", async (req, res) => {
    const origin = resolveMapsRequestOrigin({
      origin: req.headers.origin,
      referer: req.headers.referer,
      forwardedProto: req.headers["x-forwarded-proto"],
      forwardedHost: req.headers["x-forwarded-host"],
      protocol: req.protocol,
      host: req.headers.host,
    });

    let config: ResolvedMapsJsConfig;
    try {
      config = resolveMapsJsConfig();
    } catch (error) {
      console.error(
        `[Maps JS Proxy] Missing config origin=${origin || "unknown"} mode=${capabilities.mapsMode}`,
        error
      );
      res.status(500).send("Maps proxy not configured");
      return;
    }

    const libraries =
      (req.query.libraries as string) || "marker,places,geocoding,geometry";
    const version = (req.query.v as string) || "weekly";

    const upstreamUrl = new URL(config.upstreamBaseUrl);
    upstreamUrl.searchParams.set("key", config.apiKey);
    upstreamUrl.searchParams.set("v", version);
    upstreamUrl.searchParams.set("libraries", libraries);

    try {
      const headers: Record<string, string> = {
        Accept: "application/javascript",
      };
      if (origin) {
        headers.Origin = origin;
      }

      console.log(
        `[Maps JS Proxy] Requesting path=${config.fallbackPath} origin=${origin || "unknown"} mode=${config.mapsMode} urlSource=${config.urlSource} keySource=${config.keySource}`
      );

      const response = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();

      if (!response.ok) {
        console.error(
          `[Maps JS Proxy] Request failed path=${config.fallbackPath} origin=${origin || "unknown"} mode=${config.mapsMode} status=${response.status}`
        );
        res.status(response.status).send(body);
        return;
      }

      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/javascript"
      );
      res.setHeader(
        "Cache-Control",
        response.headers.get("cache-control") || "public, max-age=3600"
      );
      res.send(body);
    } catch (error) {
      console.error(
        `[Maps JS Proxy] Error path=${config.fallbackPath} origin=${origin || "unknown"} mode=${config.mapsMode}`,
        error
      );
      res.status(500).send("Failed to load Maps script");
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(
      `[Platform] deployMode=${capabilities.deployMode} authMode=${capabilities.authMode} mapsMode=${capabilities.mapsMode} storageMode=${capabilities.storageMode}`
    );
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  void startServer().catch(console.error);
}
