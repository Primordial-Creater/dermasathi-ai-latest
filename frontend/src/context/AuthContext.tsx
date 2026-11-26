import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../services/authService";
import * as authService from "../services/authService";
import { setAccessToken } from "../services/apiClient";
import { useAppMode } from "./AppModeContext";

interface AuthContextValue {
  user: AuthUser | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string, language: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { setDemoMode } = useAppMode();
  // A pending restore request must never overwrite a newer login/register.
  // The restore request itself is single-flight in authService for StrictMode.
  const authOperation = useRef(0);

  const refreshProfile = useCallback(async () => {
    const operation = ++authOperation.current;
    try {
      const restored = await authService.restoreSession();
      if (operation !== authOperation.current) return null;
      setUser(restored);
      setDemoMode(false);
      return restored;
    } catch {
      if (operation !== authOperation.current) return null;
      setAccessToken(null);
      setUser(null);
      setDemoMode(false);
      return null;
    }
  }, [setDemoMode]);

  useEffect(() => {
    let active = true;
    const operation = authOperation.current;
    authService.restoreSession()
      .then((restored) => {
        if (active && operation === authOperation.current) {
          setUser(restored);
          setDemoMode(false);
        }
      })
      .catch(() => {
        if (active && operation === authOperation.current) {
          setAccessToken(null);
          setUser(null);
          // An expired/missing session is not a reason to silently turn on
          // simulated mode. Protected clinical actions will request sign-in.
          setDemoMode(false);
        }
      })
      .finally(() => { if (active) setIsInitializing(false); });
    return () => { active = false; };
  }, [setDemoMode]);

  const login = useCallback(async (email: string, password: string) => {
    const operation = ++authOperation.current;
    const authenticated = await authService.login(email, password);
    if (operation === authOperation.current) {
      setUser(authenticated);
      setDemoMode(false);
      setIsInitializing(false);
    }
    return authenticated;
  }, [setDemoMode]);

  const register = useCallback(async (fullName: string, email: string, password: string, language: string) => {
    const operation = ++authOperation.current;
    const created = await authService.register(fullName, email, password, language);
    if (operation === authOperation.current) {
      setUser(created);
      setDemoMode(false);
      setIsInitializing(false);
    }
    return created;
  }, [setDemoMode]);

  const logout = useCallback(async () => {
    const operation = ++authOperation.current;
    // Retain the authenticated UI if the server cannot confirm logout.
    await authService.logout();
    if (operation === authOperation.current) {
      setUser(null);
      setDemoMode(false);
    }
  }, [setDemoMode]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isInitializing,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshProfile,
  }), [user, isInitializing, login, register, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
