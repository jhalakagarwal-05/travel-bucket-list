import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("travel data model", () => {
  it("has exactly the destination columns specified in the plan", async () => {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'destinations' ORDER BY ordinal_position",
    );
    expect(result.rows.map((row) => row.column_name)).toEqual([
      "id", "user_id", "category_id", "name", "country", "status", "priority",
      "estimated_cost", "visited_date", "latitude", "longitude", "notes", "created_at",
    ]);
  });

  it("includes exactly the six requested travel categories", async () => {
    const names = ["Beach", "City", "Mountains", "Food", "Culture", "Vibes"].sort();
    const result = await pool.query(
      "SELECT name, count(*)::integer AS count FROM categories GROUP BY name ORDER BY name",
    );
    expect(result.rows).toEqual(names.map((name) => ({ name, count: 1 })));
  });

  it("links destinations to users and categories and enforces model constraints", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [`model-test-${randomUUID()}@example.com`, "test-only-not-a-login"],
      );
      const category = await client.query("SELECT id FROM categories WHERE name = $1", ["City"]);
      const destination = await client.query(
        "INSERT INTO destinations (user_id, category_id, name, country, status, priority, estimated_cost, visited_date, latitude, longitude, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
        [user.rows[0].id, category.rows[0].id, "Kyoto", "Japan", "dream", 5, "1250.50", null, 35.0116, 135.7681, "Test notes", "2026-11-04"],
      );
      const linked = await client.query(
        "SELECT u.id AS user_id, c.name AS category FROM destinations d JOIN users u ON d.user_id = u.id JOIN categories c ON d.category_id = c.id WHERE d.id = $1",
        [destination.rows[0].id],
      );
      expect(linked.rows[0]).toEqual({ user_id: user.rows[0].id, category: "City" });

      const invalidRows = [
        { sql: "INSERT INTO destinations (name, country, status) VALUES ('Test', 'Japan', 'invalid')", code: "23514" },
        { sql: "INSERT INTO destinations (name, country, priority) VALUES ('Test', 'Japan', 0)", code: "23514" },
        { sql: "INSERT INTO destinations (name, country, priority) VALUES ('Test', 'Japan', 6)", code: "23514" },
        { sql: "INSERT INTO destinations (country) VALUES ('Japan')", code: "23502" },
        { sql: "INSERT INTO destinations (name) VALUES ('Test')", code: "23502" },
        { sql: "INSERT INTO destinations (name, country, user_id) VALUES ('Test', 'Japan', -1)", code: "23503" },
        { sql: "INSERT INTO destinations (name, country, category_id) VALUES ('Test', 'Japan', -1)", code: "23503" },
      ];
      for (const invalid of invalidRows) {
        await client.query("SAVEPOINT invalid_row");
        await expect(client.query(invalid.sql)).rejects.toMatchObject({ code: invalid.code });
        await client.query("ROLLBACK TO SAVEPOINT invalid_row");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

afterAll(async () => {
  await pool.end();
});
