# Wanderlist database schema

The application tables are defined with Drizzle in `shared/schema.ts`. PostgreSQL types below are shown as stored in the database. Unless noted otherwise, columns without `NOT NULL` are nullable.

## Tables

### `users`

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `id` | `serial` | Primary key |
| `email` | `varchar(320)` | Not null, unique |
| `password_hash` | `text` | Not null |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |

### `categories`

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `id` | `serial` | Primary key |
| `name` | `text` | Nullable |

The seed script ensures Beach, City, Mountains, Food, Culture, and Vibes are present. It merges existing Hiking and Family destinations into Mountains.

### `destinations`

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `id` | `serial` | Primary key |
| `user_id` | `integer` | Nullable; references `users.id` |
| `category_id` | `integer` | Nullable; references `categories.id` |
| `name` | `text` | Not null |
| `country` | `text` | Not null |
| `status` | `text` | Nullable; check constraint permits `dream`, `planned`, or `visited` |
| `priority` | `integer` | Nullable; check constraint permits values from 1 through 5 |
| `estimated_cost` | `numeric` | Nullable |
| `visited_date` | `date` | Nullable |
| `latitude` | `double precision` | Nullable |
| `longitude` | `double precision` | Nullable |
| `notes` | `text` | Nullable |
| `created_at` | `date` | Nullable |

### `stars`

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `id` | `serial` | Primary key |
| `user_id` | `integer` | Not null; references `users.id`, cascade on delete |
| `destination_id` | `integer` | Not null; references `destinations.id`, cascade on delete |

There is a unique constraint on (`user_id`, `destination_id`), so a user can star a destination only once.

### `share_links`

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `id` | `serial` | Primary key |
| `user_id` | `integer` | Not null, unique; references `users.id`, cascade on delete |
| `token` | `varchar(64)` | Not null, unique; stores a SHA-256 hex digest |
| `created_at` | `timestamp with time zone` | Not null, defaults to `now()` |

The original random token is returned in the share URL; only its digest is stored in this table.

### `user_sessions`

This table is managed by `connect-pg-simple`, not declared in the Drizzle schema. The session store creates it automatically when needed.

| Column | PostgreSQL type | Constraints |
|---|---|---|
| `sid` | `varchar` | Not null, primary key |
| `sess` | `json` | Not null |
| `expire` | `timestamp(6) without time zone` | Not null; indexed |

## Relationships

```text
users 1 ── 0..* destinations 0..1 ── 1 categories
users 1 ── 0..* stars ── 1 destinations
users 1 ── 0..1 share_links
user_sessions: standalone session records, keyed by sid
```

- A destination can have no user or category because both foreign-key columns are nullable in the current schema.
- A star belongs to exactly one user and one destination; the pair is unique.
- A user can have at most one share-link row at a time because `share_links.user_id` is unique. Creating a replacement link deletes the existing row first.
- Session records are stored separately by `connect-pg-simple`; they do not have a relational foreign key to `users`.

## Differences from PLAN.md section 3

- Login sessions use an additional `user_sessions` table, created by `connect-pg-simple`; this table was not in the plan.
- `share_links` stores a SHA-256 hex digest of the random URL token rather than the raw token. The column is `varchar(64)`, and `user_id` is unique, so the schema allows one link per user rather than many.
- `users.email` is `varchar(320)` rather than the planned `text`, and `users.created_at` is `timestamp with time zone` rather than `date`.
- `destinations.estimated_cost` is PostgreSQL `numeric`; latitude and longitude are `double precision`.
- `destinations.created_at` is a nullable `date` with no database default.
- The database enforces the allowed destination statuses and the 1–5 priority range with check constraints.
