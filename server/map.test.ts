import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { destinations, users } from "../shared/schema.js";

const userIds: number[] = [];

async function account() {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({
    email: `map-${randomUUID()}@example.com`,
    password: "travel-test-password",
  });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id);
  return { agent, userId: response.body.user.id as number };
}

describe("private map and user-triggered location lookup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires login for both map settings and geocoding", async () => {
    expect((await request(app).get("/api/map/config")).status).toBe(401);
    expect((await request(app).get("/api/map/geocode?name=Kyoto&country=Japan")).status).toBe(401);
  });

  it("accepts a bounded destination name and an optional bounded country", async () => {
    const { agent } = await account();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const query of ["", "?country=Japan", `?name=${"x".repeat(151)}&country=Japan`, `?name=Kyoto&country=${"x".repeat(101)}`]) {
      expect((await agent.get(`/api/map/geocode${query}`)).status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    await agent.post("/api/auth/logout");
  });

  it("looks up a destination on demand, sends an identifying user agent, and caches repeat searches", async () => {
    const { agent } = await account();
    const name = `Wanderlist ${randomUUID()}`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify([
        { lat: "35.0116", lon: "135.7681", display_name: "Kyoto, Japan", address: { country: "Japan" } },
        { lat: "91", lon: "0", display_name: "Invalid latitude" },
        { lat: "0", lon: "-181", display_name: "Invalid longitude" },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    const first = await agent.get(`/api/map/geocode?name=${encodeURIComponent(name)}&country=Japan`);
    expect(first.status).toBe(200);
    expect(first.body.locations).toEqual([
      { latitude: 35.0116, longitude: 135.7681, label: "Kyoto, Japan", country: "Japan" },
    ]);

    const repeated = await agent.get(`/api/map/geocode?name=${encodeURIComponent(`  ${name.toLocaleLowerCase()}  `)}&country=japan`);
    expect(repeated.status).toBe(200);
    expect(repeated.body.locations).toEqual(first.body.locations);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0];
    const requestedUrl = new URL(String(url));
    expect(requestedUrl.searchParams.get("format")).toBe("jsonv2");
    expect(requestedUrl.searchParams.get("q")).toBe(`${name}, Japan`);
    expect(requestedUrl.searchParams.get("addressdetails")).toBe("1");
    expect((options?.headers as Record<string, string>)["User-Agent"]).toMatch(/^Wanderlist\/1\.0/);
    await agent.post("/api/auth/logout");
  });

  it("finds by name alone and returns the matched country", async () => {
    const { agent } = await account();
    const name = `Country lookup ${randomUUID()}`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify([{
        lat: "35.0116",
        lon: "135.7681",
        display_name: "Kyoto, Japan",
        address: { country: "Japan" },
      }]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));

    const result = await agent.get(`/api/map/geocode?name=${encodeURIComponent(name)}`);
    expect(result.status).toBe(200);
    expect(result.body.locations).toEqual([{
      latitude: 35.0116,
      longitude: 135.7681,
      label: "Kyoto, Japan",
      country: "Japan",
    }]);
    const requestedUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("q")).toBe(name);
    await agent.post("/api/auth/logout");
  });

  it("returns a friendly no-match response and hides Nominatim failures", async () => {
    const { agent } = await account();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    const name = `No match ${randomUUID()}`;
    expect((await agent.get(`/api/map/geocode?name=${encodeURIComponent(name)}&country=Japan`)).body)
      .toEqual({ locations: [] });
    const second = await agent.get(`/api/map/geocode?name=${encodeURIComponent(`Service failure ${randomUUID()}`)}&country=Japan`);
    expect(second.status).toBe(502);
    expect(second.body.error).toContain("manually");
    await agent.post("/api/auth/logout");
  });

  it("returns only the signed-in user's coordinate-bearing destinations and a switchable tile URL", async () => {
    const owner = await account();
    const other = await account();
    await owner.agent.post("/api/destinations").send({
      name: "Kyoto", country: "Japan", latitude: 35.0116, longitude: 135.7681,
    });
    await other.agent.post("/api/destinations").send({
      name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522,
    });
    await other.agent.post("/api/destinations").send({ name: "No coordinates", country: "France" });
    expect((await owner.agent.get("/api/destinations")).body.destinations).toMatchObject([
      { name: "Kyoto", latitude: 35.0116, longitude: 135.7681 },
    ]);
    expect((await other.agent.get("/api/destinations")).body.destinations).toHaveLength(2);

    const previousTileUrl = process.env.OSM_TILE_URL;
    process.env.OSM_TILE_URL = "https://tiles.example.org/{z}/{x}/{y}.png";
    try {
      expect((await owner.agent.get("/api/map/config")).body).toEqual({
        tileUrl: "https://tiles.example.org/{z}/{x}/{y}.png",
      });
    } finally {
      if (previousTileUrl === undefined) delete process.env.OSM_TILE_URL;
      else process.env.OSM_TILE_URL = previousTileUrl;
    }
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
