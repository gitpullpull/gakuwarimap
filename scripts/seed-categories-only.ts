import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { asc, sql } from "drizzle-orm";
import { categories, reviews, spots, users } from "../drizzle/schema";
import { EXTERNAL_BASELINE_CATEGORIES } from "./_shared/externalBaseline";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Point it at the dedicated external verification MySQL database."
    );
  }

  return url;
}

async function main() {
  const db = drizzle(requireDatabaseUrl());

  console.log("[External DB] Seeding category-only baseline");

  for (const row of EXTERNAL_BASELINE_CATEGORIES) {
    await db
      .insert(categories)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          icon: row.icon,
          color: row.color,
        },
      });
  }

  const [categoryRows, spotCountRows, reviewCountRows, userCountRows] =
    await Promise.all([
      db.select().from(categories).orderBy(asc(categories.name)),
      db.select({ count: sql<number>`count(*)` }).from(spots),
      db.select({ count: sql<number>`count(*)` }).from(reviews),
      db.select({ count: sql<number>`count(*)` }).from(users),
    ]);

  console.log(
    `[External DB] Categories ready: ${categoryRows.length} rows (${categoryRows
      .map((row) => row.name)
      .join(", ")})`
  );
  console.log(
    `[External DB] Current baseline counts -> spots=${spotCountRows[0]?.count ?? 0}, reviews=${reviewCountRows[0]?.count ?? 0}, users=${userCountRows[0]?.count ?? 0}`
  );
  console.log(
    "[External DB] Expected fresh baseline is categories only. If counts above are non-zero, use a new database for a clean verification run."
  );
}

main()
  .catch((error) => {
    console.error("[External DB] Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 0);
  });
