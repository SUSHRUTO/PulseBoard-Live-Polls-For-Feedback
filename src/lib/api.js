export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");

export const SOCKET_BASE = API_BASE || window.location.origin;

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: hasBody && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function publicPollUrl(slug) {
  return `${window.location.origin}/p/${slug}`;
}
