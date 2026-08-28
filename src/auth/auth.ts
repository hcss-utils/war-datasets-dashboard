// Lightweight client-side access gate for the dashboard.
//
// NOTE: This is a static front-end with no backend, so this is a soft gate
// (a single shared credential), not real server-side security. It keeps the
// dashboard out of casual view; it does not protect the bundled data files.

// Credentials are injected at build time from environment variables
// (.env.local, which is gitignored) — they are never committed to the repo.
const AUTH_USER = import.meta.env.VITE_AUTH_USER ?? '';
const AUTH_PASS = import.meta.env.VITE_AUTH_PASS ?? '';

const STORAGE_KEY = 'rubase-dash-auth';
// Token derived from the credentials; stored instead of the raw password.
const AUTH_TOKEN = btoa(`${AUTH_USER}:${AUTH_PASS}`);

export function checkCredentials(username: string, password: string): boolean {
  if (!AUTH_USER || !AUTH_PASS) return false;
  return username.trim() === AUTH_USER && password === AUTH_PASS;
}

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === AUTH_TOKEN;
  } catch {
    return false;
  }
}

export function setAuthenticated(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, AUTH_TOKEN);
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

export function clearAuthentication(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
