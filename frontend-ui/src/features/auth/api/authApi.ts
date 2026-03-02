import { httpRequest } from "../../../shared/api/httpClient";

export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type LogoutRequest = {
  refreshToken: string;
};

export type CreateApiKeyRequest = {
  sourceId: string;
};

export type CreateApiKeyResponse = {
  id: number;
  sourceId: string;
  apiKey: string;
  active: boolean;
};

export async function login(request: LoginRequest): Promise<AuthTokensResponse> {
  return httpRequest<AuthTokensResponse>({
    path: "/api/v1/auth/login",
    method: "POST",
    body: request,
    skipAuth: true,
    retryOnUnauthorized: false,
  });
}

export async function register(request: RegisterRequest): Promise<AuthTokensResponse> {
  return httpRequest<AuthTokensResponse>({
    path: "/api/v1/auth/register",
    method: "POST",
    body: request,
    skipAuth: true,
    retryOnUnauthorized: false,
  });
}

export async function refreshToken(request: RefreshTokenRequest): Promise<AuthTokensResponse> {
  return httpRequest<AuthTokensResponse>({
    path: "/api/v1/auth/refresh-token",
    method: "POST",
    body: request,
    skipAuth: true,
    retryOnUnauthorized: false,
  });
}

export async function logout(request: LogoutRequest): Promise<void> {
  await httpRequest<unknown>({
    path: "/api/v1/auth/logout",
    method: "POST",
    body: request,
    retryOnUnauthorized: false,
  });
}

export async function createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  return httpRequest<CreateApiKeyResponse>({
    path: "/api/v1/auth/api-keys",
    method: "POST",
    body: request,
  });
}

export async function revokeApiKey(id: number): Promise<void> {
  await httpRequest<unknown>({
    path: `/api/v1/auth/api-keys/${id}/revoke`,
    method: "POST",
  });
}
