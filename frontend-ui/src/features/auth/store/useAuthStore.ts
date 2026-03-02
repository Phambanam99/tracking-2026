import { useSyncExternalStore } from "react";
import {
  login as loginApi,
  logout as logoutApi,
  refreshToken as refreshTokenApi,
  register as registerApi,
  type LoginRequest,
  type RegisterRequest,
} from "../api/authApi";
import { cancelTokenRefresh, scheduleTokenRefresh } from "../security/tokenRefreshScheduler";
import { clearTokens, loadTokens, saveTokens } from "../security/tokenStorage";
import { configureHttpClient } from "../../../shared/api/httpClient";

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  roles: string[];
  isAuthenticated: boolean;
};

type JwtClaims = {
  sub?: string;
  exp?: number;
  roles?: unknown;
};

let state: AuthState = deriveState();
const listeners = new Set<() => void>();
let refreshTimerId: number | null = null;
let refreshPromise: Promise<boolean> | null = null;

configureHttpClient({
  getAccessToken: () => loadTokens().accessToken,
  refreshSession: refreshSession,
  onUnauthorized: clearAuthSession,
});

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function getAuthState(): AuthState {
  return state;
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await loginApi(request);
  applyTokens(response.accessToken, response.refreshToken);
}

export async function register(request: RegisterRequest): Promise<void> {
  const response = await registerApi(request);
  applyTokens(response.accessToken, response.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = loadTokens().refreshToken;
  if (refreshToken) {
    await logoutApi({ refreshToken }).catch(() => undefined);
  }
  clearAuthSession();
}

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  refreshPromise = doRefreshSession().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function doRefreshSession(): Promise<boolean> {
  const refreshToken = loadTokens().refreshToken;
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await refreshTokenApi({ refreshToken });
    applyTokens(response.accessToken, response.refreshToken);
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  applyTokens(accessToken, refreshToken);
}

export function clearAuthSession(): void {
  if (refreshTimerId !== null) {
    cancelTokenRefresh(refreshTimerId);
    refreshTimerId = null;
  }
  clearTokens();
  state = deriveState();
  emit();
}

export function resetAuthStoreForTest(): void {
  clearAuthSession();
  refreshPromise = null;
  listeners.clear();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function applyTokens(accessToken: string, refreshToken: string): void {
  saveTokens(accessToken, refreshToken);
  state = deriveState();
  scheduleRefresh(accessToken);
  emit();
}

function scheduleRefresh(accessToken: string): void {
  const claims = decodeClaims(accessToken);
  const expiresAt = claims.exp;
  if (!expiresAt) {
    return;
  }

  const refreshInMs = expiresAt * 1000 - Date.now() - 30_000;
  if (refreshTimerId !== null) {
    cancelTokenRefresh(refreshTimerId);
  }

  refreshTimerId = scheduleTokenRefresh(async () => {
    await refreshSession();
  }, refreshInMs);
}

function deriveState(): AuthState {
  const { accessToken, refreshToken } = loadTokens();
  const claims = accessToken ? decodeClaims(accessToken) : null;
  const roles = Array.isArray(claims?.roles) ? claims?.roles.filter((value): value is string => typeof value === "string") : [];

  return {
    accessToken,
    refreshToken,
    username: claims?.sub ?? null,
    roles,
    isAuthenticated: Boolean(accessToken),
  };
}

function decodeClaims(token: string): JwtClaims {
  const segments = token.split(".");
  if (segments.length < 2) {
    return {};
  }

  try {
    const payload = fromBase64Url(segments[1]);
    return JSON.parse(payload) as JwtClaims;
  } catch {
    return {};
  }
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}
