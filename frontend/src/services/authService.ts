import { apiFetch, setAccessToken } from "./apiClient";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  preferred_language: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: Partial<AuthUser>;
}

async function completeAuth(path: string, payload: Record<string, string>): Promise<AuthUser> {
  const result = await apiFetch<TokenResponse>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  }, { skipAuthRefresh: true });

  if (!result.access_token) throw new Error("The server did not return an access token.");
  setAccessToken(result.access_token);
  return apiFetch<AuthUser>("/api/v1/auth/me");
}

export function login(email: string, password: string): Promise<AuthUser> {
  return completeAuth("/api/v1/auth/login", { email, password });
}

export function register(
  fullName: string,
  email: string,
  password: string,
  preferredLanguage: string,
): Promise<AuthUser> {
  return completeAuth("/api/v1/auth/register", {
    full_name: fullName,
    email,
    password,
    preferred_language: preferredLanguage,
  });
}

let restoreSessionInFlight: Promise<AuthUser> | null = null;

async function restoreSessionOnce(): Promise<AuthUser> {
  const refreshed = await apiFetch<TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
  }, { skipAuthRefresh: true });
  if (!refreshed.access_token) throw new Error("Refresh did not return an access token.");
  setAccessToken(refreshed.access_token);
  return apiFetch<AuthUser>("/api/v1/auth/me");
}

/**
 * React StrictMode runs mount effects twice in development. The backend rotates
 * refresh cookies on every successful refresh, so concurrent calls with the
 * same cookie can revoke one another. Share one in-flight session restoration.
 */
export function restoreSession(): Promise<AuthUser> {
  if (!restoreSessionInFlight) {
    restoreSessionInFlight = restoreSessionOnce().finally(() => {
      restoreSessionInFlight = null;
    });
  }
  return restoreSessionInFlight;
}

export async function logout(): Promise<void> {
  await apiFetch<{ success: boolean }>("/api/v1/auth/logout", {
    method: "POST",
  }, { skipAuthRefresh: true });
  setAccessToken(null);
}
