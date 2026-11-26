/** Shared authenticated API client.
 * Access tokens live only in module memory; the backend's HttpOnly refresh cookie
 * is sent by the browser and is never readable by JavaScript.
 */
export const API_BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL || "http://localhost:8000";

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message || (typeof detail === "string" ? detail : `API request failed (${status})`));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function apiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function isAuthLifecyclePath(path: string): boolean {
  return /^\/api\/v1\/auth\/(login|register|refresh|logout|logout-all)(\?|$)/.test(path);
}

async function responseDetail(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return response.statusText;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    return parsed.detail ?? parsed.message ?? parsed;
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(apiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      const payload = (await response.json()) as { access_token?: string };
      if (!payload.access_token) {
        setAccessToken(null);
        return null;
      }
      setAccessToken(payload.access_token);
      return payload.access_token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface ApiRequestOptions {
  /** Disable automatic refresh for auth lifecycle endpoints. */
  skipAuthRefresh?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const makeRequest = (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    // Do not set Content-Type for FormData: the browser must add its boundary.
    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  };

  let response = await makeRequest(accessToken);
  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !isAuthLifecyclePath(path)
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await makeRequest(refreshed);
  }

  if (!response.ok) {
    const detail = await responseDetail(response);
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new ApiError(response.status, detail, message);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}
