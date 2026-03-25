import { eq, desc, asc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  categories, InsertCategory, Category,
  spots, InsertSpot, Spot,
  reviews, InsertReview, Review,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============== Users ==============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============== Categories ==============

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values(data);
  return { id: result[0].insertId, ...data };
}

// ============== Spots ==============

export async function getSpots(opts: {
  categoryId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: "rating" | "newest" | "name" | "discountRate";
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (opts.categoryId) {
    conditions.push(eq(spots.categoryId, opts.categoryId));
  }
  if (opts.search) {
    conditions.push(
      sql`(${spots.name} LIKE ${`%${opts.search}%`} OR ${spots.address} LIKE ${`%${opts.search}%`} OR ${spots.discountDetail} LIKE ${`%${opts.search}%`})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const discountPercentPattern = String.raw`[0-9]+(\.[0-9]+)?%`;
  const discountNumberPattern = String.raw`[0-9]+(\.[0-9]+)?`;
  const baseItemsQuery = db
    .select()
    .from(spots)
    .where(where)
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0);

  let itemsQuery = baseItemsQuery.orderBy(desc(spots.createdAt));
  switch (opts.sortBy) {
    case "rating":
      itemsQuery = baseItemsQuery.orderBy(desc(spots.avgRating));
      break;
    case "discountRate":
      itemsQuery = baseItemsQuery.orderBy(
        sql`CASE WHEN ${spots.discountRate} REGEXP ${discountPercentPattern} THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${spots.discountRate} REGEXP ${discountPercentPattern}
          THEN CAST(REGEXP_SUBSTR(${spots.discountRate}, ${discountNumberPattern}) AS DECIMAL(10, 2))
          ELSE NULL
        END DESC`,
        desc(spots.avgRating),
        desc(spots.createdAt)
      );
      break;
    case "name":
      itemsQuery = baseItemsQuery.orderBy(asc(spots.name));
      break;
    case "newest":
    default:
      itemsQuery = baseItemsQuery.orderBy(desc(spots.createdAt));
      break;
  }

  const [items, countResult] = await Promise.all([
    itemsQuery,
    db.select({ count: sql<number>`count(*)` }).from(spots).where(where),
  ]);

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getSpotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(spots).where(eq(spots.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getNearbySpots(lat: number, lng: number, radiusKm: number = 5, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  // Haversine formula in SQL for distance calculation
  const distanceExpr = sql`(
    6371 * acos(
      cos(radians(${lat})) * cos(radians(${spots.lat})) *
      cos(radians(${spots.lng}) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(${spots.lat}))
    )
  )`;

  return db
    .select({
      id: spots.id,
      name: spots.name,
      description: spots.description,
      address: spots.address,
      lat: spots.lat,
      lng: spots.lng,
      categoryId: spots.categoryId,
      discountDetail: spots.discountDetail,
      discountRate: spots.discountRate,
      phone: spots.phone,
      website: spots.website,
      openingHours: spots.openingHours,
      imageUrl: spots.imageUrl,
      avgRating: spots.avgRating,
      reviewCount: spots.reviewCount,
      isVerified: spots.isVerified,
      submittedBy: spots.submittedBy,
      createdAt: spots.createdAt,
      updatedAt: spots.updatedAt,
      distance: sql<number>`${distanceExpr}`.as("distance"),
    })
    .from(spots)
    .where(sql`${distanceExpr} < ${radiusKm}`)
    .orderBy(sql`distance`)
    .limit(limit);
}

export async function createSpot(data: InsertSpot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(spots).values(data);
  return { id: result[0].insertId };
}

export async function updateSpotRating(spotId: number) {
  const db = await getDb();
  if (!db) return;
  const result = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(eq(reviews.spotId, spotId));

  if (result[0]) {
    await db
      .update(spots)
      .set({
        avgRating: result[0].avg,
        reviewCount: result[0].count,
      })
      .where(eq(spots.id, spotId));
  }
}

// ============== Reviews ==============

export async function getReviewsBySpotId(spotId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.spotId, spotId)).orderBy(desc(reviews.createdAt));
}

export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(data);
  // Update spot's average rating
  await updateSpotRating(data.spotId);
  return { id: result[0].insertId };
}
