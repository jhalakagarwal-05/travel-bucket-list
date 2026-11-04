import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const destinations = pgTable(
  "destinations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    categoryId: integer("category_id").references(() => categories.id),
    name: text("name").notNull(),
    country: text("country").notNull(),
    status: text("status", { enum: ["dream", "planned", "visited"] }),
    priority: integer("priority"),
    estimatedCost: numeric("estimated_cost"),
    visitedDate: date("visited_date"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    notes: text("notes"),
    createdAt: date("created_at"),
  },
  (table) => [
    check("destinations_status_check", sql`${table.status} IN ('dream', 'planned', 'visited')`),
    check("destinations_priority_check", sql`${table.priority} BETWEEN 1 AND 5`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  destinations: many(destinations),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  destinations: many(destinations),
}));

export const destinationsRelations = relations(destinations, ({ one }) => ({
  user: one(users, { fields: [destinations.userId], references: [users.id] }),
  category: one(categories, { fields: [destinations.categoryId], references: [categories.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
