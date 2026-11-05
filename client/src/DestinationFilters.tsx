import type { FindOptions } from "./findDestinations";

type Category = { id: number; name: string };

type Props = {
  options: FindOptions;
  onChange: (next: FindOptions) => void;
  categories: Category[];
  matchCount: number;
  totalCount: number;
};

export default function DestinationFilters({ options, onChange, categories, matchCount, totalCount }: Props) {
  const hasFilters = Boolean(options.search || options.status || options.categoryId || options.sort !== "newest");
  const update = (changes: Partial<FindOptions>) => onChange({ ...options, ...changes });

  return (
    <section className="destination-filters" aria-label="Search and filter My List">
      <div className="filter-controls">
        <div className="filter-search">
          <label htmlFor="destination-search">Search places</label>
          <div className="filter-search-input">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
            <input
              id="destination-search"
              type="search"
              value={options.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder="Name or country"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="filter-select">
          <label htmlFor="destination-status-filter">Status</label>
          <select id="destination-status-filter" value={options.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">All statuses</option>
            <option value="dream">Dream</option>
            <option value="planned">Planned</option>
            <option value="visited">Visited</option>
          </select>
        </div>
        <div className="filter-select">
          <label htmlFor="destination-category-filter">Category</label>
          <select id="destination-category-filter" value={options.categoryId} onChange={(event) => update({ categoryId: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="filter-select filter-sort">
          <label htmlFor="destination-sort">Sort by</label>
          <select id="destination-sort" value={options.sort} onChange={(event) => update({ sort: event.target.value as FindOptions["sort"] })}>
            <option value="newest">Newest first</option>
            <option value="priority">Highest priority</option>
          </select>
        </div>
        <button type="button" className="filter-clear" onClick={() => onChange({ search: "", status: "", categoryId: "", sort: "newest" })} disabled={!hasFilters}>
          Clear filters
        </button>
      </div>
      <p className="filter-result-count" aria-live="polite">
        Showing <strong>{matchCount}</strong> of <strong>{totalCount}</strong> {totalCount === 1 ? "place" : "places"}
      </p>
    </section>
  );
}
