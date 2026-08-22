"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiError, type DeviceInput, type LoginResponse } from "./api";

interface Session {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  scope: string[];
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, device: DeviceInput) => Promise<void>;
  login: (email: string, password: string, device: DeviceInput) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "airdrop-os.session";

function storeSession(res: LoginResponse): Session {
  const session: Session = {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    deviceId: res.deviceId,
    scope: res.scope,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const register = useCallback(async (email: string, password: string, device: DeviceInput) => {
    setError(null);
    try {
      await api.register(email, password, device);
      // Registration creates the account + device; sign in immediately after.
      const res = await api.login(email, password, device);
      setSession(storeSession(res));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API. Is it running?");
      throw err;
    }
  }, []);

  const login = useCallback(async (email: string, password: string, device: DeviceInput) => {
    setError(null);
    try {
      const res = await api.login(email, password, device);
      setSession(storeSession(res));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API. Is it running?");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (session) {
      try {
        await api.revoke(session.refreshToken);
      } catch {
        // best-effort revoke - clear local session regardless
      }
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, [session]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ session, loading, error, register, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
