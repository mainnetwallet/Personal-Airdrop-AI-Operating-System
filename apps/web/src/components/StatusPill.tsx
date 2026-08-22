const COLOR_MAP: Record<string, string> = {
  // device trust states
  NEW: "text-signal-idle",
  PENDING: "text-signal-pending",
  TRUSTED: "text-signal-verified",
  LIMITED: "text-signal-pending",
  SUSPENDED: "text-signal-blocked",
  REVOKED: "text-signal-blocked",
  // health states
  ok: "text-signal-verified",
  degraded: "text-signal-pending",
  error: "text-signal-blocked",
  not_configured: "text-signal-idle",
};

export function StatusPill({ status }: { status: string }) {
  const color = COLOR_MAP[status] ?? "text-signal-idle";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border border-base-600 px-2 py-0.5 text-xs font-mono uppercase tracking-wide ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}
