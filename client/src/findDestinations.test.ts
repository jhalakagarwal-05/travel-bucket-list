import { describe, expect, it } from "vitest";
import { findDestinations, initialFindOptions, type FindOptions } from "./findDestinations";

const places = [
  { id: 1, name: "Kyoto", country: "Japan", status: "dream", categoryId: 2, priority: 5, createdAt: "2026-10-01" },
  { id: 2, name: "Tokyo", country: "Japan", status: "planned", categoryId: 2, priority: 3, createdAt: "2026-11-01" },
  { id: 3, name: "Alps hike", country: "Switzerland", status: "dream", categoryId: 3, priority: 5, createdAt: "2026-10-20" },
  { id: 4, name: "Lisbon", country: "Portugal", status: "visited", categoryId: null, priority: 1, createdAt: "2026-11-01" },
];

const find = (options: Partial<FindOptions> = {}) =>
  findDestinations(places, { ...initialFindOptions, ...options }).map((item) => item.id);

describe("My List search, filters, and sorting", () => {
  it("matches names without case sensitivity and trims surrounding whitespace", () => {
    expect(find({ search: "  KYOTO " })).toEqual([1]);
    expect(find({ search: "kYo" })).toEqual([2, 1]);
  });

  it("matches countries as well as names, using literal substrings", () => {
    expect(find({ search: "jApAn" })).toEqual([2, 1]);
    expect(find({ search: "switz" })).toEqual([3]);
    expect(find({ search: ".*" })).toEqual([]);
  });

  it("filters each status independently", () => {
    expect(find({ status: "dream" })).toEqual([3, 1]);
    expect(find({ status: "planned" })).toEqual([2]);
    expect(find({ status: "visited" })).toEqual([4]);
  });

  it("filters by category id and leaves uncategorized entries visible with no category filter", () => {
    expect(find({ categoryId: "2" })).toEqual([2, 1]);
    expect(find({ categoryId: "3" })).toEqual([3]);
    expect(find()).toContain(4);
  });

  it("combines search, status, and category with AND and returns no matches when incompatible", () => {
    expect(find({ search: "Japan", status: "dream", categoryId: "2" })).toEqual([1]);
    expect(find({ search: "Japan", status: "dream", categoryId: "3" })).toEqual([]);
  });

  it("defaults to newest date first with newest id first for entries on the same day", () => {
    expect(find()).toEqual([4, 2, 3, 1]);
  });

  it("sorts highest priority first and uses newest first to break priority ties", () => {
    expect(find({ sort: "priority" })).toEqual([3, 1, 2, 4]);
    expect(find({ status: "dream", sort: "priority" })).toEqual([3, 1]);
  });

  it("handles empty lists, whitespace queries, and clearing all controls", () => {
    expect(findDestinations([], initialFindOptions)).toEqual([]);
    expect(find({ search: "  " })).toEqual(find());
    expect(find({ search: "nothing matches" })).toEqual([]);
    expect(find(initialFindOptions)).toEqual([4, 2, 3, 1]);
  });

  it("does not mutate the source list or destination objects", () => {
    const original = structuredClone(places);
    const result = findDestinations(places, { ...initialFindOptions, sort: "priority" });
    expect(places).toEqual(original);
    expect(result).not.toBe(places);
    expect(result[0]).toBe(places[2]);
  });

  it("places missing dates and priorities after known values", () => {
    const missing = { ...places[0], id: 5, createdAt: null, priority: null };
    expect(findDestinations([...places, missing], initialFindOptions).at(-1)?.id).toBe(5);
    expect(findDestinations([...places, missing], { ...initialFindOptions, sort: "priority" }).at(-1)?.id).toBe(5);
  });
});
