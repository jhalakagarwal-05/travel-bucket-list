import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type RequestHandler } from "express";
import { categories, destinations, stars } from "../shared/schema.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";

export const travelRouter = Router();
travelRouter.use(requireUser);

// All destination reads below are owner-scoped; the matching owner's star is private.
const isStarred = sql<boolean>`exists (
  select 1 from ${stars}
  where ${stars.destinationId} = ${destinations.id}
    and ${stars.userId} = ${destinations.userId}
)`;

const selection = {
  id: destinations.id,
  name: destinations.name,
  country: destinations.country,
  categoryId: destinations.categoryId,
  categoryName: categories.name,
  latitude: destinations.latitude,
  longitude: destinations.longitude,
  status: destinations.status,
  priority: destinations.priority,
  estimatedCost: destinations.estimatedCost,
  visitedDate: destinations.visitedDate,
  notes: destinations.notes,
  createdAt: destinations.createdAt,
  starred: isStarred.as("starred"),
};

function owned(id: number, userId: number) {
  return and(eq(destinations.id, id), eq(destinations.userId, userId));
}

function parseId(value: string): number | undefined {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0
    ? number
    : undefined;
}

async function validate(body: Record<string, unknown>) {
  const fieldErrors: Record<string, string> = {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  if (!name) fieldErrors.name = "Please enter a destination name.";
  if (!country) fieldErrors.country = "Please enter a country.";

  const status = body.status ?? "dream";
  if (!["dream", "planned", "visited"].includes(String(status))) {
    fieldErrors.status = "Please choose dream, planned, or visited.";
  }
  const priority = body.priority === undefined ? 3 : Number(body.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    fieldErrors.priority = "Please choose a priority from 1 to 5.";
  }
  const categoryId =
    body.categoryId === undefined || body.categoryId === null || body.categoryId === ""
      ? null
      : Number(body.categoryId);
  if (categoryId !== null) {
    if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
      fieldErrors.categoryId = "Please choose an available category.";
    } else {
      const [category] = await db.select({ id: categories.id }).from(categories)
        .where(eq(categories.id, categoryId)).limit(1);
      if (!category) fieldErrors.categoryId = "Please choose an available category.";
    }
  }
  const estimatedCost =
    body.estimatedCost === undefined || body.estimatedCost === null || body.estimatedCost === ""
      ? null : String(body.estimatedCost).trim();
  if (estimatedCost !== null && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(estimatedCost)) {
    fieldErrors.estimatedCost = "Please enter a valid cost of zero or more.";
  }
  const visitedDate = body.visitedDate === undefined || body.visitedDate === null || body.visitedDate === ""
    ? null : String(body.visitedDate);
  if (visitedDate !== null) {
    const parsed = new Date(`${visitedDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedDate) ||
        !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== visitedDate) {
      fieldErrors.visitedDate = "Please enter a valid visited date.";
    }
  }
  const readCoordinate = (key: "latitude" | "longitude", limit: number) => {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === "" ||
        (typeof raw === "string" && raw.trim() === "")) return null;
    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
    if (!Number.isFinite(value) || Math.abs(value) > limit) {
      fieldErrors[key] = `Please enter a valid ${key === "latitude" ? "latitude (−90 to 90)" : "longitude (−180 to 180)"}.`;
      return null;
    }
    return value;
  };
  const latitude = readCoordinate("latitude", 90);
  const longitude = readCoordinate("longitude", 180);
  if ((latitude === null) !== (longitude === null)) {
    const message = "Enter both latitude and longitude, or leave both blank.";
    fieldErrors.latitude ||= message;
    fieldErrors.longitude ||= message;
  }
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
    fieldErrors.notes = "Please enter notes as text.";
  }
  return {
    fieldErrors,
    values: {
      name, country, categoryId,
      status: status as "dream" | "planned" | "visited",
      priority, estimatedCost, visitedDate,
      latitude, longitude,
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  };
}

travelRouter.get("/categories", async (_request, response, next) => {
  try {
    response.json({ categories: await db.select().from(categories).orderBy(categories.id) });
  } catch (error) { next(error); }
});

travelRouter.get("/destinations", async (_request, response, next) => {
  try {
    const rows = await db.select(selection).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(eq(destinations.userId, response.locals.user.id))
      .orderBy(desc(destinations.id));
    response.json({ destinations: rows });
  } catch (error) { next(error); }
});

travelRouter.get("/starred", async (_request, response, next) => {
  try {
    const rows = await db.select(selection).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(and(eq(destinations.userId, response.locals.user.id), isStarred))
      .orderBy(desc(destinations.id));
    response.json({ destinations: rows });
  } catch (error) { next(error); }
});

function setStar(starred: boolean): RequestHandler {
  return async (request, response, next) => {
    try {
      const id = parseId(request.params.id);
      const userId: number = response.locals.user.id;
      if (!id) {
        response.status(404).json({ error: "Destination not found." });
        return;
      }
      const found = await db.transaction(async (transaction) => {
        // Serialize toggles and deletion on this owned destination.
        const [destination] = await transaction.select({ id: destinations.id })
          .from(destinations).where(owned(id, userId)).limit(1).for("update");
        if (!destination) return false;
        if (starred) {
          await transaction.insert(stars).values({ userId, destinationId: id })
            .onConflictDoNothing({ target: [stars.userId, stars.destinationId] });
        } else {
          await transaction.delete(stars)
            .where(and(eq(stars.userId, userId), eq(stars.destinationId, id)));
        }
        return true;
      });
      if (!found) {
        response.status(404).json({ error: "Destination not found." });
        return;
      }
      response.json({ starred });
    } catch (error) { next(error); }
  };
}

travelRouter.put("/destinations/:id/star", setStar(true));
travelRouter.delete("/destinations/:id/star", setStar(false));

travelRouter.get("/destinations/:id", async (request, response, next) => {
  try {
    const id = parseId(request.params.id);
    const [destination] = id ? await db.select(selection).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(owned(id, response.locals.user.id)).limit(1) : [];
    if (!destination) {
      response.status(404).json({ error: "Destination not found." });
      return;
    }
    response.json({ destination });
  } catch (error) { next(error); }
});

travelRouter.post("/destinations", async (request, response, next) => {
  try {
    const { values, fieldErrors } = await validate(request.body ?? {});
    if (Object.keys(fieldErrors).length) {
      response.status(400).json({ error: "Please check the highlighted fields.", fieldErrors });
      return;
    }
    const [created] = await db.insert(destinations).values({
      ...values, userId: response.locals.user.id, createdAt: new Date().toISOString().slice(0, 10),
    }).returning({ id: destinations.id });
    const [destination] = await db.select(selection).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(owned(created.id, response.locals.user.id));
    response.status(201).json({ destination });
  } catch (error) { next(error); }
});

travelRouter.put("/destinations/:id", async (request, response, next) => {
  try {
    const id = parseId(request.params.id);
    const [existing] = id ? await db.select({ id: destinations.id }).from(destinations)
      .where(owned(id, response.locals.user.id)).limit(1) : [];
    if (!id || !existing) {
      response.status(404).json({ error: "Destination not found." });
      return;
    }
    const { values, fieldErrors } = await validate(request.body ?? {});
    if (Object.keys(fieldErrors).length) {
      response.status(400).json({ error: "Please check the highlighted fields.", fieldErrors });
      return;
    }
    const [updated] = await db.update(destinations).set(values)
      .where(owned(id, response.locals.user.id)).returning({ id: destinations.id });
    if (!updated) {
      response.status(404).json({ error: "Destination not found." });
      return;
    }
    const [destination] = await db.select(selection).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(owned(id, response.locals.user.id));
    response.json({ destination });
  } catch (error) { next(error); }
});

travelRouter.delete("/destinations/:id", async (request, response, next) => {
  try {
    const id = parseId(request.params.id);
    const [deleted] = id ? await db.delete(destinations)
      .where(owned(id, response.locals.user.id)).returning({ id: destinations.id }) : [];
    if (!deleted) {
      response.status(404).json({ error: "Destination not found." });
      return;
    }
    response.status(204).end();
  } catch (error) { next(error); }
});
