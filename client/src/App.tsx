import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import DestinationWorkspace from './Destinations';
import Dashboard from './Dashboard';
import MapView from './MapView';
import PublicShare from './PublicShare';
import SharePanel from './SharePanel';
import './index.css';

type User = { id: number; email: string };
type Route = '/login' | '/signup' | '/my-list' | '/starred' | '/map' | '/dashboard' | '/share' | `/share/${string}` | `/destinations/${string}`;

function getRoute(): Route {
  const path = window.location.pathname;
  if (path === '/login' || path === '/signup') return path;
  if (path === '/starred') return path;
  if (path === '/dashboard') return path;
  if (path === '/map') return path;
  if (path === '/share') return path;
  if (path.startsWith('/share/')) return path as Route;
  if (path.startsWith('/destinations/')) return path as Route;
  return '/my-list';
}

function navigate(path: Route, replace = false) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function Brand() {
  return (
    <a className="brand" href="/my-list" onClick={(event) => { event.preventDefault(); navigate('/my-list'); }} aria-label="Wanderlist home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 18.4 9.3 6l3 7.1 1.8-4.3 4.9 9.6M4.5 19.2h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.3" cy="5.2" r="1.5" fill="#F4E4C1"/></svg>
      </span>
      <span className="brand-name">wanderlist</span>
    </a>
  );
}

function TravelArt() {
  return (
    <div className="auth-visual">
      <Brand />
      <div className="visual-copy">
        <span className="eyebrow">A little more out there</span>
        <h1>Keep the places<br />you dream about.</h1>
        <p>Your own quiet corner for everywhere you want to go, and every journey that stays with you.</p>
      </div>
      <div className="visual-note"><span className="note-line" /> A journal for the road ahead</div>
    </div>
  );
}

function AuthPage({ mode, onAuthenticated }: { mode: 'login' | 'signup'; onAuthenticated: (user: User) => void }) {
  const signup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) next.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) next.email = 'Enter a valid email address.';
    if (!password.trim()) next.password = 'Please enter your password.';
    else if (signup && password.length < 8) next.password = 'Use at least 8 characters for your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!validate()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${signup ? 'signup' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : '';
        const normalized = message.toLowerCase();
        if (response.status === 409 || normalized.includes('already') || normalized.includes('exist') || normalized.includes('duplicate')) {
          setErrors({ email: 'An account with this email already exists. Try logging in instead.' });
        } else if (!signup && (response.status === 401 || normalized.includes('credential') || normalized.includes('password'))) {
          setNotice('That email and password don’t match. Please try again.');
        } else if (response.status === 400 && normalized.includes('email')) {
          setErrors({ email: message || 'Please check your email address.' });
        } else if (response.status === 400 && normalized.includes('password')) {
          setErrors({ password: message || 'Please check your password.' });
        } else {
          setNotice(message || 'We couldn’t complete that just now. Please try again.');
        }
        return;
      }
      if (payload.user) onAuthenticated(payload.user as User);
      else setNotice('Your account was created, but we couldn’t confirm the session. Please log in.');
    } catch {
      setNotice('We couldn’t reach Wanderlist. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const changeEmail = (value: string) => { setEmail(value); setErrors((prev) => ({ ...prev, email: undefined })); setNotice(''); };
  const changePassword = (value: string) => { setPassword(value); setErrors((prev) => ({ ...prev, password: undefined })); setNotice(''); };

  return (
    <div className="auth-layout">
      <TravelArt />
      <main className="form-side">
        <section className="form-wrap" aria-labelledby="auth-heading">
          <Brand />
          <h2 className="form-heading" id="auth-heading">{signup ? 'Start your Wanderlist' : 'Welcome back'}</h2>
          <p className="form-subtitle">{signup ? 'A home for all the places calling your name.' : 'Your next adventure is right where you left it.'}</p>
          <form className="auth-form" onSubmit={submit} noValidate>
            {notice && <div className="form-alert" role="alert">
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4.5m0 3h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              <span>{notice}</span>
            </div>}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
                onChange={(event) => changeEmail(event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
              {errors.email && <span id="email-error" className="field-error">{errors.email}</span>}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? 'At least 8 characters' : 'Enter your password'} value={password}
                onChange={(event) => changePassword(event.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
              {errors.password && <span id="password-error" className="field-error">{errors.password}</span>}
            </div>
            <button className="submit-button" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" />{signup ? 'Creating your account…' : 'Logging you in…'}</> : signup ? 'Create account' : 'Log in'}
            </button>
          </form>
          <p className="form-foot">
            {signup ? 'Already have an account? ' : 'New to Wanderlist? '}
            <a className="text-link" href={signup ? '/login' : '/signup'} onClick={(event) => { event.preventDefault(); navigate(signup ? '/login' : '/signup'); }}>
              {signup ? 'Log in' : 'Create an account'}
            </a>
          </p>
          <p className="privacy-note">Your list is yours alone. We’ll keep it that way.</p>
        </section>
      </main>
    </div>
  );
}

function SiteNav({ path, onLogout, busy }: { path: string; onLogout: () => void; busy: boolean }) {
  return (
    <header className="site-header">
      <nav className="nav-inner" aria-label="Main navigation">
        <Brand />
        <div className="nav-links">
          <a className={`nav-item ${path === '/my-list' || path.startsWith('/destinations/') ? 'active' : ''}`} href="/my-list" aria-current={path === '/my-list' || path.startsWith('/destinations/') ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('/my-list'); }}>My List</a>
          <a className={`nav-item ${path === '/starred' ? 'active' : ''}`} href="/starred" aria-current={path === '/starred' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('/starred'); }}>Starred</a>
          <a className={`nav-item ${path === '/map' ? 'active' : ''}`} href="/map" aria-current={path === '/map' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('/map'); }}>Map</a>
          <a className={`nav-item ${path === '/dashboard' ? 'active' : ''}`} href="/dashboard" aria-current={path === '/dashboard' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('/dashboard'); }}>Dashboard</a>
          <a className={`nav-item ${path === '/share' ? 'active' : ''}`} href="/share" aria-current={path === '/share' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('/share'); }}>Share list</a>
        </div>
        <button className="nav-logout" type="button" onClick={onLogout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button>
      </nav>
    </header>
  );
}

