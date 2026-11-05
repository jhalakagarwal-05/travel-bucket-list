import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { destinations, users } from "../shared/schema.js";
import type { DashboardData } from "../shared/dashboard.js";

const userIds: number[] = [];
async function account() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({
    email: `dashboard-${randomUUID()}@example.com`,
    password: "travel-test-password",
  });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id);
  return { agent, userId: response.body.user.id as number };
}

async function add(agent: ReturnType<typeof request.agent>, values: Record<string, unknown> = {}) {
  const result = await agent.post("/api/destinations").send({
    name: "Kyoto", country: "Japan", priority: 3, status: "dream", ...values,
  });
  expect(result.status).toBe(201);
  return result.body.destination.id as number;
}

async function dashboard(agent: ReturnType<typeof request.agent>): Promise<DashboardData> {
  const result = await agent.get("/api/dashboard");
  expect(result.status).toBe(200);
  return result.body;
}

describe("private Dashboard", () => {
  it("requires login", async () => {
    expect((await request(app).get("/api/dashboard")).status).toBe(401);
  });

  it("returns zero stats and an empty category series for an empty list", async () => {
    const { agent } = await account();
    expect(await dashboard(agent)).toEqual({
      totalDestinations: 0, visitedCount: 0, averagePriority: 0, categories: [],
    });
    await agent.post("/api/auth/logout");
  });

  it("counts categories and visited destinations and shows 3.7 for priorities 2, 4, and 5", async () => {
    const { agent } = await account();
    const allCategories = (await agent.get("/api/categories")).body.categories as {id: number; name: string}[];
    const cityId = allCategories.find((category) => category.name === "City")!.id;
    const foodId = allCategories.find((category) => category.name === "Food")!.id;
    await add(agent, { priority: 2, status: "visited", categoryId: cityId });
    await add(agent, { name: "Tokyo", priority: 4, status: "planned", categoryId: cityId });
    await add(agent, { name: "Osaka", priority: 5, status: "visited", categoryId: foodId });

    const result = await dashboard(agent);
    expect(result.totalDestinations).toBe(3);
    expect(result.visitedCount).toBe(2);
    expect(result.averagePriority.toFixed(1)).toBe("3.7");
    expect(result.categories).toEqual([
      { categoryId: cityId, name: "City", count: 2 },
      { categoryId: foodId, name: "Food", count: 1 },
    ]);
    expect(result.categories.reduce((total, category) => total + category.count, 0)).toBe(3);
    await agent.post("/api/auth/logout");
  });

  it("never includes another user's destinations or accepts a query-string owner override", async () => {
    const owner = await account();
    const other = await account();
    await add(owner.agent, { priority: 5, status: "visited" });
    await add(owner.agent, { priority: 4, status: "visited" });
    expect((await dashboard(other.agent)).totalDestinations).toBe(0);
    await add(other.agent, { priority: 1, status: "planned" });
    const ownerResult = await dashboard(owner.agent);
    expect(ownerResult).toMatchObject({ totalDestinations: 2, visitedCount: 2, averagePriority: 4.5 });
    const spoofed = await other.agent.get(`/api/dashboard?userId=${owner.userId}`);
    expect(spoofed.status).toBe(200);
    expect(spoofed.body).toMatchObject({ totalDestinations: 1, visitedCount: 0, averagePriority: 1 });
    expect(spoofed.body.categories).toEqual([{ categoryId: null, name: "Uncategorized", count: 1 }]);
    await owner.agent.post("/api/auth/logout");
    await other.agent.post("/api/auth/logout");
  });

  it("reflects edits and deletions without stale figures", async () => {
    const { agent } = await account();
    const id = await add(agent, { priority: 2 });
    expect((await dashboard(agent)).averagePriority).toBe(2);
    expect((await agent.put(`/api/destinations/${id}`).send({
      name: "Kyoto", country: "Japan", priority: 5, status: "visited",
    })).status).toBe(200);
    expect(await dashboard(agent)).toMatchObject({ totalDestinations: 1, visitedCount: 1, averagePriority: 5 });
    expect((await agent.delete(`/api/destinations/${id}`)).status).toBe(204);
    expect(await dashboard(agent)).toEqual({
      totalDestinations: 0, visitedCount: 0, averagePriority: 0, categories: [],
    });
    await agent.post("/api/auth/logout");
  });

  it("includes uncategorized entries and excludes missing priorities from the average", async () => {
    const { agent, userId } = await account();
    await db.insert(destinations).values({
      name: "Earlier trip", country: "Japan", userId, priority: null, status: "visited",
    });
    await add(agent, { priority: 4 });
    const result = await dashboard(agent);
    expect(result).toEqual({
      totalDestinations: 2, visitedCount: 1, averagePriority: 4,
      categories: [{ categoryId: null, name: "Uncategorized", count: 2 }],
    });
    await agent.post("/api/auth/logout");
  });
});

afterAll(async () => {
  if (userIds.length) {
    await db.delete(destinations).where(inArray(destinations.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await pool.end();
});
