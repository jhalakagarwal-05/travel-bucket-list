import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "../server/app.js";
import { db, pool } from "../server/db.js";
import { destinations, users } from "../shared/schema.js";

type Agent = ReturnType<typeof request.agent>;
type TestAccount = { agent: Agent; email: string };

const testPassword = "travel-test-password";
const userIds: number[] = [];

async function createAccount(): Promise<TestAccount> {
  const agent = request.agent(app);
  const email = `required-${randomUUID()}@example.com`;
  const response = await agent.post("/api/auth/signup").send({ email, password: testPassword });
  expect(response.status).toBe(201);
  userIds.push(response.body.user.id as number);
  return { agent, email };
}

async function addDestination(agent: Agent, name: string, priority: number) {
  const response = await agent.post("/api/destinations").send({
    name,
    country: "Japan",
    status: "dream",
    priority,
  });
  expect(response.status).toBe(201);
  return response.body.destination as { id: number };
}

it("data isolation: User B cannot see User A's destinations", async () => {
  const userA = await createAccount();
  const userB = await createAccount();

  try {
    const kyoto = await addDestination(userA.agent, "Kyoto", 5);
    expect((await userA.agent.get("/api/destinations")).body.destinations).toHaveLength(1);

    await userB.agent.post("/api/auth/logout");
    const login = await userB.agent.post("/api/auth/login").send({
      email: userB.email,
      password: testPassword,
    });
    expect(login.status).toBe(200);

    const userBList = await userB.agent.get("/api/destinations");
    expect(userBList.status).toBe(200);
    expect(userBList.body.destinations).toEqual([]);

    const userADestination = await userB.agent.get(`/api/destinations/${kyoto.id}`);
    expect(userADestination.status).toBe(404);
  } finally {
    await Promise.all([
      userA.agent.post("/api/auth/logout"),
      userB.agent.post("/api/auth/logout"),
    ]);
  }
});

it("dashboard: average priority of 2, 4, 5 is 3.7", async () => {
  const user = await createAccount();

  try {
    for (const [index, priority] of [2, 4, 5].entries()) {
      await addDestination(user.agent, `Destination ${index + 1}`, priority);
    }

    const dashboard = await user.agent.get("/api/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totalDestinations).toBe(3);
    expect(dashboard.body.averagePriority.toFixed(1)).toBe("3.7");
  } finally {
    await user.agent.post("/api/auth/logout");
  }
});

afterAll(async () => {
  if (userIds.length) {
    await db.delete(destinations).where(inArray(destinations.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await pool.end();
});
