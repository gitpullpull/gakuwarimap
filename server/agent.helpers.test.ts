import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAgentTeamProfiles,
  buildEvidenceSearchQueries,
  collectCandidateShops,
  getAgentCacheKeyForPlace,
  parseAgentResultContent,
  resetAgentCaches,
  searchNearbyPlaces,
} from "./agent";
import { makeRequest } from "./_core/map";

vi.mock("./_core/map", () => ({
  makeRequest: vi.fn(),
}));

const mockedMakeRequest = vi.mocked(makeRequest);
const ORIGINAL_ENV = { ...process.env };

function createPlace(
  name: string,
  lat: number,
  lng: number,
  {
    placeId = name,
    type = "store",
    rating,
    address,
  }: {
    placeId?: string;
    type?: string;
    rating?: number;
    address?: string;
  } = {}
) {
  return {
    name,
    formatted_address: address ?? name,
    place_id: placeId,
    geometry: {
      location: {
        lat,
        lng,
      },
    },
    rating,
    types: [type],
  };
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DEPLOY_MODE: "external",
    GOOGLE_MAPS_SERVER_API_KEY: "google-test-key",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetAgentCaches();
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

describe("buildAgentTeamProfiles", () => {
  it.each([
    ["居酒屋", ["broad", "restaurant"]],
    ["ボウリング", ["broad", "karaoke_amusement"]],
    ["水族館", ["broad", "ticketed_venue"]],
    ["漫画喫茶", ["broad", "study_space"]],
    ["ネイル", ["broad", "beauty_services"]],
    ["金券ショップ", ["broad"]],
  ])("maps %s to the expected specialty profiles", (keyword, expectedIds) => {
    expect(buildAgentTeamProfiles(keyword).map((profile) => profile.id)).toEqual(
      expectedIds
    );
  });
});

describe("buildEvidenceSearchQueries", () => {
  it("includes category terms and matched aliases for ticketed venues within the cap", () => {
    const queries = buildEvidenceSearchQueries(
      {
        name: "渋谷水族館",
        address: "東京都渋谷区1-1-1",
        place_id: "ticketed",
        website: "https://ticketed.example.com",
        lat: 35.0,
        lng: 139.0,
        types: ["aquarium"],
      },
      "水族館"
    );

    expect(queries).toHaveLength(2);
    expect(queries.join(" ")).toContain("水族館");
    expect(queries.join(" ")).toContain("学生料金");
  });
});

describe("collectCandidateShops", () => {
  it("uses a matched specialty profile for curated keywords but stays broad-only for unknown ones", async () => {
    mockedMakeRequest.mockImplementation(async (endpoint, params) => {
      if (endpoint !== "/maps/api/place/nearbysearch/json") {
        throw new Error(`Unexpected endpoint: ${String(endpoint)}`);
      }

      const request = params as Record<string, unknown>;
      const type = String(request.type ?? "");
      const keyword = String(request.keyword ?? "");

      if (!type) {
        return {
          status: "OK",
          results: [
            createPlace(`Broad ${keyword || "default"}`, 35.6596, 139.7004, {
              placeId: `broad-${keyword || "default"}`,
              type: "restaurant",
            }),
          ],
        } as never;
      }

      return {
        status: "OK",
        results: [
          createPlace(`Typed ${type}`, 35.6597, 139.7005, {
            placeId: `typed-${type}`,
            type,
          }),
        ],
      } as never;
    });

    await collectCandidateShops(35.6595, 139.7005, 500, "居酒屋");
    const preparedCalls = mockedMakeRequest.mock.calls
      .filter(([endpoint]) => endpoint === "/maps/api/place/nearbysearch/json")
      .map(([, params]) => params as Record<string, unknown>);

    expect(preparedCalls).toHaveLength(2);
    expect(
      preparedCalls.some(
        (params) => params.type === "restaurant" && params.keyword === "居酒屋"
      )
    ).toBe(true);

    mockedMakeRequest.mockClear();

    await collectCandidateShops(35.6595, 139.7005, 500, "金券ショップ");
    const unknownCalls = mockedMakeRequest.mock.calls
      .filter(([endpoint]) => endpoint === "/maps/api/place/nearbysearch/json")
      .map(([, params]) => params as Record<string, unknown>);

    expect(unknownCalls).toHaveLength(1);
    expect(unknownCalls[0]?.type).toBeUndefined();
    expect(unknownCalls[0]?.keyword).toBe("金券ショップ");
  });

  it("merges multiple search profiles, paginates, dedupes, and keeps only in-radius results", async () => {
    mockedMakeRequest.mockImplementation(async (endpoint, params) => {
      if (endpoint === "/maps/api/place/nearbysearch/json") {
        const request = params as Record<string, unknown>;
        const pageToken = String(request.pagetoken ?? "");
        const type = String(request.type ?? "");

        if (pageToken === "broad-page-2") {
          return {
            status: "OK",
            results: [
              createPlace("Cinema Prime", 35.6599, 139.7006, {
                placeId: "cinema-prime",
                type: "movie_theater",
                rating: 4.7,
              }),
            ],
          } as never;
        }

        if (!type) {
          return {
            status: "OK",
            next_page_token: "broad-page-2",
            results: [
              createPlace("Cafe Nearby", 35.6596, 139.7004, {
                placeId: "cafe-nearby",
                type: "cafe",
                rating: 4.2,
              }),
              createPlace("Duplicate Cafe", 35.6597, 139.7005, {
                placeId: "duplicate-cafe",
                type: "cafe",
                rating: 4.1,
              }),
              createPlace("Outside Radius", 35.6895, 139.7005, {
                placeId: "outside-radius",
                type: "movie_theater",
                rating: 4.9,
              }),
            ],
          } as never;
        }

        if (type === "movie_theater") {
          return {
            status: "OK",
            results: [
              createPlace("Duplicate Cafe", 35.6597, 139.7005, {
                placeId: "duplicate-cafe",
                type: "movie_theater",
                rating: 4.3,
              }),
            ],
          } as never;
        }

        return {
          status: "ZERO_RESULTS",
          results: [],
        } as never;
      }

      throw new Error(`Unexpected endpoint: ${String(endpoint)}`);
    });

    const candidates = await collectCandidateShops(35.6595, 139.7005, 500, "映画");

    expect(candidates.map((candidate) => candidate.place_id)).toEqual([
      "duplicate-cafe",
      "cinema-prime",
      "cafe-nearby",
    ]);
    expect(candidates.some((candidate) => candidate.place_id === "outside-radius")).toBe(
      false
    );
    expect(
      mockedMakeRequest.mock.calls.some(
        ([, params]) => (params as Record<string, unknown>).pagetoken === "broad-page-2"
      )
    ).toBe(true);
  });

  it("retries INVALID_REQUEST pagination three times before aborting the profile", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedMakeRequest.mockImplementation(async (endpoint, params) => {
      if (endpoint !== "/maps/api/place/nearbysearch/json") {
        throw new Error(`Unexpected endpoint: ${String(endpoint)}`);
      }

      const request = params as Record<string, unknown>;
      if (String(request.pagetoken ?? "") === "broad-page-2") {
        return {
          status: "INVALID_REQUEST",
          results: [],
        } as never;
      }

      return {
        status: "OK",
        next_page_token: "broad-page-2",
        results: [
          createPlace("Cafe Nearby", 35.6596, 139.7004, {
            placeId: "cafe-nearby",
            type: "cafe",
          }),
        ],
      } as never;
    });

    const candidates = await collectCandidateShops(35.6595, 139.7005, 500);
    const paginationCalls = mockedMakeRequest.mock.calls.filter(
      ([, params]) => (params as Record<string, unknown>).pagetoken === "broad-page-2"
    );
    const diagnosticLines = [
      ...logSpy.mock.calls.flat().map((value) => String(value)),
      ...warnSpy.mock.calls.flat().map((value) => String(value)),
      ...errorSpy.mock.calls.flat().map((value) => String(value)),
    ];

    expect(candidates.map((candidate) => candidate.place_id)).toContain("cafe-nearby");
    expect(paginationCalls).toHaveLength(3);
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"stage":"pagination"') &&
          line.includes('"action":"retry"') &&
          line.includes('"attempt":1')
      )
    ).toBe(true);
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"stage":"pagination"') &&
          line.includes('"action":"abort_profile"') &&
          line.includes('"attempt":3')
      )
    ).toBe(true);
  });

  it("continues with the broad profile when a specialty first page fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedMakeRequest.mockImplementation(async (endpoint, params) => {
      if (endpoint !== "/maps/api/place/nearbysearch/json") {
        throw new Error(`Unexpected endpoint: ${String(endpoint)}`);
      }

      const request = params as Record<string, unknown>;
      const type = String(request.type ?? "");
      if (type === "movie_theater") {
        return {
          status: "INVALID_REQUEST",
          results: [],
        } as never;
      }

      return {
        status: "OK",
        results: [
          createPlace("Cafe Nearby", 35.6596, 139.7004, {
            placeId: "cafe-nearby",
            type: "cafe",
          }),
        ],
      } as never;
    });

    const candidates = await collectCandidateShops(35.6595, 139.7005, 500, "movie");

    expect(candidates.map((candidate) => candidate.place_id)).toEqual(["cafe-nearby"]);
    expect(
      errorSpy.mock.calls
        .flat()
        .map((value) => String(value))
        .some(
          (line) =>
            line.includes('"stage":"candidate_search"') &&
            line.includes('"action":"abort_profile"') &&
            line.includes('"profileId":"movie_theater"')
        )
    ).toBe(true);
  });
});

describe("getAgentCacheKeyForPlace", () => {
  it("includes the strategy version prefix", () => {
    expect(getAgentCacheKeyForPlace("place_123")).toBe(
      "agent-team-v2::place_123"
    );
  });
});