function MyList({ path, onUnauthorized, onLogout, logoutBusy, logoutError }: { path: string; onUnauthorized: () => void; onLogout: () => void; logoutBusy: boolean; logoutError: string }) {
  return (
    <div className="app-shell">
      <SiteNav path={path} onLogout={onLogout} busy={logoutBusy} />
      {logoutError && <div className="form-alert" role="alert" style={{ maxWidth: 520, margin: '24px auto' }}>{logoutError}</div>}
      {path === '/share'
        ? <SharePanel onUnauthorized={onUnauthorized} />
        : path === '/dashboard'
        ? <Dashboard onUnauthorized={onUnauthorized} />
        : path === '/map'
          ? <MapView navigate={(nextPath) => navigate(nextPath as Route)} onUnauthorized={onUnauthorized} />
        : <DestinationWorkspace path={path} navigate={(nextPath) => navigate(nextPath as Route)} onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function LoadingScreen() {
  return <main className="skeleton" aria-label="Loading your list" aria-busy="true"><div className="skeleton-line" /><div className="skeleton-line large" /><div className="skeleton-panel" /></main>;
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    if (route.startsWith('/share/')) {
      setUser(null);
      setChecking(false);
      setCheckError(false);
      return () => { active = false; };
    }
    setChecking(true);
    setCheckError(false);
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setUser(null);
          if (route !== '/login' && route !== '/signup') navigate('/login', true);
          return;
        }
        if (!response.ok) throw new Error('Could not check your session');
        const payload = await response.json();
        if (!active) return;
        setUser(payload.user || null);
        if (payload.user && (route === '/login' || route === '/signup')) navigate('/my-list', true);
      })
      .catch(() => { if (active) setCheckError(true); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [route, retryCount]);

  function authenticated(nextUser: User) {
    setUser(nextUser);
    navigate('/my-list', true);
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!response.ok && response.status !== 204) throw new Error('Logout failed');
      setUser(null);
      navigate('/login', true);
    } catch {
      setLogoutError('We couldn’t log you out just now. Please try again.');
    } finally {
      setLogoutBusy(false);
    }
  }

  if (route.startsWith('/share/')) {
    const token = route.slice('/share/'.length).split('/')[0];
    return <PublicShare token={token} navigate={(path) => navigate(path as Route)} />;
  }

  if (checking) return <LoadingScreen />;
  if (checkError && !user) return <main className="load-error">
    <span className="eyebrow">A small detour</span><h1>We couldn’t connect.</h1>
    <p>Your account is safe. Check your connection and try again.</p>
    <button className="retry-button" type="button" onClick={() => { setCheckError(false); setChecking(true); setRetryCount((count) => count + 1); }}>Try again</button>
  </main>;
  if (route !== '/login' && route !== '/signup') return user ? <MyList path={route} onUnauthorized={() => { setUser(null); navigate('/login', true); }} onLogout={logout} logoutBusy={logoutBusy} logoutError={logoutError} /> : <LoadingScreen />;
  return <AuthPage key={route} mode={route === '/signup' ? 'signup' : 'login'} onAuthenticated={authenticated} />;
}
