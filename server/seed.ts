import { inArray } from "drizzle-orm";
import { categories } from "../shared/schema.js";
import { db, pool } from "./db.js";

const categoryNames = ["Beach", "City", "Hiking", "Food", "Family"];

try {
  await db.transaction(async (transaction) => {
    const existing = await transaction
      .select({ name: categories.name })
      .from(categories)
      .where(inArray(categories.name, categoryNames));
    const existingNames = new Set(existing.map((category) => category.name));
    const missing = categoryNames.filter((name) => !existingNames.has(name));

    if (missing.length > 0) {
      await transaction.insert(categories).values(missing.map((name) => ({ name })));
    }
  });
  console.log("Categories seeded: Beach, City, Hiking, Food, Family.");
} catch (error) {
  console.error("Category seeding failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
