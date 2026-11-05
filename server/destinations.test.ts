import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { destinations, users } from "../shared/schema.js";

const emails: string[] = [];
const userIds: number[] = [];
async function account() {
  const agent = request.agent(app);
  const email = `crud-${randomUUID()}@example.com`;
  emails.push(email);
  const response = await agent.post("/api/auth/signup").send({ email, password: "travel-test-password" });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id);
  return agent;
}
const fields = {
  name: "Kyoto", country: "Japan", status: "dream", priority: 5,
  estimatedCost: "1500.50", visitedDate: "2026-10-10", notes: "Visit the temples.",
};

describe("private destination CRUD", () => {
  it("requires login for categories, list, detail, creation, editing, and deletion", async () => {
    expect((await request(app).get("/api/categories")).status).toBe(401);
    expect((await request(app).get("/api/destinations")).status).toBe(401);
    expect((await request(app).get("/api/destinations/1")).status).toBe(401);
    expect((await request(app).post("/api/destinations").send(fields)).status).toBe(401);
    expect((await request(app).put("/api/destinations/1").send(fields)).status).toBe(401);
    expect((await request(app).delete("/api/destinations/1")).status).toBe(401);
  });

  it("creates, lists, reads, edits, and deletes all requested fields", async () => {
    const owner = await account();
    const categoryResponse = await owner.get("/api/categories");
    const categoryId = categoryResponse.body.categories[0].id;
    const created = await owner.post("/api/destinations").send({ ...fields, categoryId });
    expect(created.status).toBe(201);
    const id = created.body.destination.id;
    expect(created.body.destination).toMatchObject({ ...fields, categoryId });
    const list = await owner.get("/api/destinations");
    expect(list.body.destinations).toHaveLength(1);
    expect(list.body.destinations[0].id).toBe(id);
    expect((await owner.get(`/api/destinations/${id}`)).body.destination).toMatchObject(fields);

    const changed = { ...fields, name: "Kyoto trip", country: "Japan", status: "visited",
      priority: 2, estimatedCost: "1750", visitedDate: null, notes: "Updated notes", categoryId: null };
    expect((await owner.put(`/api/destinations/${id}`).send(changed)).body.destination).toMatchObject(changed);
    expect((await owner.get(`/api/destinations/${id}`)).body.destination).toMatchObject(changed);
    expect((await owner.delete(`/api/destinations/${id}`)).status).toBe(204);
    expect((await owner.get(`/api/destinations/${id}`)).status).toBe(404);
    expect((await owner.get("/api/destinations")).body.destinations).toEqual([]);
    await owner.post("/api/auth/logout");
  });

  it("rejects blank names and countries on create and edit without losing saved data", async () => {
    const owner = await account();
    const blank = await owner.post("/api/destinations").send({ ...fields, name: " ", country: "" });
    expect(blank.status).toBe(400);
    expect(blank.body.fieldErrors).toEqual({
      name: "Please enter a destination name.", country: "Please enter a country.",
    });
    const created = await owner.post("/api/destinations").send(fields);
    const id = created.body.destination.id;
    const invalidEdit = await owner.put(`/api/destinations/${id}`).send({ ...fields, name: "", country: " " });
    expect(invalidEdit.status).toBe(400);
    expect(invalidEdit.body.fieldErrors.name).toBeTruthy();
    expect(invalidEdit.body.fieldErrors.country).toBeTruthy();
    expect((await owner.get(`/api/destinations/${id}`)).body.destination.name).toBe("Kyoto");
    for (const invalid of [{status:"unknown"}, {priority:6}, {categoryId:-1}, {estimatedCost:"abc"}, {visitedDate:"2026-02-30"}]) {
      expect((await owner.post("/api/destinations").send({ ...fields, ...invalid })).status).toBe(400);
    }
    await owner.post("/api/auth/logout");
  });

  it("does not reveal or allow changes to another user's destination, even with spoofed owner fields", async () => {
    const owner = await account();
    const other = await account();
    const created = await owner.post("/api/destinations").send({ ...fields, userId: userIds.at(-1) });
    expect(created.status).toBe(201);
    const id = created.body.destination.id;
    expect((await other.get("/api/destinations")).body.destinations).toEqual([]);
    expect((await other.get(`/api/destinations/${id}`)).status).toBe(404);
    expect((await other.put(`/api/destinations/${id}`).send({ ...fields, name: "Hacked" })).status).toBe(404);
    expect((await other.delete(`/api/destinations/${id}`)).status).toBe(404);
    expect((await owner.get(`/api/destinations/${id}`)).body.destination.name).toBe("Kyoto");
    await owner.post("/api/auth/logout");
    await other.post("/api/auth/logout");
  });
});

afterAll(async () => {
  if (userIds.length) await db.delete(destinations).where(inArray(destinations.userId, userIds));
  if (emails.length) await db.delete(users).where(inArray(users.email, emails));
  await pool.end();
});
