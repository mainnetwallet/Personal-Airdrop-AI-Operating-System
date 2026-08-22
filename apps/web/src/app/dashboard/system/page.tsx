/**
 * This page is intentionally NOT client-rendered live data - there is
 * no API route that reports "phase completion status" and fabricating
 * one to make this page feel more alive would violate the project's
 * own honesty rules (see docs/phases/CURRENT_STATE.md). The content
 * below is a direct transcription of that file's phase summaries as of
 * the commit this page was written against - it is documentation
 * rendered in the console, not live telemetry.
 */

interface PhaseEntry {
  phase: string;
  title: string;
  summary: string;
  wired: boolean;
}

const PHASES: PhaseEntry[] = [
  { phase: "1", title: "Foundation / Identity / Database / Security", summary: "Fastify API, Postgres+Drizzle, device-bound auth, health/readiness.", wired: true },
  { phase: "2", title: "Agent OS Kernel", summary: "State machine, event bus, memory, tool registry, run limits.", wired: false },
  { phase: "3", title: "Project / Research / Evidence intelligence", summary: "Evidence graph, source reputation, airdrop-type classification.", wired: false },
  { phase: "4", title: "Requirement / Identity / Mission / Eligibility", summary: "Versioned requirements, identity graph, task DAG, eligibility engine.", wired: false },
  { phase: "5", title: "Blockchain / Activity / Snapshot / Points / Radar", summary: "RPC failover, finality machine, reorg protection, points ledger, opportunity scoring.", wired: false },
  { phase: "6", title: "Browser / PC Agent / Extension / Workflow", summary: "Session isolation, safe event capture, CAPTCHA handoff, checkpoints, teach-agent.", wired: false },
  { phase: "7", title: "Transaction Firewall / Claim Security", summary: "Prepare->decode->validate->simulate->risk->policy->sign pipeline, EIP-7702 risk.", wired: false },
  { phase: "8", title: "Off-chain intelligence / Plugins", summary: "Integration registry, off-chain adapter categories, plugin SDK.", wired: false },
  { phase: "9", title: "Android / Multi-device / Backup / Migration", summary: "Shared agent identity across devices, backup/restore, disaster recovery drills.", wired: false },
  { phase: "10", title: "Final integration / hardening", summary: "Cross-phase validation and production-readiness review.", wired: false },
];

export default function SystemStatusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-100">System status</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          This is documentation, not live telemetry — there is no API route reporting phase completion.
          &quot;Wired&quot; means an HTTP route in <span className="font-mono">apps/api</span> actually exposes that
          phase&apos;s logic. Everything else exists and is unit-tested in{" "}
          <span className="font-mono">packages/core</span> but the console has nothing real to call yet, so it
          isn&apos;t shown as if it did.
        </p>
      </div>

      <div className="overflow-hidden rounded border border-base-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-base-900 text-xs uppercase tracking-wide text-ink-700">
            <tr>
              <th className="px-4 py-2 font-medium">Phase</th>
              <th className="px-4 py-2 font-medium">Scope</th>
              <th className="px-4 py-2 font-medium">Summary</th>
              <th className="px-4 py-2 font-medium">API wiring</th>
            </tr>
          </thead>
          <tbody>
            {PHASES.map((p) => (
              <tr key={p.phase} className="border-t border-base-700">
                <td className="px-4 py-3 font-mono text-ink-500">{p.phase}</td>
                <td className="px-4 py-3 text-ink-100">{p.title}</td>
                <td className="px-4 py-3 text-ink-500">{p.summary}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-mono uppercase ${
                      p.wired
                        ? "border-signal-verified/40 text-signal-verified"
                        : "border-base-600 text-ink-700"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {p.wired ? "connected" : "not wired"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
