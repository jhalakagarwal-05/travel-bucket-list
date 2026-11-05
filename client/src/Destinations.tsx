import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import DestinationFilters from "./DestinationFilters";
import "./destinations.css";
import { findDestinations, initialFindOptions, type FindOptions } from "./findDestinations";
import { pickDreamDestination } from "./surprise";
import SharePanel from "./SharePanel";

type DestinationStatus = "dream" | "planned" | "visited";

type Destination = {
  id: number;
  name: string;
  country: string;
  categoryId: number | null;
  categoryName: string | null;
  status: DestinationStatus;
  priority: number;
  estimatedCost: string | null;
  visitedDate: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  starred: boolean;
};

type Category = { id: number; name: string };
type Props = {
  path: string;
  navigate: (path: string) => void;
  onUnauthorized: () => void;
};
type FormValues = {
  name: string;
  country: string;
  categoryId: string;
  status: DestinationStatus;
  priority: string;
  estimatedCost: string;
  visitedDate: string;
  notes: string;
  latitude: string;
  longitude: string;
};
type ApiError = Error & { status?: number; fieldErrors?: Record<string, string> };
type GeocodeResult = { latitude: number; longitude: number; label: string; country: string };

const initialForm: FormValues = {
  name: "",
  country: "",
  categoryId: "",
  status: "dream",
  priority: "3",
  estimatedCost: "",
  visitedDate: "",
  notes: "",
  latitude: "",
  longitude: "",
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    let body: { error?: string; fieldErrors?: Record<string, string> } = {};
    try {
      body = await response.json();
    } catch {
      // The API may return an empty response for an error.
    }
    const error = new Error(body.error || `Something went wrong (${response.status}).`) as ApiError;
    error.status = response.status;
    error.fieldErrors = body.fieldErrors;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function Icon({ name, size = 20 }: { name: "pin" | "arrow" | "plus" | "back" | "edit" | "trash" | "globe" | "calendar" | "tag" | "spark" | "star"; size?: number }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<typeof name, ReactNode> = {
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    edit: <><path d="m15 5 4 4" /><path d="m4 20 4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z" /><path d="m13.8 6.8 3.4 3.4" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    tag: <><path d="M20 13 13 20 4 11V4h7l9 9Z" /><circle cx="8" cy="8" r="1" /></>,
    spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    star: <path d="m12 3 2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 17.05l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z" />,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function StatusPill({ status }: { status: DestinationStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`destination-status status-${status}`}><span className="status-dot" />{label}</span>;
}

function LoadingState() {
  return (
    <main className="destination-page destination-skeleton" aria-label="Loading destinations">
      <div className="destination-skeleton-head">
        <span className="ds-line ds-eyebrow" />
        <span className="ds-line ds-title" />
        <span className="ds-line ds-copy" />
      </div>
      <div className="destination-skeleton-grid">
        {[0, 1, 2].map((item) => <div className="ds-card" key={item}><span /><span /><span /></div>)}
      </div>
    </main>
  );
}

function LoadFailure({ message, retry, back }: { message: string; retry: () => void; back?: () => void }) {
  return (
    <main className="destination-page">
      <section className="destination-error" role="alert">
        <div className="error-mark">!</div>
        <p className="destination-kicker">A small detour</p>
        <h1>We couldn't load this page.</h1>
        <p>{message}</p>
        <div className="destination-error-actions">
          <button type="button" className="destination-button primary" onClick={retry}>Try again</button>
          {back && <button type="button" className="destination-button quiet" onClick={back}>Back to My List</button>}
        </div>
      </section>
    </main>
  );
}

function EmptyList({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="destination-empty">
      <div className="empty-orbit"><Icon name="pin" size={33} /></div>
      <span className="destination-kicker">Your journal starts here</span>
      <h2>Every good trip begins somewhere.</h2>
      <p>Add the places you’ve been meaning to see—or the ones you still talk about.</p>
      <button type="button" className="destination-button primary" onClick={onAdd}>Add your first place <Icon name="arrow" size={17} /></button>
    </section>
  );
}

function StarredEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className="destination-empty starred-empty">
      <div className="empty-orbit"><Icon name="star" size={31} /></div>
      <span className="destination-kicker">Your shortlist, at a glance</span>
      <h2>No starred places yet.</h2>
      <p>When a place feels like a must, add a star and it will be waiting here.</p>
      <button type="button" className="destination-button primary" onClick={onBrowse}>Browse My List <Icon name="arrow" size={17} /></button>
    </section>
  );
}

export default function DestinationWorkspace({ path, navigate, onUnauthorized }: Props) {
  const route = useMemo(() => {
    const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";
    if (cleanPath === "/my-list") return { type: "list" as const, id: null };
    if (cleanPath === "/starred") return { type: "starred" as const, id: null };
    if (cleanPath === "/destinations/new") return { type: "new" as const, id: null };
    const match = cleanPath.match(/^\/destinations\/([^/]+)(\/edit)?$/);
    if (match) return { type: match[2] ? "edit" as const : "detail" as const, id: match[1] };
    return { type: "list" as const, id: null };
  }, [path]);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [findOptions, setFindOptions] = useState<FindOptions>(initialFindOptions);
  const [surpriseMessage, setSurpriseMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [findingLocation, setFindingLocation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [matchedPlace, setMatchedPlace] = useState<GeocodeResult | null>(null);
  const [starError, setStarError] = useState("");
  const [starPendingId, setStarPendingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormValues>(initialForm);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setLocationMessage("");
    setMatchedPlace(null);
    setStarError("");
    setSurpriseMessage("");
    setFormError("");
    setFieldErrors({});
    setDestination(null);

    const handleError = (error: unknown) => {
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        onUnauthorized();
        return;
      }
      if (active) setLoadError(apiError.message || "Please try again in a moment.");
    };

    if (route.type === "list") {
      Promise.all([
        request<{ destinations: Destination[] }>("/api/destinations"),
        request<{ categories: Category[] }>("/api/categories"),
      ])
        .then(([destinationResult, categoryResult]) => {
          if (!active) return;
          setDestinations(destinationResult.destinations);
          setCategories(categoryResult.categories);
        })
        .catch(handleError)
        .finally(() => { if (active) setLoading(false); });
    } else if (route.type === "starred") {
      request<{ destinations: Destination[] }>("/api/starred")
        .then((result) => { if (active) setDestinations(result.destinations); })
        .catch(handleError)
        .finally(() => { if (active) setLoading(false); });
    } else if (route.type === "new" || route.type === "edit") {
      const categoryPromise = request<{ categories: Category[] }>("/api/categories");
      const destinationPromise = route.type === "edit" && route.id
        ? request<{ destination: Destination }>(`/api/destinations/${encodeURIComponent(route.id)}`)
        : Promise.resolve(null);
      Promise.all([categoryPromise, destinationPromise])
        .then(([categoryResult, detailResult]) => {
          if (!active) return;
          setCategories(categoryResult.categories);
          if (detailResult) {
            const item = detailResult.destination;
            setDestination(item);
            setForm({
              name: item.name ?? "",
              country: item.country ?? "",
              categoryId: item.categoryId == null ? "" : String(item.categoryId),
              status: item.status ?? "dream",
              priority: String(item.priority ?? 3),
              estimatedCost: item.estimatedCost ?? "",
              visitedDate: item.visitedDate ?? "",
              notes: item.notes ?? "",
              latitude: item.latitude == null ? "" : String(item.latitude),
              longitude: item.longitude == null ? "" : String(item.longitude),
            });
          } else {
            setForm(initialForm);
          }
        })
        .catch(handleError)
        .finally(() => { if (active) setLoading(false); });
    } else if (route.id) {
      request<{ destination: Destination }>(`/api/destinations/${encodeURIComponent(route.id)}`)
        .then((result) => { if (active) setDestination(result.destination); })
        .catch(handleError)
        .finally(() => { if (active) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [route.type, route.id, onUnauthorized, reloadToken]);

  const retryLoad = () => setReloadToken((value) => value + 1);
  const surpriseMe = () => {
    const destination = pickDreamDestination(destinations);
    if (!destination) {
      setSurpriseMessage("No dream destinations yet. Add a place and mark it as Dream to try again.");
      return;
    }
    setSurpriseMessage("");
    navigate(`/destinations/${destination.id}`);
  };
  const visibleDestinations = useMemo(
    () => route.type === "list" ? findDestinations(destinations, findOptions) : destinations,
    [route.type, destinations, findOptions],
  );

  const toggleStar = async (item: Destination) => {
    if (starPendingId !== null) return;
    setStarPendingId(item.id);
    setStarError("");
    try {
      const result = await request<{ starred: boolean }>(`/api/destinations/${encodeURIComponent(String(item.id))}/star`, {
        method: item.starred ? "DELETE" : "PUT",
      });
      setDestinations((current) => route.type === "starred" && !result.starred
        ? current.filter((entry) => entry.id !== item.id)
        : current.map((entry) => entry.id === item.id ? { ...entry, starred: result.starred } : entry));
      setDestination((current) => current?.id === item.id ? { ...current, starred: result.starred } : current);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) onUnauthorized();
      else setStarError(apiError.status === 404
        ? "This place is no longer available in your journal."
        : "We couldn't update this star just now. Please try again.");
    } finally {
      setStarPendingId(null);
    }
  };

  const updateField = (key: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
    if (key === "name" || key === "country") {
      setMatchedPlace(null);
      setLocationMessage("");
    }
  };

  const findLocation = async () => {
    setLocationMessage("");
    setMatchedPlace(null);
    if (!form.name.trim()) {
      setLocationMessage("Enter a destination name first.");
      return;
    }
    setFindingLocation(true);
    try {
      const params = new URLSearchParams({ name: form.name.trim() });
      if (form.country.trim()) params.set("country", form.country.trim());
      const result = await request<{ locations: GeocodeResult[] }>(`/api/map/geocode?${params.toString()}`);
      const location = result.locations[0];
      if (!location) {
        setLocationMessage("No matching place was found. Check the name or enter the country and coordinates manually.");
        return;
      }
      setForm((current) => ({
        ...current,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        country: location.country || current.country,
      }));
      setMatchedPlace(location);
      setLocationMessage("Check that this is the right place. You can edit any field before saving.");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) onUnauthorized();
      else setLocationMessage(apiError.message || "Location search failed. You can enter coordinates manually.");
    } finally {
      setFindingLocation(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    const localErrors: Record<string, string> = {};
    if (!form.name.trim()) localErrors.name = "Add a destination name to continue.";
    if (!form.country.trim()) localErrors.country = "Add a country to complete this entry.";
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      return;
    }
    const body = {
      name: form.name.trim(),
      country: form.country.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      status: form.status,
      priority: Number(form.priority),
      estimatedCost: form.estimatedCost.trim() || null,
      visitedDate: form.visitedDate || null,
      notes: form.notes.trim() || null,
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
    };
    setSaving(true);
    try {
      const url = route.type === "edit" && route.id
        ? `/api/destinations/${encodeURIComponent(route.id)}`
        : "/api/destinations";
      const result = await request<{ destination: Destination }>(url, {
        method: route.type === "edit" ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      navigate(`/destinations/${result.destination.id}`);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        onUnauthorized();
      } else {
        setFieldErrors(apiError.fieldErrors ?? {});
        setFormError(apiError.message || "Your changes couldn't be saved. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteDestination = async () => {
    if (!destination || !window.confirm("Are you sure? This destination will be permanently deleted.")) return;
    setDeleting(true);
    setLoadError("");
    try {
      await request<void>(`/api/destinations/${encodeURIComponent(String(destination.id))}`, { method: "DELETE" });
      navigate("/my-list");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) onUnauthorized();
      else setLoadError(apiError.message || "This destination couldn't be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError) {
    if (loadError === "Not Found" || (route.id && (loadError.toLowerCase().includes("not found") || loadError.includes("(404)")))) {
      return <main className="destination-page"><section className="destination-error not-found">
        <div className="error-mark"><Icon name="pin" size={23} /></div>
        <p className="destination-kicker">Not in this journal</p><h1>We can’t find that place.</h1>
        <p>It may have been moved or removed from your list.</p>
        <button type="button" className="destination-button primary" onClick={() => navigate("/my-list")}><Icon name="back" size={17} /> Back to My List</button>
      </section></main>;
    }
    return <LoadFailure message={loadError} retry={retryLoad} back={() => navigate("/my-list")} />;
  }

  if (route.type === "list" || route.type === "starred") {
    const isStarredPage = route.type === "starred";
    return (
      <main className="destination-page destination-list">
        <div className="destination-list-head">
          <div>
            <p className="destination-kicker"><span className="kicker-rule" /> {isStarredPage ? "The places to keep close" : "Your personal travel journal"}</p>
            <h1>{isStarredPage ? "Starred" : "My List"}<span className="title-period">.</span></h1>
            <p className="destination-intro">{isStarredPage ? "Your most-loved places, all in one little list." : "A little collection of places, past and future."}</p>
          </div>
          <div className="list-head-action">
            <span className="destination-count"><strong>{isStarredPage ? destinations.length : visibleDestinations.length}</strong> {(isStarredPage ? destinations.length : visibleDestinations.length) === 1 ? "place" : "places"}</span>
            {!isStarredPage && <>
              <button type="button" className="destination-button quiet surprise-button" onClick={surpriseMe}><Icon name="spark" size={17} /> Surprise me</button>
              <button type="button" className="destination-button primary" onClick={() => navigate("/destinations/new")}><Icon name="plus" size={18} /> Add a place</button>
            </>}
          </div>
        </div>
        {!isStarredPage && <SharePanel onUnauthorized={onUnauthorized} />}
        {!isStarredPage && surpriseMessage && <p className="surprise-message" role="status">{surpriseMessage}</p>}
        {!isStarredPage && <DestinationFilters options={findOptions} onChange={setFindOptions} categories={categories} matchCount={visibleDestinations.length} totalCount={destinations.length} />}
        {starError && <div className="star-alert" role="alert">{starError}</div>}
        {(isStarredPage ? destinations.length > 0 : visibleDestinations.length > 0) ? (
          <div className="destination-grid">
            {(isStarredPage ? destinations : visibleDestinations).map((item, index) => (
              <article className="destination-card" key={item.id} style={{ animationDelay: `${Math.min(index * 55, 275)}ms` }}>
                <button type="button" className="card-open" onClick={() => navigate(`/destinations/${item.id}`)} aria-label={`Open ${item.name}, ${item.country}`}>
                <span className={`card-landscape landscape-${item.status}`}>
                  <span className="landscape-halo" />
                  <span className="landscape-ring ring-one" />
                  <span className="landscape-ring ring-two" />
                  <span className="landscape-pin"><Icon name="pin" size={23} /></span>
                  <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                </span>
                  <span className="card-body">
                    <span className="card-title-row"><span className="card-name">{item.name}</span><StatusPill status={item.status} /></span>
                    <span className="card-country"><Icon name="globe" size={15} />{item.country}</span>
                    <span className="card-footer">
                      <span>{item.categoryName || "A place to remember"}</span>
                      <span className="card-arrow"><Icon name="arrow" size={16} /></span>
                    </span>
                  </span>
                </button>
                <button type="button" className={`star-toggle card-star ${item.starred ? "is-starred" : ""}`} aria-label={`${item.starred ? "Remove" : "Add"} ${item.name} ${item.starred ? "from" : "to"} starred`} aria-pressed={item.starred} disabled={starPendingId !== null} onClick={() => toggleStar(item)}>
                  <Icon name="star" size={18} />
                </button>
              </article>
            ))}
          </div>
        ) : isStarredPage ? <StarredEmpty onBrowse={() => navigate("/my-list")} /> : destinations.length === 0 ? <EmptyList onAdd={() => navigate("/destinations/new")} /> : (
          <section className="destination-empty filter-empty">
            <div className="empty-orbit"><Icon name="pin" size={33} /></div>
            <span className="destination-kicker">A different way to wander</span>
            <h2>No places match those filters.</h2>
            <p>Try another search or loosen a filter to bring your destinations back into view.</p>
            <button type="button" className="destination-button primary" onClick={() => setFindOptions(initialFindOptions)}>Clear search and filters <Icon name="arrow" size={17} /></button>
          </section>
        )}
      </main>
    );
  }

  if (route.type === "new" || route.type === "edit") {
    const isEdit = route.type === "edit";
    return (
      <main className="destination-page destination-form-page">
        <button type="button" className="destination-back" onClick={() => isEdit && destination ? navigate(`/destinations/${destination.id}`) : navigate("/my-list")}><Icon name="back" size={17} /> {isEdit ? "Back to destination" : "Back to My List"}</button>
        <div className="form-layout">
          <header className="form-story">
            <p className="destination-kicker"><span className="kicker-rule" /> {isEdit ? "Keep the details close" : "A new page in your journal"}</p>
            <h1>{isEdit ? <>Edit this<br />destination<span className="title-period">.</span></> : <>Somewhere<br />on your mind<span className="title-period">.</span></>}</h1>
            <p>{isEdit ? "Plans shift. Memories get clearer. Make this entry yours." : "The faraway places, the familiar favorites, and everything in between."}</p>
            <div className="form-scribble" aria-hidden="true"><span /><Icon name="pin" size={25} /></div>
          </header>
          <form className="destination-form" onSubmit={submit} noValidate>
            <div className="form-section-heading"><span className="section-index">01</span><div><h2>The essentials</h2><p>Start with the place itself.</p></div></div>
            {formError && <div className="destination-form-alert" role="alert">{formError}</div>}
            <div className="destination-fields">
              <div className="destination-field full">
                <label htmlFor="destination-name">Destination name <span aria-hidden="true">*</span></label>
                <input id="destination-name" name="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="e.g. Kyoto" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "destination-name-error" : undefined} required />
                {fieldErrors.name && <span id="destination-name-error" className="destination-field-error">{fieldErrors.name}</span>}
              </div>
              <div className="destination-field">
                <label htmlFor="destination-country">Country <span aria-hidden="true">*</span></label>
                <input id="destination-country" name="country" value={form.country} onChange={(event) => updateField("country", event.target.value)} placeholder="e.g. Japan" aria-invalid={!!fieldErrors.country} aria-describedby={fieldErrors.country ? "destination-country-error" : undefined} required />
                {fieldErrors.country && <span id="destination-country-error" className="destination-field-error">{fieldErrors.country}</span>}
              </div>
              <div className="destination-field">
                <label htmlFor="destination-category">Category <span className="optional-label">Optional</span></label>
                <select id="destination-category" name="categoryId" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} aria-invalid={!!fieldErrors.categoryId}>
                  <option value="">Choose a category</option>
                  {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                </select>
                {fieldErrors.categoryId && <span className="destination-field-error">{fieldErrors.categoryId}</span>}
              </div>
            </div>
            <div className="form-section-heading section-spaced"><span className="section-index">02</span><div><h2>Where it stands</h2><p>Dreaming, planning, or remembering.</p></div></div>
            <fieldset className="status-options">
              <legend className="sr-only">Destination status</legend>
              {(["dream", "planned", "visited"] as DestinationStatus[]).map((status) => (
                <label className={`status-option option-${status} ${form.status === status ? "selected" : ""}`} key={status}>
                  <input type="radio" name="status" value={status} checked={form.status === status} onChange={() => updateField("status", status)} />
                  <span className="option-dot" /><span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </label>
              ))}
            </fieldset>
            {fieldErrors.status && <span className="destination-field-error">{fieldErrors.status}</span>}
            <div className="destination-fields secondary-fields">
              <div className="destination-field">
                <label htmlFor="destination-priority">Priority <span className="optional-label">1–5</span></label>
                <select id="destination-priority" name="priority" value={form.priority} onChange={(event) => updateField("priority", event.target.value)} aria-invalid={!!fieldErrors.priority}>
                  {[1, 2, 3, 4, 5].map((priority) => <option key={priority} value={priority}>{priority}{priority === 1 ? " — whenever" : priority === 5 ? " — top of my list" : ""}</option>)}
                </select>
                {fieldErrors.priority && <span className="destination-field-error">{fieldErrors.priority}</span>}
              </div>
              <div className="destination-field">
                <label htmlFor="destination-cost">Estimated cost <span className="optional-label">Optional</span></label>
                <input id="destination-cost" name="estimatedCost" type="number" min="0" step="any" inputMode="decimal" value={form.estimatedCost} onChange={(event) => updateField("estimatedCost", event.target.value)} placeholder="e.g. 1200" aria-invalid={!!fieldErrors.estimatedCost} />
                {fieldErrors.estimatedCost && <span className="destination-field-error">{fieldErrors.estimatedCost}</span>}
              </div>
              <div className="destination-field full">
                <label htmlFor="destination-date">Visited date <span className="optional-label">Optional</span></label>
                <input id="destination-date" type="date" name="visitedDate" value={form.visitedDate} onChange={(event) => updateField("visitedDate", event.target.value)} aria-invalid={!!fieldErrors.visitedDate} />
                {fieldErrors.visitedDate && <span className="destination-field-error">{fieldErrors.visitedDate}</span>}
              </div>
              <div className="destination-field full">
                <label htmlFor="destination-notes">Notes <span className="optional-label">Optional</span></label>
                <textarea id="destination-notes" name="notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="A detail you want to remember, or a reason this place is calling…" rows={4} aria-invalid={!!fieldErrors.notes} />
                {fieldErrors.notes && <span className="destination-field-error">{fieldErrors.notes}</span>}
              </div>
            </div>
            <section className="coordinate-section" aria-labelledby="coordinate-heading">
              <div className="form-section-heading section-spaced">
                <span className="section-index">03</span>
                <div><h2 id="coordinate-heading">Place on the map</h2><p>Add a pin to your personal map.</p></div>
              </div>
              <button type="button" className="destination-button quiet location-search-button" onClick={findLocation} disabled={findingLocation}>
                <Icon name="pin" size={17} /> {findingLocation ? "Finding location…" : "Find location"}
              </button>
              <p className="location-privacy-note">This sends the destination name and, if entered, country to OpenStreetMap’s Nominatim search when you click. Notes are not sent.</p>
              {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
              {matchedPlace && <div className="location-match" aria-label="Matched place">
                <strong>Matched place</strong>
                <span>{matchedPlace.label}</span>
              </div>}
              <div className="destination-fields coordinate-fields">
                <div className="destination-field">
                  <label htmlFor="destination-latitude">Latitude <span className="optional-label">−90 to 90</span></label>
                  <input id="destination-latitude" name="latitude" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => updateField("latitude", event.target.value)} placeholder="e.g. 35.0116" aria-invalid={!!fieldErrors.latitude} aria-describedby={fieldErrors.latitude ? "destination-latitude-error" : undefined} />
                  {fieldErrors.latitude && <span id="destination-latitude-error" className="destination-field-error">{fieldErrors.latitude}</span>}
                </div>
                <div className="destination-field">
                  <label htmlFor="destination-longitude">Longitude <span className="optional-label">−180 to 180</span></label>
                  <input id="destination-longitude" name="longitude" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => updateField("longitude", event.target.value)} placeholder="e.g. 135.7681" aria-invalid={!!fieldErrors.longitude} aria-describedby={fieldErrors.longitude ? "destination-longitude-error" : undefined} />
                  {fieldErrors.longitude && <span id="destination-longitude-error" className="destination-field-error">{fieldErrors.longitude}</span>}
                </div>
              </div>
            </section>
            <div className="destination-form-actions">
              <button type="button" className="destination-button quiet" onClick={() => isEdit && destination ? navigate(`/destinations/${destination.id}`) : navigate("/my-list")}>Cancel</button>
              <button type="submit" className="destination-button primary" disabled={saving}>{saving ? <><span className="button-pulse" /> Saving…</> : <>{isEdit ? "Save changes" : "Save destination"} <Icon name="arrow" size={17} /></>}</button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  if (!destination) return <LoadFailure message="This destination isn't available right now." retry={retryLoad} back={() => navigate("/my-list")} />;
  return (
    <main className="destination-page destination-detail-page">
      <button type="button" className="destination-back" onClick={() => navigate("/my-list")}><Icon name="back" size={17} /> Back to My List</button>
      <article className="destination-detail">
        <div className={`detail-landscape landscape-${destination.status}`}>
          <span className="detail-sun" /><span className="detail-contour contour-a" /><span className="detail-contour contour-b" />
          <span className="detail-pin"><Icon name="pin" size={34} /></span>
          <span className="detail-landscape-caption">WANDERLIST&nbsp; / &nbsp;{destination.status.toUpperCase()}</span>
        </div>
        <div className="detail-content">
          <div className="detail-topline"><p className="destination-kicker"><span className="kicker-rule" /> A place in your journal</p><StatusPill status={destination.status} /></div>
          <h1>{destination.name}<span className="title-period">.</span></h1>
          <p className="detail-country"><Icon name="globe" size={17} />{destination.country}</p>
          <div className="detail-meta">
            {destination.categoryName && <span><Icon name="tag" size={16} />{destination.categoryName}</span>}
            {destination.visitedDate && <span><Icon name="calendar" size={16} />{new Date(`${destination.visitedDate}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>}
            {destination.estimatedCost && <span><span className="cost-sign">$</span>{destination.estimatedCost}</span>}
          </div>
          {starError && <div className="star-alert detail-star-alert" role="alert">{starError}</div>}
          <button type="button" className={`star-toggle detail-star ${destination.starred ? "is-starred" : ""}`} aria-label={`${destination.starred ? "Remove" : "Add"} ${destination.name} ${destination.starred ? "from" : "to"} starred`} aria-pressed={destination.starred} disabled={starPendingId !== null} onClick={() => toggleStar(destination)}>
            <Icon name="star" size={18} /> {starPendingId === destination.id ? "Updating…" : destination.starred ? "Starred" : "Add to starred"}
          </button>
          <div className="detail-divider" />
          <div className="detail-priority">
            <span className="detail-label">Priority</span>
            <span className="priority-dots" aria-label={`Priority ${destination.priority} out of 5`}>{[1, 2, 3, 4, 5].map((point) => <i key={point} className={point <= destination.priority ? "filled" : ""} />)}</span>
            <span className="priority-value">{destination.priority} / 5</span>
          </div>
          {destination.notes && <div className="detail-notes"><p className="detail-label">A note to remember</p><p>{destination.notes}</p></div>}
          {loadError && <div className="destination-form-alert" role="alert">{loadError}</div>}
          <div className="detail-actions">
            <button type="button" className="destination-button primary" onClick={() => navigate(`/destinations/${destination.id}/edit`)}><Icon name="edit" size={17} /> Edit destination</button>
            <button type="button" className="destination-button delete-button" disabled={deleting} onClick={deleteDestination}><Icon name="trash" size={17} /> {deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </div>
      </article>
    </main>
  );
}
