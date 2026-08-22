"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type DeviceRecord } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { StatusPill } from "@/components/StatusPill";
import { StateRail } from "@/components/StateRail";

const TRUST_STATES = ["NEW", "PENDING", "TRUSTED", "LIMITED", "SUSPENDED", "REVOKED"];

// Mirrors the transition table in packages/identity/src/deviceRegistry.ts -
// the UI only offers transitions the backend will actually accept.
const ALLOWED_NEXT: Record<string, string[]> = {
  NEW: ["PENDING", "REVOKED"],
  PENDING: ["TRUSTED", "LIMITED", "REVOKED"],
  TRUSTED: ["LIMITED", "SUSPENDED", "REVOKED"],
  LIMITED: ["TRUSTED", "SUSPENDED", "REVOKED"],
  SUSPENDED: ["LIMITED", "TRUSTED", "REVOKED"],
  REVOKED: [],
};

export default function DevicesPage() {
  const { session } = useAuth();
  const [devices, setDevices] = useState<DeviceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!session) return;
    api
      .listDevices(session.accessToken)
      .then((res) => setDevices(res.devices))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load devices"));
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTransition(deviceId: string, to: string) {
    if (!session) return;
    setPendingId(deviceId);
    setError(null);
    try {
      await api.transitionDevice(session.accessToken, deviceId, to as DeviceRecord["status"]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Transition failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-100">Devices</h1>
        <p className="mt-1 text-sm text-ink-500">
          Every device attached to your agent identity. New devices start at <span className="font-mono text-ink-300">NEW</span> with read-only access.
        </p>
        <p className="mt-1 text-xs text-ink-700">
          Trust-state changes require an ADMIN-scoped session per the backend&apos;s permission model — the backend
          never auto-grants that scope, so a transition attempt below may correctly fail until one is issued.
        </p>
      </div>

      {error && (
        <div className="rounded border border-signal-blocked/40 bg-signal-blocked/10 px-3 py-2 text-sm text-signal-blocked">{error}</div>
      )}

      {!devices ? (
        <div className="text-sm text-ink-500">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="rounded border border-dashed border-base-600 p-6 text-sm text-ink-500">
          No devices registered yet.
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const nextOptions = ALLOWED_NEXT[device.status] ?? [];
            return (
              <div key={device.id} className="rounded border border-base-700 bg-base-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-100">{device.name}</span>
                      <span className="font-mono text-xs text-ink-700">{device.type}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      {device.platform} · v{device.version}
                    </div>
                  </div>
                  <StatusPill status={device.status} />
                </div>

                <div className="mt-3">
                  <StateRail states={TRUST_STATES} current={device.status} />
                </div>

                {nextOptions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextOptions.map((to) => (
                      <button
                        key={to}
                        onClick={() => handleTransition(device.id, to)}
                        disabled={pendingId === device.id}
                        className="rounded border border-base-600 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:border-signal-active hover:text-signal-active disabled:opacity-50"
                      >
                        Move to {to.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
