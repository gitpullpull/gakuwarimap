import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAgentResultContent, searchNearbyPlaces } from "./agent";
import { makeRequest } from "./_core/map";

vi.mock("./_core/map", () => ({
  makeRequest: vi.fn(),
}));

const mockedMakeRequest = vi.mocked(makeRequest);
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    DEPLOY_MODE: "external",
    GOOGLE_MAPS_SERVER_API_KEY: "google-test-key",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetAllMocks();
});

describe("parseAgentResultContent", () => {
  it("parses plain JSON", () => {
    expect(
      parseAgentResultContent(
        '{"has_gakuwari":true,"discount_info":"10% off","source_url":"https://example.com","confidence":"high"}'
      )
    ).toEqual({
      has_gakuwari: true,
      discount_info: "10% off",
      source_url: "https://example.com",
      confidence: "high",
    });
  });

  it("parses fenced JSON", () => {
    expect(
      parseAgentResultContent(
        '```json\n{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"medium"}\n```'
      )
    ).toEqual({
      has_gakuwari: false,
      discount_info: "",
      source_url: "",
      confidence: "medium",
    });
  });

  it("falls back to text heuristics for malformed content", () => {
    expect(
      parseAgentResultContent(
        "Student discount available at the counter. https://example.com/info"
      )
    ).toEqual({
      has_gakuwari: true,
      discount_info:
        "Student discount available at the counter. https://example.com/info",
      source_url: "https://example.com/info",
      confidence: "low",
    });
  });
});

describe("searchNearbyPlaces address fallback", () => {
  it("prefers formatted_address when it is present", async () => {
    mockedMakeRequest.mockResolvedValueOnce({
      status: "OK",
      results: [
        {
          name: "Shop A",
          formatted_address: "Tokyo",
          vicinity: "Shibuya",
          place_id: "place_a",
          geometry: {
            location: {
              lat: 35.6,
              lng: 139.7,
            },
          },
          types: ["store"],
        },
      ],
    } as never);
    mockedMakeRequest.mockResolvedValueOnce({
      status: "ZERO_RESULTS",
      result: {},
    } as never);

    const shops = await searchNearbyPlaces(35.6, 139.7);

    expect(shops[0]?.address).toBe("Tokyo");
  });

  it("falls back to vicinity when formatted_address is missing", async () => {
    mockedMakeRequest.mockResolvedValueOnce({
      status: "OK",
      results: [
        {
          name: "Shop B",
          vicinity: "Shinjuku",
          place_id: "place_b",
          geometry: {
            location: {
              lat: 35.7,
              lng: 139.7,
            },
          },
          types: ["store"],
        },
      ],
    } as never);
    mockedMakeRequest.mockResolvedValueOnce({
      status: "ZERO_RESULTS",
      result: {},
    } as never);

    const shops = await searchNearbyPlaces(35.7, 139.7);

    expect(shops[0]?.address).toBe("Shinjuku");
  });
});
