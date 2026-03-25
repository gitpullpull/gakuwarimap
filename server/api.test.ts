import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getAllCategories: vi.fn(),
    createCategory: vi.fn(),
    getSpots: vi.fn(),
    getSpotById: vi.fn(),
    getNearbySpots: vi.fn(),
    createSpot: vi.fn(),
    getReviewsBySpotId: vi.fn(),
    createReview: vi.fn(),
  };
});

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  createCategory,
  createReview,
  createSpot,
  getAllCategories,
  getNearbySpots,
  getReviewsBySpotId,
  getSpotById,
  getSpots,
} from "./db";
import { storagePut } from "./storage";

type CategoryFixture = {
  id: number;
  name: string;
  icon: string;
  color: string;
};

type SpotFixture = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  categoryId: number;
  discountDetail: string;
  discountRate: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  imageUrl: string | null;
  avgRating: number;
  reviewCount: number;
  isVerified: boolean;
  submittedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReviewFixture = {
  id: number;
  spotId: number;
  userName: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  userId: string | null;
  createdAt: Date;
};

const mockedGetAllCategories = vi.mocked(getAllCategories);
const mockedCreateCategory = vi.mocked(createCategory);
const mockedGetSpots = vi.mocked(getSpots);
const mockedGetSpotById = vi.mocked(getSpotById);
const mockedGetNearbySpots = vi.mocked(getNearbySpots);
const mockedCreateSpot = vi.mocked(createSpot);
const mockedGetReviewsBySpotId = vi.mocked(getReviewsBySpotId);
const mockedCreateReview = vi.mocked(createReview);
const mockedStoragePut = vi.mocked(storagePut);
const ORIGINAL_ENV = { ...process.env };

let categoriesState: CategoryFixture[] = [];
let spotsState: SpotFixture[] = [];
let reviewsState: ReviewFixture[] = [];
let nextCategoryId = 100;
let nextSpotId = 1000;
let nextReviewId = 5000;

