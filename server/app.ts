import connectPgSimple from "connect-pg-simple";
import express from "express";
import session from "express-session";
import { authRouter } from "./auth.js";
import { pool } from "./db.js";
import { travelRouter } from "./destinations.js";
import { dashboardRouter } from "./dashboard.js";
import { mapRouter } from "./map.js";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required to start Wanderlist.");
}

const PgSessionStore = connectPgSimple(session);
const sessionStore = new PgSessionStore({
  pool,
  tableName: "user_sessions",
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60,
  pruneSessionInterval: 60 * 60,
});

export const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(
  session({
    name: "wanderlist.sid",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  }),
);

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/map", mapRouter);
app.use("/api", travelRouter);
app.use("/api", (_request, response) => {
  response.status(404).json({ error: "That endpoint does not exist." });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Request failed:", error);
    response.status(500).json({ error: "Something went wrong. Please try again." });
  },
);
