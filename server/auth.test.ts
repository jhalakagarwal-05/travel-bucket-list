import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { app } from "./app.js";
import { db, pool } from "./db.js";
import { users } from "../shared/schema.js";

const testEmails = new Set<string>();

function testEmail() {
  const email = `auth-test-${randomUUID()}@example.com`;
  testEmails.add(email);
  return email;
}

describe("email and password authentication", () => {
  it("returns a friendly error for blank fields and keeps the list protected", async () => {
    const blankSignup = await request(app).post("/api/auth/signup").send({
      email: " ",
      password: " ",
    });
    expect(blankSignup.status).toBe(400);
    expect(blankSignup.body.error).toMatch(/enter both/i);

    const loggedOut = await request(app).get("/api/auth/me");
    expect(loggedOut.status).toBe(401);
  });

  it("creates a bcrypt password hash, signs the user in, and logs them out", async () => {
    const email = testEmail();
    const agent = request.agent(app);

    const signup = await agent.post("/api/auth/signup").send({
      email,
      password: "correct horse battery",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user).toEqual({
      id: expect.any(Number),
      email,
    });
    expect(signup.body.user.passwordHash).toBeUndefined();

    const [storedUser] = await db.select().from(users).where(inArray(users.email, [email]));
    expect(storedUser.passwordHash).not.toBe("correct horse battery");
    expect(await bcrypt.compare("correct horse battery", storedUser.passwordHash)).toBe(true);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);

    const afterLogout = await agent.get("/api/auth/me");
    expect(afterLogout.status).toBe(401);
  });

  it("shows a friendly duplicate-email and incorrect-password error", async () => {
    const email = testEmail();
    const agent = request.agent(app);
    const signup = await agent.post("/api/auth/signup").send({
      email,
      password: "correct horse battery",
    });
    expect(signup.status).toBe(201);
    await agent.post("/api/auth/logout");

    const duplicate = await agent.post("/api/auth/signup").send({
      email: email.toUpperCase(),
      password: "another safe password",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatch(/already exists/i);

    const wrongPassword = await agent.post("/api/auth/login").send({
      email,
      password: "wrong password",
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error).toMatch(/don't match/i);

    const login = await agent.post("/api/auth/login").send({
      email,
      password: "correct horse battery",
    });
    expect(login.status).toBe(200);
    const restoredSession = await agent.get("/api/auth/me");
    expect(restoredSession.status).toBe(200);
    expect(restoredSession.body.user.email).toBe(email);
    await agent.post("/api/auth/logout");
  });
});

afterAll(async () => {
  if (testEmails.size > 0) {
    await db.delete(users).where(inArray(users.email, [...testEmails]));
  }
  await pool.end();
});
