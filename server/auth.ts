import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router, type NextFunction, type Request, type Response } from "express";
import { users } from "../shared/schema.js";
import { db } from "./db.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bcryptMaxBytes = 72;

type PublicUser = Pick<typeof users.$inferSelect, "id" | "email">;

function publicUser(user: PublicUser) {
  return { id: user.id, email: user.email };
}

function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function requireCredentials(
  request: Request,
  response: Response,
): { email: string; password: string } | undefined {
  const email =
    typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password =
    typeof request.body?.password === "string" ? request.body.password : "";

  if (!email || !password.trim()) {
    response.status(400).json({ error: "Please enter both your email address and password." });
    return;
  }

  if (email.length > 320 || !emailPattern.test(email)) {
    response.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  return { email, password };
}

async function loadSessionUser(request: Request): Promise<PublicUser | undefined> {
  if (!request.session.userId) return undefined;

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, request.session.userId))
    .limit(1);

  return user;
}

export const authRouter = Router();

authRouter.get("/me", async (request, response, next) => {
  try {
    const user = await loadSessionUser(request);
    if (!user) {
      response.status(401).json({ error: "Please log in to continue." });
      return;
    }
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signup", async (request, response, next) => {
  const credentials = requireCredentials(request, response);
  if (!credentials) return;

  if (Buffer.byteLength(credentials.password, "utf8") > bcryptMaxBytes) {
    response.status(400).json({ error: "Please use a password of 72 bytes or fewer." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(credentials.password, 12);
    const [user] = await db
      .insert(users)
      .values({
        email: credentials.email,
        passwordHash,
      })
      .returning({ id: users.id, email: users.email });

    await regenerateSession(request);
    request.session.userId = user.id;
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (isUniqueViolation(error)) {
      response.status(409).json({
        error: "An account with that email already exists. Please log in instead.",
      });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  const credentials = requireCredentials(request, response);
  if (!credentials) return;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, credentials.email))
      .limit(1);

    if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
      response.status(401).json({
        error: "That email and password don't match. Please try again.",
      });
      return;
    }

    await regenerateSession(request);
    request.session.userId = user.id;
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    if (request.session) await destroySession(request);
    response.clearCookie("wanderlist.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export async function requireUser(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await loadSessionUser(request);
    if (!user) {
      response.status(401).json({ error: "Please log in to continue." });
      return;
    }
    response.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
