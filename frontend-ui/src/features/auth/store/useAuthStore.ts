export type AuthState = {
  accessToken: string | null;
};

let state: AuthState = {
  accessToken: null,
};

export function getAuthState(): AuthState {
  return state;
}

export function setAuthToken(accessToken: string): void {
  state = { accessToken };
}

export function clearAuthToken(): void {
  state = { accessToken: null };
}
