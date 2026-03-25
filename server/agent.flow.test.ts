import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchGakuwariSpots } from "./agent";
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
}: {
  broadResults: Array<ReturnType<typeof createPlace>>;
  nextPageResults?: Array<ReturnType<typeof createPlace>>;
  typeResults?: Record<string, Array<ReturnType<typeof createPlace>>>;
  detailsById?: Record<string, { website?: string; formatted_address?: string }>;
}) {
  return async (endpoint: string, params: Record<string, unknown>) => {
    if (endpoint === "/maps/api/place/details/json") {
      const placeId = String(params.place_id ?? "");
      return {
        status: "OK",
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

      return new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: name,
                url: spec.searchUrl ?? `https://example.com/${encodeURIComponent(name)}`,
                description: spec.searchContent ?? "No student discount found",
              },
            ],
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

    expect(results).toHaveLength(16);
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
