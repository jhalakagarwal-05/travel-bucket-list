import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { destinations, stars, users } from "../shared/schema.js";

const userIds: number[] = [];

async function account() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({
    email: `stars-${randomUUID()}@example.com`,
    password: "travel-test-password",
  });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id);
  return { agent, userId: response.body.user.id as number };
}

async function destination(agent: ReturnType<typeof request.agent>, name = "Kyoto") {
  const response = await agent.post("/api/destinations").send({ name, country: "Japan" });
  expect(response.status).toBe(201);
  return response.body.destination.id as number;
}

describe("private destination stars", () => {
  it("requires a session for the starred list and both toggle actions", async () => {
    expect((await request(app).get("/api/starred")).status).toBe(401);
    expect((await request(app).put("/api/destinations/1/star")).status).toBe(401);
    expect((await request(app).delete("/api/destinations/1/star")).status).toBe(401);
  });

  it("persists stars across list, detail, and a fresh login, and unstarring keeps the destination", async () => {
    const { agent } = await account();
    const id = await destination(agent);
    const url = `/api/destinations/${id}`;
    expect((await agent.get(url)).body.destination.starred).toBe(false);
    expect((await agent.get("/api/starred")).body.destinations).toEqual([]);

    expect((await agent.put(`${url}/star`)).body).toEqual({ starred: true });
    expect((await agent.get("/api/destinations")).body.destinations[0].starred).toBe(true);
    expect((await agent.get(url)).body.destination.starred).toBe(true);
    expect((await agent.get("/api/starred")).body.destinations).toMatchObject([{ id, starred: true }]);

    const me = await agent.get("/api/auth/me");
    await agent.post("/api/auth/logout");
    expect((await agent.post("/api/auth/login").send({
      email: me.body.user.email, password: "travel-test-password",
    })).status).toBe(200);
    expect((await agent.get(url)).body.destination.starred).toBe(true);
    expect((await agent.delete(`${url}/star`)).body).toEqual({ starred: false });
    expect((await agent.get("/api/starred")).body.destinations).toEqual([]);
    expect((await agent.get(url)).body.destination.starred).toBe(false);
    expect((await agent.get("/api/destinations")).body.destinations).toHaveLength(1);
    await agent.post("/api/auth/logout");
  });

  it("allows only one row per user and destination, including concurrent star requests", async () => {
    const { agent, userId } = await account();
    const id = await destination(agent);
    const responses = await Promise.all(Array.from({ length: 4 }, () => agent.put(`/api/destinations/${id}/star`)));
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.starred).toBe(true);
    }
    const rows = await db.select().from(stars).where(and(eq(stars.userId, userId), eq(stars.destinationId, id)));
    expect(rows).toHaveLength(1);
    await expect(db.insert(stars).values({ userId, destinationId: id }))
      .rejects.toMatchObject({ cause: { code: "23505" } });
    expect((await agent.delete(`/api/destinations/${id}/star`)).status).toBe(200);
    expect((await agent.delete(`/api/destinations/${id}/star`)).body).toEqual({ starred: false });
    await agent.post("/api/auth/logout");
  });

  it("keeps both users' starred lists private and forbids starring or unstarring foreign destinations", async () => {
    const owner = await account();
    const other = await account();
    const ownerId = await destination(owner.agent);
    const otherId = await destination(other.agent, "Tokyo");
    await owner.agent.put(`/api/destinations/${ownerId}/star`);
    expect((await other.agent.get("/api/starred")).body.destinations).toEqual([]);
    expect((await other.agent.put(`/api/destinations/${ownerId}/star`)).status).toBe(404);
    expect((await other.agent.delete(`/api/destinations/${ownerId}/star`)).status).toBe(404);
    expect((await other.agent.get(`/api/destinations/${ownerId}`)).status).toBe(404);
    expect((await owner.agent.get(`/api/destinations/${ownerId}`)).body.destination.starred).toBe(true);
    await other.agent.put(`/api/destinations/${otherId}/star`);
    expect((await owner.agent.get("/api/starred")).body.destinations.map((item: {id: number}) => item.id)).toEqual([ownerId]);
    expect((await other.agent.get("/api/starred")).body.destinations.map((item: {id: number}) => item.id)).toEqual([otherId]);
    await owner.agent.post("/api/auth/logout");
    await other.agent.post("/api/auth/logout");
  });

  it("handles missing and invalid destinations without inserting a star", async () => {
    const { agent, userId } = await account();
    for (const id of ["0", "-1", "not-a-number", "2147483647"]) {
      expect((await agent.put(`/api/destinations/${id}/star`)).status).toBe(404);
      expect((await agent.delete(`/api/destinations/${id}/star`)).status).toBe(404);
    }
    expect(await db.select().from(stars).where(eq(stars.userId, userId))).toEqual([]);
    await agent.post("/api/auth/logout");
  });

  it("removes dependent stars when deleting a destination", async () => {
    const { agent } = await account();
    const id = await destination(agent);
    await agent.put(`/api/destinations/${id}/star`);
    expect((await agent.delete(`/api/destinations/${id}`)).status).toBe(204);
    expect(await db.select().from(stars).where(eq(stars.destinationId, id))).toEqual([]);
    expect((await agent.get("/api/starred")).body.destinations).toEqual([]);
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
