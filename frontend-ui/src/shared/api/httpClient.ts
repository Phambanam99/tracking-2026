export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequestOptions = {
  path: string;
  method: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  public constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

type HttpClientConfig = {
  baseUrl: string;
  getAccessToken: () => string | null;
  refreshSession: () => Promise<boolean>;
  onUnauthorized: () => void;
};

const defaultBaseUrl = import.meta.env.VITE_GATEWAY_HTTP_BASE ?? "";

let config: HttpClientConfig = {
  baseUrl: defaultBaseUrl,
  getAccessToken: () => null,
  refreshSession: async () => false,
  onUnauthorized: () => undefined,
};

export function configureHttpClient(nextConfig: Partial<HttpClientConfig>): void {
  config = {
    ...config,
    ...nextConfig,
  };
}

export async function httpRequest<T>(options: HttpRequestOptions): Promise<T> {
  const response = await send(options);
  if (response.status === 401 && options.retryOnUnauthorized !== false && options.skipAuth !== true) {
    const refreshed = await config.refreshSession();
    if (refreshed) {
      const retriedResponse = await send(options);
      return parseResponse<T>(retriedResponse);
    }
    config.onUnauthorized();
  }
  return parseResponse<T>(response);
}

async function send(options: HttpRequestOptions): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (!options.skipAuth) {
    const accessToken = config.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return fetch(resolveUrl(options.path), {
    method: options.method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, body);
  }

  return body as T;
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (!config.baseUrl) {
    return path;
  }
  return `${config.baseUrl}${path}`;
}
