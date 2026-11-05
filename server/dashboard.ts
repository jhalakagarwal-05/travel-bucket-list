import { asc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import type { DashboardData } from "../shared/dashboard.js";
import { categories, destinations } from "../shared/schema.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireUser);

dashboardRouter.get("/", async (_request, response, next) => {
  try {
    // A single owner-scoped query keeps all displayed figures in the same snapshot.
    const rows = await db.select({
      categoryId: destinations.categoryId,
      name: categories.name,
      count: sql<number>`count(*)::integer`,
      visitedCount: sql<number>`count(*) filter (where ${destinations.status} = 'visited')::integer`,
      priorityTotal: sql<number>`coalesce(sum(${destinations.priority}), 0)::double precision`,
      priorityCount: sql<number>`count(${destinations.priority})::integer`,
    }).from(destinations)
      .leftJoin(categories, eq(destinations.categoryId, categories.id))
      .where(eq(destinations.userId, response.locals.user.id))
      .groupBy(destinations.categoryId, categories.name)
      .orderBy(asc(categories.name), asc(destinations.categoryId));

    const totals = rows.reduce((result, row) => ({
      totalDestinations: result.totalDestinations + row.count,
      visitedCount: result.visitedCount + row.visitedCount,
      priorityTotal: result.priorityTotal + row.priorityTotal,
      priorityCount: result.priorityCount + row.priorityCount,
    }), { totalDestinations: 0, visitedCount: 0, priorityTotal: 0, priorityCount: 0 });

    const dashboard: DashboardData = {
      totalDestinations: totals.totalDestinations,
      visitedCount: totals.visitedCount,
      averagePriority: totals.priorityCount ? totals.priorityTotal / totals.priorityCount : 0,
      categories: rows.map((row) => ({
        categoryId: row.categoryId,
        name: row.name || "Uncategorized",
        count: row.count,
      })),
    };
    response.json(dashboard);
  } catch (error) { next(error); }
});
