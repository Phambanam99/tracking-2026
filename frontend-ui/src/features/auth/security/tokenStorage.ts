export type TokenBundle = {
  accessToken: string | null;
  refreshToken: string | null;
};

const STORAGE_KEY = "tracking_auth_tokens";

let tokens: TokenBundle = {
  accessToken: null,
  refreshToken: null,
};

export function saveTokens(nextAccessToken: string, nextRefreshToken: string | null): void {
  tokens = {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
  };
  storage()?.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function loadTokens(): TokenBundle {
  const persisted = storage()?.getItem(STORAGE_KEY);
  if (persisted) {
    try {
      const parsed = JSON.parse(persisted) as Partial<TokenBundle>;
      tokens = {
        accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      };
    } catch {
      tokens = { accessToken: null, refreshToken: null };
      storage()?.removeItem(STORAGE_KEY);
    }
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export function clearTokens(): void {
  tokens = {
    accessToken: null,
    refreshToken: null,
  };
  storage()?.removeItem(STORAGE_KEY);
}

function storage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}
