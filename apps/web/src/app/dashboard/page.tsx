"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type HealthReport } from "@/lib/api";
import { StatusPill } from "@/components/StatusPill";
import { NotWiredCard } from "@/components/NotWiredCard";

export default function OverviewPage() {
  const [readiness, setReadiness] = useState<HealthReport | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  useEffect(() => {
    api.readiness().then(setReadiness).catch((err) => {
      setReadinessError(err instanceof ApiError ? err.message : "Could not reach the API");
    });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-100">Overview</h1>
        <p className="mt-1 text-sm text-ink-500">Live status of the parts of the system that are actually wired up.</p>
      </div>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-ink-700">Backend readiness</h2>
        {readinessError ? (
          <div className="rounded border border-signal-blocked/40 bg-signal-blocked/10 p-4 text-sm text-signal-blocked">
            {readinessError} — is the API running at the configured NEXT_PUBLIC_API_BASE_URL?
          </div>
        ) : !readiness ? (
          <div className="rounded border border-base-700 bg-base-900 p-4 text-sm text-ink-500">Checking...</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(readiness.components).map(([name, component]) => (
              <div key={name} className="flex items-center justify-between rounded border border-base-700 bg-base-900 p-4">
                <span className="font-mono text-sm text-ink-300">{name}</span>
                <StatusPill status={component.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-ink-700">Domain modules</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NotWiredCard
            title="Agent runs & kernel"
            detail="Implemented and unit-tested in packages/core (Phase 2), not yet exposed as an API route."
          />
          <NotWiredCard
            title="Projects & research"
            detail="Implemented in packages/core (Phase 3), not yet exposed as an API route."
          />
          <NotWiredCard
            title="Eligibility & missions"
            detail="Implemented in packages/core (Phase 4), not yet exposed as an API route."
          />
          <NotWiredCard
            title="Chain activity & points"
            detail="Implemented in packages/core (Phase 5), not yet exposed as an API route."
          />
        </div>
      </section>
    </div>
  );
}