function getDiscountRatePercentValue(discountRate: string | null): number | null {
  const match = discountRate?.match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

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

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recomputeSpotRatings(spotId: number) {
  const relatedReviews = reviewsState.filter((review) => review.spotId === spotId);
  const spot = spotsState.find((item) => item.id === spotId);

  if (!spot) {
    return;
  }

  if (relatedReviews.length === 0) {
    spot.avgRating = 0;
    spot.reviewCount = 0;
    return;
  }

  const totalRating = relatedReviews.reduce(
    (sum, review) => sum + review.rating,
    0
  );
  spot.avgRating = totalRating / relatedReviews.length;
  spot.reviewCount = relatedReviews.length;
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    DEPLOY_MODE: "external",
    GOOGLE_MAPS_SERVER_API_KEY: "google-test-key",
  };
  mockedStoragePut.mockReset();
  mockedStoragePut.mockResolvedValue({
    key: "images/mock.png",
    url: "https://cdn.example.com/images/mock.png",
  });

  categoriesState = [
    { id: 1, name: "カラオケ", icon: "mic", color: "#ef4444" },
    { id: 2, name: "カフェ", icon: "coffee", color: "#f59e0b" },
    { id: 3, name: "映画館", icon: "film", color: "#10b981" },
    { id: 4, name: "ボウリング", icon: "circle", color: "#3b82f6" },
    { id: 5, name: "ゲームセンター", icon: "gamepad-2", color: "#8b5cf6" },
    { id: 6, name: "ファストフード", icon: "hamburger", color: "#ec4899" },
    { id: 7, name: "書店", icon: "book", color: "#14b8a6" },
    { id: 8, name: "レジャー", icon: "sparkles", color: "#f97316" },
  ];

  spotsState = [
    {
      id: 101,
      name: "渋谷カラオケ学割館",
      description: "学生向けの割引があるカラオケ",
      address: "東京都渋谷区道玄坂1-1-1",
      lat: 35.658,
      lng: 139.7016,
      categoryId: 1,
      discountDetail: "学生証提示で室料10%OFF",
      discountRate: "10%OFF",
      phone: null,
      website: "https://example.com/karaoke",
      openingHours: null,
      imageUrl: null,
      avgRating: 4.5,
      reviewCount: 1,
      isVerified: true,
      submittedBy: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    },
    {
      id: 102,
      name: "新宿学生カフェ",
      description: "学生に人気のカフェ",
      address: "東京都新宿区西新宿1-2-3",
      lat: 35.6896,
      lng: 139.7006,
      categoryId: 2,
      discountDetail: "学生証提示でドリンク50円引き",
      discountRate: "50円引き",
      phone: null,
      website: "https://example.com/cafe",
      openingHours: null,
      imageUrl: null,
      avgRating: 4.2,
      reviewCount: 1,
      isVerified: true,
      submittedBy: null,
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
      updatedAt: new Date("2024-02-01T00:00:00.000Z"),
    },
    {
      id: 103,
      name: "蜑榊燕蟄ｦ蜑ｲ繝倥い繧ｵ繝ｭ繝ｳ",
      description: "30%OFF の学割ヘアサロン",
      address: "譚ｱ莠ｬ驛ｽ豐ｳ豕輔∈繝ｫ3-3-3",
      lat: 35.6712,
      lng: 139.764,
      categoryId: 8,
      discountDetail: "学生証提示で30%OFF",
      discountRate: "30%OFF",
      phone: null,
      website: "https://example.com/salon",
      openingHours: null,
      imageUrl: null,
      avgRating: 4.1,
      reviewCount: 0,
      isVerified: true,
      submittedBy: null,
      createdAt: new Date("2024-03-01T00:00:00.000Z"),
      updatedAt: new Date("2024-03-01T00:00:00.000Z"),
    },
    {
      id: 104,
      name: "蟄ｦ蜑ｲ譏逕ｻ鬢ｨ",
      description: "20%OFF の映画館",
      address: "譚ｱ莠ｬ驛ｽ譁ｰ螳ｿ蛹ｺ譏逕ｻ4-4-4",
      lat: 35.6945,
      lng: 139.7013,
      categoryId: 3,
      discountDetail: "学生料金で20%OFF",
      discountRate: "20%OFF",
      phone: null,
      website: "https://example.com/cinema",
      openingHours: null,
      imageUrl: null,
      avgRating: 4.8,
      reviewCount: 0,
      isVerified: true,
      submittedBy: null,
      createdAt: new Date("2024-04-01T00:00:00.000Z"),
      updatedAt: new Date("2024-04-01T00:00:00.000Z"),
    },
    {
      id: 105,
      name: "蟄ｦ蜑ｲ繝ｩ繝ｼ繝｡繝ｳ",
      description: "無料トッピングの学割ラーメン",
      address: "譚ｱ莠ｬ驛ｽ荳臥伐蛹ｺ5-5-5",
      lat: 35.6487,
      lng: 139.7414,
      categoryId: 6,
      discountDetail: "学生証提示でトッピング無料",
      discountRate: "トッピング無料",
      phone: null,
      website: "https://example.com/ramen",
      openingHours: null,
      imageUrl: null,
      avgRating: 4.4,
      reviewCount: 0,
      isVerified: true,
      submittedBy: null,
      createdAt: new Date("2024-05-01T00:00:00.000Z"),
      updatedAt: new Date("2024-05-01T00:00:00.000Z"),
    },
  ];

  reviewsState = [
    {
      id: 201,
      spotId: 101,
      userName: "テストユーザー",
      rating: 5,
      comment: "学生割引が使えて便利でした",
      imageUrl: null,
      userId: null,
      createdAt: new Date("2024-03-01T00:00:00.000Z"),
    },
    {
      id: 202,
      spotId: 102,
      userName: "カフェ好き",
      rating: 4,
      comment: "落ち着いた雰囲気でした",
      imageUrl: null,
      userId: null,
      createdAt: new Date("2024-03-05T00:00:00.000Z"),
    },
  ];

  nextCategoryId = 100;
  nextSpotId = 1000;
  nextReviewId = 5000;

  mockedGetAllCategories.mockImplementation(async () =>
    [...categoriesState].sort((a, b) => a.name.localeCompare(b.name, "ja"))
  );

  mockedCreateCategory.mockImplementation(async (data) => {
    const created = { id: nextCategoryId++, ...data } as CategoryFixture;
    categoriesState.push(created);
    return created as never;
  });

  mockedGetSpots.mockImplementation(async (opts = {}) => {
    let items = [...spotsState];

    if (opts.categoryId) {
      items = items.filter((spot) => spot.categoryId === opts.categoryId);
    }

    if (opts.search) {
      items = items.filter((spot) =>
        [spot.name, spot.address, spot.discountDetail].some((value) =>
          value.includes(opts.search!)
        )
      );
    }

    switch (opts.sortBy) {
      case "rating":
        items.sort((a, b) => Number(b.avgRating ?? 0) - Number(a.avgRating ?? 0));
        break;
      case "discountRate":
        items.sort((a, b) => {
          const leftPercent = getDiscountRatePercentValue(a.discountRate);
          const rightPercent = getDiscountRatePercentValue(b.discountRate);

          if (leftPercent !== null && rightPercent === null) return -1;
          if (leftPercent === null && rightPercent !== null) return 1;
          if (
            leftPercent !== null &&
            rightPercent !== null &&
            rightPercent !== leftPercent
          ) {
            return rightPercent - leftPercent;
          }

          const ratingDiff = Number(b.avgRating ?? 0) - Number(a.avgRating ?? 0);
          if (ratingDiff !== 0) {
            return ratingDiff;
          }

          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        break;
      case "name":
        items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        break;
      case "newest":
      default:
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;

    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
    } as never;
  });

  mockedGetSpotById.mockImplementation(
    async (id) => spotsState.find((spot) => spot.id === id) as never
  );

  mockedGetNearbySpots.mockImplementation(async (lat, lng, radiusKm = 5, limit = 50) => {
    return spotsState
      .map((spot) => ({
        ...spot,
        distance: distanceKm(lat, lng, spot.lat, spot.lng),
      }))
      .filter((spot) => spot.distance < radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit) as never;
  });

  mockedCreateSpot.mockImplementation(async (data) => {
    const created: SpotFixture = {
      id: nextSpotId++,
      name: data.name,
      description: data.description ?? null,
      address: data.address,
      lat: Number(data.lat),
      lng: Number(data.lng),
      categoryId: data.categoryId,
      discountDetail: data.discountDetail,
      discountRate: data.discountRate ?? null,
      phone: data.phone ?? null,
      website: data.website ?? null,
      openingHours: data.openingHours ?? null,
      imageUrl: data.imageUrl ?? null,
      avgRating: 0,
      reviewCount: 0,
      isVerified: false,
      submittedBy: data.submittedBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    spotsState.push(created);
    return { id: created.id } as never;
  });

  mockedGetReviewsBySpotId.mockImplementation(async (spotId) => {
    return [...reviewsState]
      .filter((review) => review.spotId === spotId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as never;
  });

  mockedCreateReview.mockImplementation(async (data) => {
    const created: ReviewFixture = {
      id: nextReviewId++,
      spotId: data.spotId,
      userName: data.userName,
      rating: data.rating,
      comment: data.comment ?? null,
      imageUrl: data.imageUrl ?? null,
      userId: data.userId ?? null,
      createdAt: new Date(),
    };
    reviewsState.push(created);
    recomputeSpotRatings(data.spotId);
    return { id: created.id } as never;
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("category.list", () => {
  it("returns an array of categories", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.category.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(8);

    const first = result[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("icon");
    expect(first).toHaveProperty("color");
  });
});

describe("spot.list", () => {
  it("returns paginated spots with total count", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.spot.list({ limit: 5, offset: 0 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.total).toBeGreaterThanOrEqual(1);

    const spot = result.items[0];
    expect(spot).toHaveProperty("id");
    expect(spot).toHaveProperty("name");
    expect(spot).toHaveProperty("address");
    expect(spot).toHaveProperty("discountDetail");
    expect(spot).toHaveProperty("categoryId");
  });

  it("filters by categoryId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const categories = await caller.category.list();
    const catId = categories[0].id;

    const result = await caller.spot.list({ categoryId: catId, limit: 50 });
    expect(result.items.length).toBeGreaterThanOrEqual(0);
    result.items.forEach((item) => {
      expect(item.categoryId).toBe(catId);
    });
  });

  it("searches by name or address", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spot.list({ search: "渋谷", limit: 50 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const hasMatch = result.items.some(
      (item) => item.name.includes("渋谷") || item.address.includes("渋谷")
    );
    expect(hasMatch).toBe(true);
  });

  it("sorts by rating descending", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spot.list({ sortBy: "rating", limit: 50 });
    const ratings = result.items.map((item) => Number(item.avgRating ?? 0));
    for (let index = 1; index < ratings.length; index += 1) {
      expect(ratings[index]).toBeLessThanOrEqual(ratings[index - 1]);
    }
  });

  it("accepts discountRate sorting and keeps percent discounts first", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spot.list({ sortBy: "discountRate", limit: 50 });
    const orderedDiscountRates = result.items.map((item) => item.discountRate);

    expect(orderedDiscountRates.slice(0, 5)).toEqual([
      "30%OFF",
      "20%OFF",
      "10%OFF",
      "トッピング無料",
      "50円引き",
    ]);
  });
});

describe("spot.byId", () => {
  it("returns a single spot by ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const listResult = await caller.spot.list({ limit: 1 });
    const spotId = listResult.items[0].id;

    const spot = await caller.spot.byId({ id: spotId });
    expect(spot).toHaveProperty("id", spotId);
    expect(spot).toHaveProperty("name");
    expect(spot).toHaveProperty("address");
    expect(spot).toHaveProperty("discountDetail");
  });

  it("throws error for non-existent spot", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.spot.byId({ id: 999999 })).rejects.toThrow("Spot not found");
  });
});

describe("spot.nearby", () => {
  it("returns spots near a given location with distance", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spot.nearby({
      lat: 35.6812,
      lng: 139.7671,
      radiusKm: 50,
      limit: 20,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);

    const first = result[0];
    expect(first).toHaveProperty("distance");
    expect(typeof first.distance).toBe("number");
    expect(first.distance).toBeGreaterThanOrEqual(0);
  });

  it("returns empty array for remote location", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spot.nearby({
      lat: -80.0,
      lng: 0.0,
      radiusKm: 1,
      limit: 20,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("review.bySpot", () => {
  it("returns reviews for a spot", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const listResult = await caller.spot.list({ sortBy: "rating", limit: 1 });
    const spotId = listResult.items[0].id;

    const reviews = await caller.review.bySpot({ spotId });
    expect(Array.isArray(reviews)).toBe(true);

    if (reviews.length > 0) {
      const review = reviews[0];
      expect(review).toHaveProperty("id");
      expect(review).toHaveProperty("spotId", spotId);
      expect(review).toHaveProperty("userName");
      expect(review).toHaveProperty("rating");
    }
  });
});

describe("spot.create", () => {
  it("creates a new spot and returns its ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const categories = await caller.category.list();
    const catId = categories[0].id;

    const result = await caller.spot.create({
      name: "テストスポット",
      address: "東京都テスト区テスト町1-1-1",
      lat: "35.6812000",
      lng: "139.7671000",
      categoryId: catId,
      discountDetail: "学生証提示で10%OFF",
      discountRate: "10%OFF",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    expect(result.id).toBeGreaterThan(0);

    const spot = await caller.spot.byId({ id: result.id });
    expect(spot.name).toBe("テストスポット");
    expect(spot.discountDetail).toBe("学生証提示で10%OFF");
  });
});

describe("review.create", () => {
  it("creates a new review and updates spot rating", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const listResult = await caller.spot.list({ limit: 1 });
    const spotId = listResult.items[0].id;

    const result = await caller.review.create({
      spotId,
      userName: "テストレビュアー",
      rating: 5,
      comment: "とても良いスポットでした",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    expect(result.id).toBeGreaterThan(0);

    const reviews = await caller.review.bySpot({ spotId });
    const created = reviews.find((review) => review.id === result.id);
    expect(created).toBeDefined();
    expect(created?.userName).toBe("テストレビュアー");
    expect(created?.rating).toBe(5);
    expect(created?.comment).toBe("とても良いスポットでした");
  });
});

describe("system.capabilities", () => {
  it("returns the fixed capability shape", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.system.capabilities();

    expect(result).toHaveProperty("deployMode");
    expect(result).toHaveProperty("authMode");
    expect(result).toHaveProperty("mapsMode");
    expect(result).toHaveProperty("storageMode");
    expect(result).toHaveProperty("canUploadImages");
  });
});

describe("upload.image", () => {
  it("returns an uploaded image url", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.upload.image({
      base64: Buffer.from("hello").toString("base64"),
      contentType: "image/png",
      fileName: "photo.png",
    });

    expect(result).toEqual({
      url: "https://cdn.example.com/images/mock.png",
    });
    expect(mockedStoragePut).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported content types", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.upload.image({
        base64: Buffer.from("hello").toString("base64"),
        contentType: "image/svg+xml",
        fileName: "vector.svg",
      })
    ).rejects.toThrow("Unsupported image type");
  });
});
