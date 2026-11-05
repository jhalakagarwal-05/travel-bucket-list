import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { categories, destinations, shareLinks } from "../shared/schema.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const shareRouter = Router();
shareRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
shareRouter.use(requireUser);

shareRouter.get("/", async (_request, response, next) => {
  try {
    const [activeLink] = await db.select({ createdAt: shareLinks.createdAt })
      .from(shareLinks)
      .where(eq(shareLinks.userId, response.locals.user.id))
      .orderBy(desc(shareLinks.createdAt))
      .limit(1);
    response.json({
      active: Boolean(activeLink),
      createdAt: activeLink?.createdAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

shareRouter.post("/", async (_request, response, next) => {
  const userId = response.locals.user.id;
  const token = randomBytes(32).toString("base64url");
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);
      await transaction.delete(shareLinks).where(eq(shareLinks.userId, userId));
      await transaction.insert(shareLinks).values({
        userId,
        token: tokenDigest(token),
      });
    });
    response.status(201).json({ sharePath: `/share/${token}` });
  } catch (error) {
    next(error);
  }
});

shareRouter.delete("/", async (_request, response, next) => {
  try {
    await db.delete(shareLinks).where(eq(shareLinks.userId, response.locals.user.id));
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export const publicShareRouter = Router();
publicShareRouter.get("/share/:token", async (request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  const token = request.params.token;
  if (!tokenPattern.test(token)) {
    response.status(404).json({ error: "This shared list is unavailable." });
    return;
  }

  try {
    const [link] = await db.select({ userId: shareLinks.userId })
      .from(shareLinks)
      .where(eq(shareLinks.token, tokenDigest(token)))
      .limit(1);
    if (!link) {
      response.status(404).json({ error: "This shared list is unavailable." });
      return;
    }

    const rows = await db.select({
      id: destinations.id,
      name: destinations.name,
      country: destinations.country,
      categoryName: categories.name,
      status: sql<string>`COALESCE(${destinations.status}, 'dream')`,
      priority: sql<number>`COALESCE(${destinations.priority}, 3)`,
      estimatedCost: destinations.estimatedCost,
      visitedDate: destinations.visitedDate,
      notes: destinations.notes,
      latitude: destinations.latitude,
      longitude: destinations.longitude,
      createdAt: destinations.createdAt,
    })
      .from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(eq(destinations.userId, link.userId))
      .orderBy(desc(destinations.id));

    response.json({ destinations: rows });
  } catch (error) {
    next(error);
  }
});
