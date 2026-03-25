import "dotenv/config";
import superjson from "superjson";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/routers";
import {
  EXTERNAL_BASELINE_CATEGORIES,
  SHIBUYA_VERIFICATION_POINT,
  SHIBUYA_VERIFICATION_RADIUS_METERS,
  VERIFICATION_PAGE_PATHS,
  VERIFICATION_REVIEW_NAME,
} from "./_shared/externalBaseline";

type AppCategory = Awaited<
  ReturnType<ReturnType<typeof createClient>["category"]["list"]["query"]>
>[number];

type AgentSearchResult = Awaited<
  ReturnType<ReturnType<typeof createClient>["agent"]["searchGakuwari"]["mutate"]>
>["results"][number];

type CreatedSpotSummary = {
  id: number;
  name: string;
};

function createClient(baseUrl: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl.replace(/\/+$/, "")}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}

function getBaseUrl(): string {
  return (
    process.env.LOCAL_EXTERNAL_BASE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message: string) {
  console.log(`\n[External Verify] ${message}`);
}

async function fetchOk(
  url: string,
  init?: RequestInit & { expectedContentType?: string }
) {
  const { expectedContentType, ...requestInit } = init ?? {};
  const response = await fetch(url, requestInit);
  assert(response.ok, `Request failed for ${url}: ${response.status}`);

  if (expectedContentType) {
    const contentType = response.headers.get("content-type") || "";
    assert(
      contentType.includes(expectedContentType),
      `Unexpected content type for ${url}: ${contentType}`
    );
  }

  return response;
}

async function waitForServer(baseUrl: string) {
  const targetUrl = `${baseUrl}/agent`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(targetUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `Local server did not become ready at ${targetUrl}: ${String(lastError)}`
  );
}

function verifyCategories(categories: AppCategory[]) {
  const expectedByName = new Set<string>(
    EXTERNAL_BASELINE_CATEGORIES.map((row) => row.name)
  );

  assert(
    categories.length >= EXTERNAL_BASELINE_CATEGORIES.length,
    `Expected at least ${EXTERNAL_BASELINE_CATEGORIES.length} categories, received ${categories.length}`
  );

  for (const expected of EXTERNAL_BASELINE_CATEGORIES) {
    const actual = categories.find((row) => row.name === expected.name);
    assert(actual, `Missing category "${expected.name}"`);
    assert(
      actual.icon === expected.icon,
      `Category "${expected.name}" icon mismatch: expected ${expected.icon}, got ${actual.icon}`
    );
    assert(
      actual.color === expected.color,
      `Category "${expected.name}" color mismatch: expected ${expected.color}, got ${actual.color}`
    );
  }

  const extras = categories
    .map((row) => row.name)
    .filter((name) => !expectedByName.has(name));

  if (extras.length > 0) {
    console.warn(
      `[External Verify] Warning: database contains extra categories beyond the baseline: ${extras.join(", ")}`
    );
  }
}

function selectVerificationResults(results: AgentSearchResult[]) {
  const selected: AgentSearchResult[] = [];

  for (const result of results) {
    if (result.has_gakuwari) {
      selected.push(result);
    }
    if (selected.length >= 2) {
      break;
    }
  }

  if (selected.length < 2) {
    for (const result of results) {
      if (!selected.some((row) => row.place_id === result.place_id)) {
        selected.push(result);
      }
      if (selected.length >= 2) {
        break;
      }
    }
  }

  assert(selected.length === 2, "Unable to choose two live verification spots");
  return selected;
}

async function ensureSpotExists(
  client: ReturnType<typeof createClient>,
  categoryId: number,
  result: AgentSearchResult
): Promise<CreatedSpotSummary> {
  const existing = await client.spot.list.query({
    search: result.name,
    limit: 20,
    offset: 0,
    sortBy: "newest",
  });

  const matched = existing.items.find(
    (item) => item.name === result.name && item.address === result.address
  );

  if (matched) {
    return {
      id: matched.id,
      name: matched.name,
    };
  }

  const created = await client.spot.create.mutate({
    name: result.name,
    description:
      "Created from live external-mode verification using /agent search results.",
    address: result.address,
    lat: String(result.lat),
    lng: String(result.lng),
    categoryId,
    discountDetail:
      result.discount_info ||
      "Agent verification completed but a detailed discount summary was unavailable.",
    discountRate: undefined,
    phone: undefined,
    website: result.website || result.source_url || undefined,
    openingHours: undefined,
    imageUrl: undefined,
  });

  return {
    id: created.id,
    name: result.name,
  };
}

async function ensureReviewExists(
  client: ReturnType<typeof createClient>,
  spotId: number,
  spotName: string
) {
  const existingReviews = await client.review.bySpot.query({ spotId });
  const existing = existingReviews.find(
    (review) => review.userName === VERIFICATION_REVIEW_NAME
  );

  if (existing) {
    return existing.id;
  }

  const created = await client.review.create.mutate({
    spotId,
    userName: VERIFICATION_REVIEW_NAME,
    rating: 5,
    comment: `Live external verification review for ${spotName}.`,
    imageUrl: undefined,
  });

  return created.id;
}

async function main() {
  const baseUrl = getBaseUrl();

  logStep(`Waiting for local server at ${baseUrl}`);
  await waitForServer(baseUrl);

  const client = createClient(baseUrl);

  logStep("Checking guest-first capabilities");
  const capabilities = await client.system.capabilities.query();
  assert(
    capabilities.deployMode === "external",
    `Expected deployMode=external, got ${capabilities.deployMode}`
  );
  assert(
    capabilities.authMode === "none",
    `Expected authMode=none, got ${capabilities.authMode}`
  );
  assert(
    capabilities.mapsMode === "google",
    `Expected mapsMode=google, got ${capabilities.mapsMode}`
  );
  assert(
    capabilities.storageMode === "disabled",
    `Expected storageMode=disabled, got ${capabilities.storageMode}`
  );
  assert(
    capabilities.canUploadImages === false,
    "Expected canUploadImages=false for the text-only verification pass"
  );

  logStep("Checking top-level app routes");
  for (const path of VERIFICATION_PAGE_PATHS) {
    const response = await fetchOk(`${baseUrl}${path}`);
    const html = await response.text();
    assert(
      html.toLowerCase().includes("<!doctype html>"),
      `Route ${path} did not return app HTML`
    );
  }

  logStep("Checking Maps JS proxy");
  const mapsResponse = await fetchOk(
    `${baseUrl}/api/maps-js?v=weekly&libraries=marker,places,geocoding,geometry`,
    {
      headers: {
        Origin: baseUrl,
        Referer: `${baseUrl}/agent`,
        Accept: "application/javascript",
      },
      expectedContentType: "javascript",
    }
  );
  const mapsBody = await mapsResponse.text();
  assert(
    mapsBody.includes("google.maps"),
    "Maps JS proxy did not return the Google Maps loader payload"
  );

  logStep("Checking category-only baseline");
  const categories = await client.category.list.query();
  verifyCategories(categories);

  const initialSpotList = await client.spot.list.query({
    limit: 100,
    offset: 0,
    sortBy: "newest",
  });
  const initialNearbySpots = await client.spot.nearby.query({
    lat: SHIBUYA_VERIFICATION_POINT.lat,
    lng: SHIBUYA_VERIFICATION_POINT.lng,
    radiusKm: 5,
    limit: 50,
  });

  if (initialSpotList.total > 0 || initialNearbySpots.length > 0) {
    console.warn(
      `[External Verify] Warning: expected a fresh DB baseline, but found spot.list.total=${initialSpotList.total} and spot.nearby=${initialNearbySpots.length}`
    );
  }

  logStep("Checking live Places nearby results");
  const nearbyPlaces = await client.agent.nearbyPlaces.query({
    lat: SHIBUYA_VERIFICATION_POINT.lat,
    lng: SHIBUYA_VERIFICATION_POINT.lng,
    radius: SHIBUYA_VERIFICATION_RADIUS_METERS,
  });
  assert(
    nearbyPlaces.shops.length > 0,
    "agent.nearbyPlaces returned no live Places results"
  );
  assert(
    nearbyPlaces.shops.some((shop) => Boolean(shop.website)),
    "Expected at least one nearby place with website enrichment from Place Details"
  );

  logStep("Checking live Gemini-backed /agent results");
  const agentResults = await client.agent.searchGakuwari.mutate({
    lat: SHIBUYA_VERIFICATION_POINT.lat,
    lng: SHIBUYA_VERIFICATION_POINT.lng,
    radius: SHIBUYA_VERIFICATION_RADIUS_METERS,
  });
  assert(
    agentResults.results.length > 0,
    "agent.searchGakuwari returned no results"
  );
  assert(
    agentResults.results.every((result) =>
      ["high", "medium", "low"].includes(result.confidence)
    ),
    "agent.searchGakuwari returned an invalid confidence value"
  );

  const selectedResults = selectVerificationResults(agentResults.results);
  const karaokeCategory =
    categories.find((row) => row.name === "カラオケ") ?? categories[0];
  assert(karaokeCategory, 'Missing required "カラオケ" category');

  logStep("Creating or reusing two real spots from live /agent results");
  const createdSpots: CreatedSpotSummary[] = [];
  for (const result of selectedResults) {
    const spot = await ensureSpotExists(client, karaokeCategory.id, result);
    createdSpots.push(spot);

    const stored = await client.spot.byId.query({ id: spot.id });
    assert(
      stored.name === result.name,
      `Stored spot name mismatch for ${result.name}`
    );
    assert(
      stored.address === result.address,
      `Stored spot address mismatch for ${result.name}`
    );

    await ensureReviewExists(client, spot.id, spot.name);
    const reviews = await client.review.bySpot.query({ spotId: spot.id });
    assert(reviews.length > 0, `Expected at least one review for ${spot.name}`);

    const refreshed = await client.spot.byId.query({ id: spot.id });
    assert(
      (refreshed.reviewCount ?? 0) > 0,
      `Expected reviewCount to update for ${spot.name}`
    );
    assert(
      (refreshed.avgRating ?? 0) > 0,
      `Expected avgRating to update for ${spot.name}`
    );
  }

  logStep("Re-checking list, search, and nearby database flows");
  const finalList = await client.spot.list.query({
    limit: 100,
    offset: 0,
    sortBy: "newest",
  });
  for (const spot of createdSpots) {
    assert(
      finalList.items.some((item) => item.id === spot.id),
      `spot.list did not include ${spot.name}`
    );

    const searchResults = await client.spot.list.query({
      search: spot.name,
      limit: 20,
      offset: 0,
      sortBy: "newest",
    });
    assert(
      searchResults.items.some((item) => item.id === spot.id),
      `spot.list search did not return ${spot.name}`
    );
  }

  const finalNearby = await client.spot.nearby.query({
    lat: SHIBUYA_VERIFICATION_POINT.lat,
    lng: SHIBUYA_VERIFICATION_POINT.lng,
    radiusKm: 5,
    limit: 50,
  });
  assert(
    createdSpots.some((spot) => finalNearby.some((item) => item.id === spot.id)),
    "spot.nearby did not surface either of the verification spots"
  );

  logStep("Verification complete");
  console.log(
    JSON.stringify(
      {
        capabilities,
        baseline: {
          categories: categories.length,
          initialSpotTotal: initialSpotList.total,
          initialNearbyCount: initialNearbySpots.length,
        },
        live: {
          nearbyPlaces: nearbyPlaces.shops.length,
          agentResults: agentResults.results.length,
          selectedSpotNames: createdSpots.map((spot) => spot.name),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[External Verify] Failed:", error);
  process.exitCode = 1;
});
