// Security strategy:
// - Access token: in-memory only (lost on reload, giảm rủi ro XSS persistence)
// - Refresh token: managed by backend as HttpOnly Secure cookie (JS cannot access)

let accessToken: string | null = null;

export function saveTokens(nextAccessToken: string): void {
  accessToken = nextAccessToken;
}

export function loadTokens(): { accessToken: string | null; refreshToken: null } {
  return {
    accessToken,
    refreshToken: null,
  };
}

export function clearTokens(): void {
  accessToken = null;
}
