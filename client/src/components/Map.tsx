/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";
import { resolveMapId, resolveMapScriptAttempts } from "./mapLoader";

declare global {
  interface Window {
    google?: typeof google;
  }
}

let mapScriptPromise: Promise<void> | null = null;
let mapScriptLoaded = false;

function removeExistingMapScripts() {
  const existingScripts = document.querySelectorAll(
    'script[data-google-maps-loader="true"], script[src*="maps/api/js"]'
  );
  existingScripts.forEach((scriptElement) => scriptElement.remove());
}

function resetMapScriptState() {
  mapScriptPromise = null;
  mapScriptLoaded = false;
  removeExistingMapScripts();
}

function loadExternalMapScript(src: string, source: "direct" | "proxy") {
  return new Promise<void>((resolve, reject) => {
    removeExistingMapScripts();

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.googleMapsLoader = "true";
    script.dataset.googleMapsSource = source;

    script.onload = () => {
      const checkReady = (attempts: number) => {
        if (window.google?.maps?.Map) {
          resolve();
          return;
        }

        if (attempts >= 50) {
          script.remove();
          reject(new Error(`Google Maps API did not initialize (${source})`));
          return;
        }

        window.setTimeout(() => checkReady(attempts + 1), 100);
      };

      checkReady(0);
    };

    script.onerror = () => {
      script.remove();
      reject(new Error(`Google Maps script request failed (${source})`));
    };

    document.head.appendChild(script);
  });
}

function loadMapScript(): Promise<void> {
  if (mapScriptLoaded && window.google?.maps) {
    return Promise.resolve();
  }

  if (mapScriptPromise) {
    return mapScriptPromise;
  }

  mapScriptPromise = (async () => {
    if (window.google?.maps) {
      mapScriptLoaded = true;
      return;
    }

    // Try a direct browser load first when this deployment exposes a public key.
    // Fall back to /api/maps-js when browser-only headers or provider differences
    // make the direct request fail.
    const attempts = resolveMapScriptAttempts();
    let lastError: Error | null = null;

    for (const attempt of attempts) {
      try {
        await loadExternalMapScript(attempt.src, attempt.source);
        mapScriptLoaded = true;
        return;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Failed to load Google Maps script");
        mapScriptLoaded = false;
        removeExistingMapScripts();
        console.warn(
          `Google Maps script load failed via ${attempt.source}`,
          lastError
        );
      }
    }

    throw lastError ?? new Error("Failed to load Google Maps script");
  })().catch((error) => {
    mapScriptPromise = null;
    mapScriptLoaded = false;
    throw error;
  });

  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 35.6812, lng: 139.7671 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const init = usePersistFn(async () => {
    setLoading(true);
    setError(null);

    try {
      await loadMapScript();
    } catch (error) {
      console.error("Failed to load Google Maps script:", error);
      setError(
        "Google Mapsの読み込みに失敗しました。ページを再読み込みしても改善しない場合は、ネットワーク設定を確認してください。"
      );
      setLoading(false);
      return;
    }

    if (!mapContainer.current) {
      setError("マップコンテナが見つかりません。");
      setLoading(false);
      return;
    }

    try {
      if (!map.current) {
        map.current = new window.google!.maps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
          mapId: resolveMapId(),
        });

        if (onMapReady) {
          onMapReady(map.current);
        }
      }

      setLoading(false);
    } catch (mapError) {
      console.error("Failed to initialize Google Map:", mapError);
      setError("マップの初期化に失敗しました。");
      setLoading(false);
    }
  });

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!map.current) {
      return;
    }

    map.current.setCenter(initialCenter);
  }, [initialCenter.lat, initialCenter.lng]);

  useEffect(() => {
    if (!map.current) {
      return;
    }

    map.current.setZoom(initialZoom);
  }, [initialZoom]);

  return (
    <div className={cn("relative h-[500px] w-full", className)}>
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-muted/50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              マップを読み込み中...
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-muted/30">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="text-4xl">!</div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                resetMapScriptState();
                void init();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90"
            >
              再読み込み
            </button>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="h-full w-full rounded-xl" />
    </div>
  );
}
