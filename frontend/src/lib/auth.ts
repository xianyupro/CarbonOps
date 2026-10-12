/**
 * Client-side token storage helpers.
 * Tokens live in localStorage (JWT access + refresh). A lightweight cookie
 * mirror (`carbonops_auth`) is maintained for the Next.js edge middleware to
 * perform route guarding — middleware cannot read localStorage.
 */

const ACCESS_KEY = "carbonops_access_token";
const REFRESH_KEY = "carbonops_refresh_token";
const USER_KEY = "carbonops_user";
export const AUTH_COOKIE = "carbonops_auth";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}

export function setTokens(tokens: StoredTokens): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
  // Cookie mirror for edge middleware — value is opaque, just a presence flag.
  const expires = new Date();
  // Default session length; refresh flow will rotate the access token but
  // the cookie persists for the browser session duration.
  expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
  document.cookie = `${AUTH_COOKIE}=1; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
  document.cookie = `${AUTH_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function getCurrentUser<T = unknown>(): T | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: unknown): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}
