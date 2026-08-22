/**
 * Thin fetch wrapper around the Fastify API (apps/api). Every function
 * here calls a route that actually exists in the backend - there is no
 * mock data anywhere in this file. Sections of the UI whose backend
 * route doesn't exist yet (Phase 2-13 domain logic isn't exposed via
 * HTTP as of this commit) render an honest "not connected" state
 * instead of calling something fabricated - see NotWiredCard.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

export interface DeviceInput {
  type: "VPS" | "PC" | "ANDROID" | "WEB" | "CHROME_EXTENSION";
  name: string;
  platform: string;
  version: string;
}

export interface RegisterResponse {
  userId: string;
  agentId: string;
  agentLabel: string;
  deviceId: string;
  deviceStatus: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  deviceId: string;
  deviceStatus: string;
  scope: string[];
}

export interface DeviceRecord {
  id: string;
  agentId: string;
  type: DeviceInput["type"];
  name: string;
  platform: string;
  version: string;
  status: "NEW" | "PENDING" | "TRUSTED" | "LIMITED" | "SUSPENDED" | "REVOKED";
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  components: Record<string, { status: "ok" | "error" | "not_configured"; detail?: string }>;
}

export const api = {
  register: (email: string, password: string, device: DeviceInput) =>
    request<RegisterResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, device }) }),

  login: (email: string, password: string, device: DeviceInput) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, device }) }),

  refresh: (refreshToken: string) =>
    request<LoginResponse>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  revoke: (refreshToken: string) =>
    request<{ revoked: boolean }>("/auth/revoke", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  listDevices: (token: string) => request<{ devices: DeviceRecord[] }>("/devices", {}, token),

  transitionDevice: (token: string, deviceId: string, to: DeviceRecord["status"]) =>
    request<{ deviceId: string; status: string }>(
      "/devices/transition",
      { method: "POST", body: JSON.stringify({ deviceId, to }) },
      token
    ),

  health: () => request<HealthReport>("/health"),
  readiness: () => request<HealthReport>("/readiness"),
};

export { API_BASE };
