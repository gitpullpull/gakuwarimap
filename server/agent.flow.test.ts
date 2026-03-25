import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAgentCaches, searchGakuwariSpots } from "./agent";
import { makeRequest } from "./_core/map";

vi.mock("./_core/map", () => ({
  makeRequest: vi.fn(),
}));

const mockedMakeRequest = vi.mocked(makeRequest);
const ORIGINAL_ENV = { ...process.env };

type ShopSpec = {
  verifierContent: string;
  reviewerContent?: string;
  searchContent?: string;
  searchUrl?: string;
  searchStatus?: number;
  searchResults?: Array<{
    title?: string;
    url?: string;
    description?: string;
  }>;
};

function createPlace(
  name: string,
  lat: number,
  lng: number,
  {
    placeId,
    type = "cafe",
    rating,
    address,
  }: {
    placeId: string;
    type?: string;
    rating?: number;
    address?: string;
  }
) {
  return {
    name,
    formatted_address: address ?? `${name} Address`,
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

function createOrderedCafes(count: number, prefix: string = "Cafe") {
  return Array.from({ length: count }, (_, index) =>
    createPlace(
      `${prefix} ${String(index + 1).padStart(2, "0")}`,
      35.6595 + index * 0.00005,
      139.7005,
      {
        placeId: `${prefix.toLowerCase().replace(/\s+/g, "_")}_${index + 1}`,
        type: "cafe",
        rating: 4.9 - index * 0.01,
        address: `Tokyo ${prefix} ${index + 1}`,
      }
    )
  );
}

function createDetailsByPlaceId(
  places: Array<ReturnType<typeof createPlace>>,
  overrides: Record<string, { website?: string; formatted_address?: string }> = {}
) {
  return Object.fromEntries(
    places.map((place) => [
      place.place_id,
      {
        website: `https://${place.place_id}.example.com`,
        formatted_address: `${place.name} Full Address`,
        ...(overrides[place.place_id] ?? {}),
      },
    ])
  );
}

function createPlacesMock({
  broadResults,
  nextPageResults = [],
  typeResults = {},
  detailsById = {},
  detailsStatusById = {},
}: {
  broadResults: Array<ReturnType<typeof createPlace>>;
  nextPageResults?: Array<ReturnType<typeof createPlace>>;
  typeResults?: Record<string, Array<ReturnType<typeof createPlace>>>;
  detailsById?: Record<string, { website?: string; formatted_address?: string }>;
  detailsStatusById?: Record<string, string>;
}) {
  return async (endpoint: string, params: Record<string, unknown>) => {
    if (endpoint === "/maps/api/place/details/json") {
      const placeId = String(params.place_id ?? "");
      return {
        status: detailsStatusById[placeId] ?? "OK",
        result: detailsById[placeId] ?? {},
      } as never;
    }

    if (endpoint === "/maps/api/place/nearbysearch/json") {
      const request = params as Record<string, unknown>;
      const pageToken = String(request.pagetoken ?? "");
      const type = String(request.type ?? "");
      const keyword = String(request.keyword ?? "");

      if (pageToken === "broad-page-2") {
        return {
          status: "OK",
          results: nextPageResults,
        } as never;
      }

      if (!type && keyword === "カラオケ") {
        return {
          status: "ZERO_RESULTS",
          results: [],
        } as never;
      }

      if (!type) {
        return {
          status: "OK",
          results: broadResults,
          ...(nextPageResults.length > 0 ? { next_page_token: "broad-page-2" } : {}),
        } as never;
      }

      if (typeResults[type]) {
        return {
          status: "OK",
          results: typeResults[type],
        } as never;
      }

      return {
        status: "ZERO_RESULTS",
        results: [],
      } as never;
    }

    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };
}

function createFetchMock(specs: Record<string, ShopSpec>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/search?")) {
      const decoded = decodeURIComponent(url);
      const match = Object.entries(specs).find(([name]) => decoded.includes(name));
      const [name, spec] = match ?? [
        "Unknown Shop",
        {
          verifierContent:
            '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
          searchContent: "No student discount found",
        },
      ];

      if (spec.searchStatus && spec.searchStatus !== 200) {
        return new Response(
          JSON.stringify({ error: `Search failed for ${name}` }),
          {
            status: spec.searchStatus,
            headers: {
              "content-type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          web: {
            results:
              spec.searchResults ??
              [
                {
                  title: name,
                  url: spec.searchUrl ?? `https://example.com/${encodeURIComponent(name)}`,
                  description: spec.searchContent ?? "No student discount found",
                },
              ],
          },
        }),
        {
          status: spec.searchStatus ?? 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    if (url.includes("/chat/completions")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const combinedContent = (body.messages ?? [])
        .map((message: { content?: string }) => message.content ?? "")
        .join("\n");
      const match = Object.entries(specs).find(([name]) =>
        combinedContent.includes(name)
      );
      const spec =
        match?.[1] ?? {
          verifierContent:
            '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
        };
      const content = combinedContent.includes("Team role: Reviewer")
        ? spec.reviewerContent ?? spec.verifierContent
        : spec.verifierContent;

      return new Response(
        JSON.stringify({
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
              },
              finish_reason: "stop",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DEPLOY_MODE: "external",
    GOOGLE_MAPS_SERVER_API_KEY: "google-test-key",
    GEMINI_API_KEY: "gemini-test-key",
    BRAVE_SEARCH_API_KEY: "brave-test-key",
    GEMINI_MODEL: "gemini-3-flash-preview",
    GEMINI_OPENAI_BASE_URL: "https://gemini.example.com/v1beta/openai",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetAgentCaches();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("searchGakuwariSpots", () => {
  it("uses place details before building evidence queries and preserves the public shape", async () => {
    const broadResults = [
      createPlace("Cafe Alpha", 35.1, 139.1, {
        placeId: "place_1",
        type: "cafe",
        rating: 4.5,
        address: "Tokyo",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          place_1: {
            website: "https://example.com",
            formatted_address: "Tokyo Chiyoda",
          },
        },
      })
    );

    const fetchMock = createFetchMock({
      "Cafe Alpha": {
        verifierContent:
          '{"has_gakuwari":true,"discount_info":"10% off","source_url":"https://example.com/discount","confidence":"high"}',
        searchContent: "Student discount available",
        searchUrl: "https://example.com/discount",
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.1, 139.1, 500, "cafe");
    const searchUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/search?"));

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      place_id: "place_1",
      name: "Cafe Alpha",
      address: "Tokyo Chiyoda",
      website: "https://example.com",
      has_gakuwari: true,
      discount_info: "10% off",
      source_url: "https://example.com/discount",
      confidence: "high",
    });
    expect(searchUrls.some((url) => decodeURIComponent(url).includes("example.com"))).toBe(
      true
    );
  });

  it("logs matched categories and API boost metadata for curated keywords", async () => {
    const broadResults = [
      createPlace("Izakaya Student", 35.1, 139.1, {
        placeId: "izakaya_student",
        type: "restaurant",
        address: "Tokyo Izakaya",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        typeResults: {
          restaurant: broadResults,
        },
        detailsById: {
          izakaya_student: {
            website: "https://izakaya.example.com",
            formatted_address: "Tokyo Izakaya",
          },
        },
      })
    );

    const fetchMock = createFetchMock({
      "Izakaya Student": {
        verifierContent:
          '{"has_gakuwari":true,"discount_info":"学生限定コース","source_url":"https://izakaya.example.com/student","confidence":"medium"}',
        searchContent: "学生限定コースあり",
        searchUrl: "https://izakaya.example.com/student",
      },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    await searchGakuwariSpots(35.1, 139.1, 500, "居酒屋");

    const diagnosticLines = logSpy.mock.calls.flat().map((value) => String(value));
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"event":"search_summary"') &&
          line.includes('"matchedCategoryIds":["food_drink"]') &&
          line.includes('"apiBoostEnabled":true') &&
          line.includes('"profiles":["broad","restaurant"]')
      )
    ).toBe(true);
  });

  it("logs broad-only reasons for unknown keywords", async () => {
    const broadResults = [
      createPlace("Gift Card Shop", 35.1, 139.1, {
        placeId: "gift_card_shop",
        type: "store",
        address: "Tokyo Unknown",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          gift_card_shop: {
            website: "https://unknown.example.com",
            formatted_address: "Tokyo Unknown",
          },
        },
      })
    );

    const fetchMock = createFetchMock({
      "Gift Card Shop": {
        verifierContent:
          '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
        searchContent: "No student discount found",
      },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    await searchGakuwariSpots(35.1, 139.1, 500, "金券ショップ");

    const diagnosticLines = logSpy.mock.calls.flat().map((value) => String(value));
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"event":"search_summary"') &&
          line.includes('"matchedCategoryIds":[]') &&
          line.includes('"apiBoostEnabled":false') &&
          line.includes('"broadOnlyReason":"keyword_not_in_catalog"') &&
          line.includes('"profiles":["broad"]')
      )
    ).toBe(true);
  });

  it("halts a candidate after a non-retryable Brave failure and skips Gemini", async () => {
    const broadResults = [
      createPlace("Cafe Fail", 35.1, 139.1, {
        placeId: "place_fail",
        type: "cafe",
        address: "Tokyo Fail",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          place_fail: {
            website: "https://fail.example.com",
            formatted_address: "Tokyo Fail",
          },
        },
      })
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search?")) {
        return new Response(JSON.stringify({ error: "Search failed for Cafe Fail" }), {
          status: 422,
          headers: {
            "content-type": "application/json",
          },
        });
      }
      if (url.includes("/chat/completions")) {
        throw new Error("Gemini should not be called for Cafe Fail");
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.1, 139.1, 500, "cafe");
    const searchCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/search?")
    );
    const chatCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/chat/completions")
    );
    const diagnosticLines = [
      ...logSpy.mock.calls.flat().map((value) => String(value)),
      ...warnSpy.mock.calls.flat().map((value) => String(value)),
      ...errorSpy.mock.calls.flat().map((value) => String(value)),
    ];

    expect(results[0]).toMatchObject({
      place_id: "place_fail",
      has_gakuwari: false,
      confidence: "low",
    });
    expect(searchCalls).toHaveLength(1);
    expect(chatCalls).toHaveLength(0);
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"stage":"retriever"') &&
          line.includes('"provider":"brave"') &&
          line.includes('"action":"abort_candidate"') &&
          line.includes('"httpStatus":422')
      )
    ).toBe(true);
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"event":"candidate_halt"') &&
          line.includes('"haltReason":"brave_request_failed"')
      )
    ).toBe(true);
    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('"event":"search_summary"') &&
          line.includes('"brave":{"attempted":1') &&
          line.includes('"gemini":{"attempted":0')
      )
    ).toBe(true);
  });

  it("skips Gemini when Brave succeeds but returns no evidence snippets", async () => {
    const broadResults = [
      createPlace("Cafe Empty", 35.1, 139.1, {
        placeId: "place_empty",
        type: "cafe",
        address: "Tokyo Empty",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          place_empty: {
            website: "https://empty.example.com",
            formatted_address: "Tokyo Empty",
          },
        },
      })
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search?")) {
        return new Response(
          JSON.stringify({
            web: {
              results: [],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }
        );
      }
      if (url.includes("/chat/completions")) {
        throw new Error("Gemini should not be called for Cafe Empty");
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.1, 139.1, 500, "cafe");
    const searchCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/search?")
    );
    const chatCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/chat/completions")
    );

    expect(results[0]).toMatchObject({
      place_id: "place_empty",
      has_gakuwari: false,
      confidence: "low",
    });
    expect(searchCalls).toHaveLength(2);
    expect(chatCalls).toHaveLength(0);
    expect(
      warnSpy.mock.calls
        .flat()
        .map((value) => String(value))
        .some(
          (line) =>
            line.includes('"event":"candidate_halt"') &&
            line.includes('"haltReason":"brave_no_evidence"')
        )
    ).toBe(true);
  });

  it("continues to Brave and Gemini when place details fail but the nearby address is usable", async () => {
    const broadResults = [
      createPlace("Cafe Fallback", 35.1, 139.1, {
        placeId: "place_fallback",
        type: "cafe",
        address: "Usable Nearby Address",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {},
        detailsStatusById: {
          place_fallback: "ZERO_RESULTS",
        },
      })
    );

    const fetchMock = createFetchMock({
      "Cafe Fallback": {
        verifierContent:
          '{"has_gakuwari":true,"discount_info":"5% off","source_url":"https://example.com/fallback","confidence":"medium"}',
        searchContent: "Student discount available",
        searchUrl: "https://example.com/fallback",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.1, 139.1, 500, "cafe");

    expect(results[0]).toMatchObject({
      place_id: "place_fallback",
      has_gakuwari: true,
      confidence: "medium",
    });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes("/search?"))
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes("/chat/completions"))
    ).toHaveLength(1);
  });

  it("halts a candidate before Brave when details fail and no usable address or website remain", async () => {
    const broadResults = [
      createPlace("Cafe No Context", 35.1, 139.1, {
        placeId: "place_no_context",
        type: "cafe",
        address: "",
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {},
        detailsStatusById: {
          place_no_context: "ZERO_RESULTS",
        },
      })
    );

    const fetchMock = createFetchMock({
      "Cafe No Context": {
        verifierContent:
          '{"has_gakuwari":true,"discount_info":"should not appear","source_url":"https://example.com/unused","confidence":"high"}',
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.1, 139.1, 500, "cafe");

    expect(results[0]).toMatchObject({
      place_id: "place_no_context",
      has_gakuwari: false,
      confidence: "low",
    });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes("/search?"))
    ).toHaveLength(0);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes("/chat/completions"))
    ).toHaveLength(0);
    expect(
      warnSpy.mock.calls
        .flat()
        .map((value) => String(value))
        .some(
          (line) =>
            line.includes('"event":"candidate_halt"') &&
            line.includes('"haltReason":"details_unusable_context"')
        )
    ).toBe(true);
  });

  it("runs wave 2 when wave 1 has no hits and keeps the configured radius", async () => {
    const broadResults = createOrderedCafes(16, "Wave Cafe");
    const detailsById = createDetailsByPlaceId(broadResults);
    const fetchMock = createFetchMock(
      Object.fromEntries(
        broadResults.map((place, index) => [
          place.name,
          {
            verifierContent:
              index === 8
                ? '{"has_gakuwari":true,"discount_info":"5% off","source_url":"https://example.com/cafe-09","confidence":"medium"}'
                : '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
            reviewerContent:
              '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
            searchContent:
              index === 8 ? "Student discount available" : "No student discount found",
            searchUrl: `https://example.com/${place.place_id}`,
          } satisfies ShopSpec,
        ])
      )
    );

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.6595, 139.7005, 500, "cafe");

    expect(results).toHaveLength(12);
    expect(
      results.some((result) => result.name === "Wave Cafe 09" && result.has_gakuwari)
    ).toBe(true);
    expect(
      mockedMakeRequest.mock.calls
        .filter(([endpoint]) => endpoint === "/maps/api/place/nearbysearch/json")
        .every(([, params]) => {
          const request = params as Record<string, unknown>;
          return !request.pagetoken && request.radius === 500;
        })
    ).toBe(true);
  });

  it("stops after 12 investigated candidates when wave 1 already found a hit", async () => {
    const broadResults = createOrderedCafes(16, "Hit Cafe");
    const detailsById = createDetailsByPlaceId(broadResults);
    const fetchMock = createFetchMock(
      Object.fromEntries(
        broadResults.map((place, index) => [
          place.name,
          {
            verifierContent:
              index === 0
                ? '{"has_gakuwari":true,"discount_info":"7% off","source_url":"https://example.com/cafe-01","confidence":"high"}'
                : '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
            reviewerContent:
              '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
            searchContent:
              index === 0 ? "Student discount available" : "No student discount found",
            searchUrl: `https://example.com/${place.place_id}`,
          } satisfies ShopSpec,
        ])
      )
    );

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.6595, 139.7005, 500, "cafe");

    expect(results).toHaveLength(12);
    expect(results[0]).toMatchObject({
      name: "Hit Cafe 01",
      has_gakuwari: true,
      confidence: "high",
    });
  });

  it("reuses the strategy-versioned cache for repeated searches", async () => {
    const broadResults = [
      createPlace("Cafe Cache", 35.2, 139.2, {
        placeId: "cache_place",
        type: "cafe",
        rating: 4.2,
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          cache_place: {
            website: "https://cache.example.com",
            formatted_address: "Tokyo Minato",
          },
        },
      })
    );

    const fetchMock = createFetchMock({
      "Cafe Cache": {
        verifierContent:
          '{"has_gakuwari":true,"discount_info":"5% off","source_url":"https://cache.example.com/discount","confidence":"medium"}',
        searchContent: "Student discount available",
        searchUrl: "https://cache.example.com/discount",
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    await searchGakuwariSpots(35.2, 139.2, 500, "cafe");
    const secondResults = await searchGakuwariSpots(35.2, 139.2, 500, "cafe");

    expect(secondResults[0]).toMatchObject({
      place_id: "cache_place",
      has_gakuwari: true,
      confidence: "medium",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mockedMakeRequest).toHaveBeenCalledTimes(3);
  });

  it("lets the reviewer recover a high-priority low-confidence negative", async () => {
    const broadResults = [
      createPlace("Salon Review", 35.66, 139.7, {
        placeId: "salon_review",
        type: "hair_care",
        rating: 4.7,
      }),
    ];

    mockedMakeRequest.mockImplementation(
      createPlacesMock({
        broadResults,
        detailsById: {
          salon_review: {
            website: "https://beauty.example.com",
            formatted_address: "Shibuya Tokyo",
          },
        },
      })
    );

    const fetchMock = createFetchMock({
      "Salon Review": {
        verifierContent:
          '{"has_gakuwari":false,"discount_info":"","source_url":"","confidence":"low"}',
        reviewerContent:
          '{"has_gakuwari":true,"discount_info":"学割U24あり","source_url":"https://beauty.example.com/coupon","confidence":"medium"}',
        searchContent: "学割U24 クーポンあり",
        searchUrl: "https://beauty.example.com/coupon",
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGakuwariSpots(35.66, 139.7, 500, "hair");

    expect(results[0]).toMatchObject({
      place_id: "salon_review",
      has_gakuwari: true,
      discount_info: "学割U24あり",
      confidence: "medium",
    });
  });
});
