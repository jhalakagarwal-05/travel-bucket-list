import { eq, inArray } from "drizzle-orm";
import { categories, destinations } from "../shared/schema.js";
import { db, pool } from "./db.js";

const categoryNames = ["Beach", "City", "Mountains", "Food", "Culture", "Vibes"];

try {
  await db.transaction(async (transaction) => {
    const existing = await transaction
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.id);

    let mountainsId =
      existing.find((category) => category.name === "Mountains")?.id ??
      existing.find((category) => category.name === "Hiking")?.id ??
      existing.find((category) => category.name === "Family")?.id;

    if (mountainsId === undefined) {
      const [mountains] = await transaction
        .insert(categories)
        .values({ name: "Mountains" })
        .returning({ id: categories.id });
      mountainsId = mountains.id;
    } else if (!existing.some((category) => category.id === mountainsId && category.name === "Mountains")) {
      await transaction.update(categories)
        .set({ name: "Mountains" })
        .where(eq(categories.id, mountainsId));
    }

    const mergedCategoryIds = existing
      .filter((category) =>
        ["Mountains", "Hiking", "Family"].includes(category.name ?? "") &&
        category.id !== mountainsId
      )
      .map((category) => category.id);

    if (mergedCategoryIds.length > 0) {
      await transaction.update(destinations)
        .set({ categoryId: mountainsId })
        .where(inArray(destinations.categoryId, mergedCategoryIds));
      await transaction.delete(categories)
        .where(inArray(categories.id, mergedCategoryIds));
    }

    const current = await transaction.select({ name: categories.name }).from(categories);
    const currentNames = new Set(current.map((category) => category.name));
    const missing = categoryNames.filter((name) => !currentNames.has(name));

    if (missing.length > 0) {
      await transaction.insert(categories).values(missing.map((name) => ({ name })));
    }
  });
  console.log("Categories ready: Beach, City, Mountains, Food, Culture, Vibes.");
} catch (error) {
  console.error("Category seeding failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
