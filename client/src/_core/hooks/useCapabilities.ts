import { trpc } from "@/lib/trpc";

export type SystemCapabilities = {
  deployMode: "manus" | "external";
  authMode: "manus" | "none";
  mapsMode: "forge" | "google";
  storageMode: "forge" | "s3" | "disabled";
  canUploadImages: boolean;
};

export function useCapabilities() {
  const query = trpc.system.capabilities.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    capabilities: (query.data as SystemCapabilities | undefined) ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
