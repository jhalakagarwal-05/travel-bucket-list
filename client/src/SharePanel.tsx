import { useEffect, useRef, useState } from "react";
import "./share.css";

type SharePanelProps = {
  onUnauthorized: () => void;
};

type ShareLinkState = {
  active: boolean;
  createdAt: string | null;
};

type ApiError = Error & { status?: number };

async function shareRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    const error = new Error("Your session has ended. Please sign in again.") as ApiError;
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("We couldn’t update your share link. Please try again.") as ApiError;
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function ShareIcon({ kind }: { kind: "link" | "copy" | "close" }) {
  const paths = {
    link: <><path d="M10 13a5 5 0 0 0 7.07 0l2-2A5 5 0 0 0 12 3.93l-1.15 1.14" /><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.14" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function formatCreatedDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

export default function SharePanel({ onUnauthorized }: SharePanelProps) {
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;
  const [link, setLink] = useState<ShareLinkState | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    shareRequest<ShareLinkState>("/api/share-links")
      .then((result) => {
        if (!current) return;
        setLink(result);
        setShareUrl("");
      })
      .catch((reason: ApiError) => {
        if (!current) return;
        if (reason.status === 401) onUnauthorizedRef.current();
        else setError(reason.message || "We couldn’t check your share link.");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reload]);

  async function createLink() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await shareRequest<{ sharePath: string }>("/api/share-links", { method: "POST" });
      setLink({ active: true, createdAt: new Date().toISOString() });
      setShareUrl(new URL(result.sharePath, window.location.origin).toString());
      setNotice("Your new link is ready to share.");
    } catch (reason) {
      const apiError = reason as ApiError;
      if (apiError.status === 401) onUnauthorizedRef.current();
      else setError(apiError.message || "We couldn’t create a share link.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOffLink() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await shareRequest<void>("/api/share-links", { method: "DELETE" });
      setLink({ active: false, createdAt: null });
      setShareUrl("");
      setNotice("Your share link is now turned off.");
    } catch (reason) {
      const apiError = reason as ApiError;
      if (apiError.status === 401) onUnauthorizedRef.current();
      else setError(apiError.message || "We couldn’t turn off this link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    setNotice("");
    if (!shareUrl) {
      setNotice("Create a fresh link to copy its address.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("Link copied to your clipboard.");
        return;
      }
    } catch {
      // Fall through to the selectable manual-copy field.
    }
    setNotice("Select the link above and copy it using your device’s copy command.");
    const field = document.getElementById("wanderlist-share-url") as HTMLInputElement | null;
    field?.focus();
    field?.select();
  }

  return (
    <section className="share-panel" aria-labelledby="share-panel-title">
      <div className="share-panel-art" aria-hidden="true">
        <span className="share-orbit orbit-a" />
        <span className="share-orbit orbit-b" />
        <span className="share-route"><i /><i /><i /></span>
        <span className="share-art-pin"><ShareIcon kind="link" /></span>
      </div>
      <div className="share-panel-content">
        <div className="share-panel-heading">
          <div>
            <p className="share-kicker">A little window into your journal</p>
            <h2 id="share-panel-title">Share your Wanderlist</h2>
          </div>
          <span className={`share-state ${loading ? "is-loading" : link?.active ? "is-active" : "is-off"}`}>
            <span className="share-state-dot" />
            {loading ? "Checking" : link?.active ? "Link active" : "Private"}
          </span>
        </div>

        {loading ? (
          <div className="share-skeleton" aria-label="Checking share link" aria-busy="true">
            <span /><span /><span />
          </div>
        ) : error ? (
          <div className="share-message share-message-error" role="alert">
            <p>{error}</p>
            <button type="button" className="share-text-button" onClick={() => setReload((value) => value + 1)}>Try again</button>
          </div>
        ) : (
          <>
            <p className="share-panel-copy">
              {link?.active
                ? `Anyone with your link can browse your places. Turn it off whenever you like.${formatCreatedDate(link.createdAt) ? ` Created ${formatCreatedDate(link.createdAt)}.` : ""}`
                : "Keep your list private, or make a read-only link for the people you want to bring along."}
            </p>
            {shareUrl ? (
              <div className="share-url-wrap">
                <label htmlFor="wanderlist-share-url">Your share link</label>
                <div className="share-url-row">
                  <input id="wanderlist-share-url" type="text" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} aria-label="Copyable share link" />
                  <button type="button" className="share-copy-button" onClick={copyLink} disabled={busy}><ShareIcon kind="copy" /><span>Copy</span></button>
                </div>
              </div>
            ) : link?.active ? (
              <p className="share-refresh-note">The address isn’t stored after you leave this page. Create a fresh link to copy a new one.</p>
            ) : null}
            {error && <p className="share-inline-error" role="alert">{error}</p>}
            {notice && <p className="share-notice" role="status">{notice}</p>}
            <div className="share-panel-actions">
              {link?.active ? (
                <>
                  <button type="button" className="share-primary-button" onClick={createLink} disabled={busy}>
                    <ShareIcon kind="link" />{busy ? "Making a new link…" : "Create a fresh link"}
                  </button>
                  <button type="button" className="share-revoke-button" onClick={turnOffLink} disabled={busy}>
                    <ShareIcon kind="close" />{busy ? "Updating…" : "Turn link off"}
                  </button>
                </>
              ) : (
                <button type="button" className="share-primary-button" onClick={createLink} disabled={busy}>
                  <ShareIcon kind="link" />{busy ? "Creating your link…" : "Share my list"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
