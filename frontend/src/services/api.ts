import { apiFetch } from "./apiClient";

export interface ApiClientOptions {
  requireAuth?: boolean;
  skipAuth?: boolean;
}

function makeInit(method: string, body?: unknown): RequestInit {
  if (body === undefined) return { method };
  if (typeof FormData !== "undefined" && body instanceof FormData) return { method, body };
  return { method, body: JSON.stringify(body) };
}

export const apiClient = {
  get<T = any>(path: string, options: ApiClientOptions = {}): Promise<T> {
    return apiFetch<T>(path, makeInit("GET"), { skipAuthRefresh: Boolean(options.skipAuth) });
  },
  post<T = any>(path: string, body?: unknown, options: ApiClientOptions = {}): Promise<T> {
    return apiFetch<T>(path, makeInit("POST", body), { skipAuthRefresh: Boolean(options.skipAuth) });
  },
  patch<T = any>(path: string, body?: unknown, options: ApiClientOptions = {}): Promise<T> {
    return apiFetch<T>(path, makeInit("PATCH", body), { skipAuthRefresh: Boolean(options.skipAuth) });
  },
  delete<T = void>(path: string, options: ApiClientOptions = {}): Promise<T> {
    return apiFetch<T>(path, makeInit("DELETE"), { skipAuthRefresh: Boolean(options.skipAuth) });
  },
};
