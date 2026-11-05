import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { destinations, shareLinks, users } from "../shared/schema.js";

const userIds: number[] = [];

async function account() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({
    email: `share-${randomUUID()}@example.com`,
    password: "travel-test-password",
  });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id);
  return { agent, userId: response.body.user.id as number };
}

describe("private share-link management and public read-only lists", () => {
  it("keeps share management protected while allowing unauthenticated invalid-link responses", async () => {
    expect((await request(app).get("/api/share-links")).status).toBe(401);
    expect((await request(app).post("/api/share-links")).status).toBe(401);
    expect((await request(app).delete("/api/share-links")).status).toBe(401);
    const invalid = await request(app).get("/api/public/share/not-a-token");
    expect(invalid.status).toBe(404);
    expect(invalid.body.error).toMatch(/unavailable/i);
  });

  it("creates a strong hashed token, shares only its owner's list, and revokes it", async () => {
    const owner = await account();
    const other = await account();
    const ownerDestination = await owner.agent.post("/api/destinations").send({
      name: "Kyoto", country: "Japan", categoryId: null, status: "visited", priority: 5,
      estimatedCost: "1200", visitedDate: "2026-04-10", notes: "See the gardens.",
      latitude: 35.0116, longitude: 135.7681,
    });
    await other.agent.post("/api/destinations").send({
      name: "Paris", country: "France", categoryId: null, status: "dream", priority: 4,
    });
    expect(ownerDestination.status).toBe(201);
    expect((await owner.agent.get("/api/share-links")).body).toEqual({ active: false, createdAt: null });

    const created = await owner.agent.post("/api/share-links");
    expect(created.status).toBe(201);
    expect(created.body.sharePath).toMatch(/^\/share\/[A-Za-z0-9_-]{43}$/);
    const token = created.body.sharePath.split("/").at(-1) as string;

    const stored = await db.select({ token: shareLinks.token })
      .from(shareLinks)
      .where(inArray(shareLinks.userId, [owner.userId]));
    expect(stored).toHaveLength(1);
    expect(stored[0].token).toBe(createHash("sha256").update(token).digest("hex"));
    expect(stored[0].token).not.toBe(token);

    const publicResponse = await request(app).get(`/api/public/share/${token}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(publicResponse.body).toMatchObject({
      destinations: [{
        id: ownerDestination.body.destination.id,
        name: "Kyoto",
        country: "Japan",
        status: "visited",
        priority: 5,
        estimatedCost: "1200",
        visitedDate: "2026-04-10",
        notes: "See the gardens.",
        latitude: 35.0116,
        longitude: 135.7681,
      }],
    });
    expect(publicResponse.body).not.toHaveProperty("user");
    expect(publicResponse.body.destinations[0]).not.toHaveProperty("userId");
    expect(publicResponse.body.destinations[0]).not.toHaveProperty("starred");
    expect(JSON.stringify(publicResponse.body)).not.toContain("share-");
    expect((await other.agent.get("/api/share-links")).body.active).toBe(false);
    await other.agent.delete("/api/share-links");
    expect((await request(app).get(`/api/public/share/${token}`)).status).toBe(200);

    const replacement = await owner.agent.post("/api/share-links");
    expect(replacement.status).toBe(201);
    const replacementToken = replacement.body.sharePath.split("/").at(-1) as string;
    expect(replacementToken).not.toBe(token);
    expect((await request(app).get(`/api/public/share/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/public/share/${replacementToken}`)).status).toBe(200);

    expect((await owner.agent.delete("/api/share-links")).status).toBe(204);
    expect((await owner.agent.get("/api/share-links")).body).toEqual({ active: false, createdAt: null });
    expect((await request(app).get(`/api/public/share/${replacementToken}`)).status).toBe(404);
    await owner.agent.post("/api/auth/logout");
    await other.agent.post("/api/auth/logout");
  });
});

afterAll(async () => {
  if (userIds.length) {
    await db.delete(destinations).where(inArray(destinations.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await pool.end();
});
