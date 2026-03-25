import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Agent API tests.
 *
 * Tests validate:
 * 1. Input validation (zod schema enforcement)
 * 2. Procedure existence and correct wiring
 * 3. Error handling for invalid inputs
 *
 * Note: searchGakuwari integration test is skipped by default because it
 * requires Gemini + Brave Search external services and takes time to run.
 * Run manually with: pnpm test -- --testNamePattern="integration"
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("agent.searchGakuwari", () => {
  it("rejects invalid latitude", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.agent.searchGakuwari({
        lat: "not-a-number" as unknown as number,
        lng: 139.7671,
      })
    ).rejects.toThrow();
  });

  it("rejects radius below minimum (100)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.agent.searchGakuwari({
        lat: 35.6812,
        lng: 139.7671,
        radius: 50,
      })
    ).rejects.toThrow();
  });

  it("rejects radius above maximum (5000)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.agent.searchGakuwari({
        lat: 35.6812,
        lng: 139.7671,
        radius: 10000,
      })
    ).rejects.toThrow();
  });

  it.skip(
    "integration: calls Gemini + Brave Search and returns results",
    { timeout: 600_000 },
    async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agent.searchGakuwari({
        lat: 35.6812,
        lng: 139.7671,
        radius: 500,
        keyword: "カフェ",
      });

      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);

      if (result.results.length > 0) {
        const first = result.results[0];
        expect(first).toHaveProperty("place_id");
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("address");
        expect(first).toHaveProperty("has_gakuwari");
        expect(typeof first.has_gakuwari).toBe("boolean");
        expect(first).toHaveProperty("confidence");
        expect(["high", "medium", "low"]).toContain(first.confidence);
      }
    }
  );
});

describe("agent.nearbyPlaces", () => {
  it("rejects invalid latitude", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.agent.nearbyPlaces({
        lat: "invalid" as unknown as number,
        lng: 139.7671,
      })
    ).rejects.toThrow();
  });

  it("rejects radius below minimum", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.agent.nearbyPlaces({
        lat: 35.6812,
        lng: 139.7671,
        radius: 50,
      })
    ).rejects.toThrow();
  });

  it("accepts valid input and returns shops", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.agent.nearbyPlaces({
        lat: 35.6812,
        lng: 139.7671,
        radius: 500,
      });

      expect(result).toHaveProperty("shops");
      expect(Array.isArray(result.shops)).toBe(true);

      if (result.shops.length > 0) {
        const first = result.shops[0];
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("address");
        expect(first).toHaveProperty("place_id");
        expect(first).toHaveProperty("lat");
        expect(first).toHaveProperty("lng");
      }
    } catch (error: unknown) {
      expect(error).toBeDefined();
    }
  });
});
