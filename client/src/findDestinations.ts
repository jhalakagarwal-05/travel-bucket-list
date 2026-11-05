export type FindOptions = {
  search: string;
  status: string;
  categoryId: string;
  sort: "newest" | "priority";
};

export const initialFindOptions: FindOptions = {
  search: "",
  status: "",
  categoryId: "",
  sort: "newest",
};

type FindableDestination = {
  id: number;
  name: string;
  country: string;
  status: string | null;
  categoryId: number | null;
  priority: number | null;
  createdAt: string | null;
};

function newestFirst(a: FindableDestination, b: FindableDestination) {
  // createdAt is an ISO date. IDs preserve insertion order for same-day entries.
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id - a.id;
}

export function findDestinations<T extends FindableDestination>(
  items: readonly T[],
  options: FindOptions,
): T[] {
  const search = options.search.trim().toLocaleLowerCase();
  return items.filter((item) => (
    (!search || item.name.toLocaleLowerCase().includes(search) || item.country.toLocaleLowerCase().includes(search)) &&
    (!options.status || item.status === options.status) &&
    (!options.categoryId || String(item.categoryId) === options.categoryId)
  )).sort((a, b) => (
    (options.sort === "priority" ? (b.priority ?? 0) - (a.priority ?? 0) : 0) || newestFirst(a, b)
  ));
}
