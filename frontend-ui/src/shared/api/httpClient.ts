export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function httpRequest<T>(url: string, method: HttpMethod, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}
