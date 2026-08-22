/**
 * Audit Replay (spec section 241): "What did the agent do yesterday?"
 *
 * Reads directly from a KernelEventBus's log (in-memory or, once the
 * kernel is backed by the durable `events`/`audit_logs` tables, that
 * table) and produces a chronological, categorized summary for a time
 * range. This module never fabricates a summary for events it cannot
 * see — an empty range returns an explicit zero-count result, not a
 * guess.
 */
import type { AuditReplayEntry, AuditReplayResult, KernelEvent } from "@airdrop-os/types";
import type { KernelEventBus } from "./eventBus";

/**
 * Maps a raw eventType (e.g. "TASK_COMPLETED", "TRANSACTION_SUBMITTED")
 * to the human-facing category from spec 241's replay list. Unrecognized
 * event types fall into OTHER rather than being silently dropped, so
 * replay coverage is always the full log, never a filtered subset that
 * looks complete but isn't.
 */
const CATEGORY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["PROJECT_RESEARCH", "Research"],
  ["PROJECT", "Project update"],
  ["CAMPAIGN", "Campaign update"],
  ["REQUIREMENT", "Requirement update"],
  ["TASK", "Task"],
  ["MISSION", "Mission"],
  ["BROWSER", "Browser"],
  ["HUMAN_HANDOFF", "Human handoff"],
  ["CAPTCHA", "CAPTCHA"],
  ["CHECKPOINT", "Checkpoint / resume"],
  ["TRANSACTION", "Transaction"],
  ["APPROVAL", "Approval"],
  ["ELIGIBILITY", "Eligibility"],
  ["MEMORY", "Memory"],
  ["WORKFLOW", "Workflow update"],
  ["SECURITY", "Security"],
  ["DEVICE", "Device"],
  ["BACKUP", "Backup"],
  ["MIGRATION", "Migration"],
  ["NOTIFICATION", "Notification"],
];

function categorize(eventType: string): string {
  for (const [prefix, category] of CATEGORY_PREFIXES) {
    if (eventType.startsWith(prefix)) return category;
  }
  return "Other";
}

function summarize(event: KernelEvent): string {
  const payloadKeys = Object.keys(event.payload ?? {});
  const detail = payloadKeys.length > 0
    ? payloadKeys.slice(0, 3).map((k) => `${k}=${String(event.payload[k])}`).join(", ")
    : "";
  return detail ? `${event.eventType} (${detail})` : event.eventType;
}

export interface ReplayRangeInput {
  start: string; // ISO 8601
  end: string; // ISO 8601
  eventTypes?: string[]; // optional filter
}

export function replay(bus: KernelEventBus, range: ReplayRangeInput): AuditReplayResult {
  const startMs = Date.parse(range.start);
  const endMs = Date.parse(range.end);

  const matched = bus.getLog().filter((e) => {
    const ts = Date.parse(e.timestamp);
    if (ts < startMs || ts > endMs) return false;
    if (range.eventTypes && !range.eventTypes.includes(e.eventType)) return false;
    return true;
  });

  const byCategory: Record<string, number> = {};
  const entries: AuditReplayEntry[] = matched.map((e) => {
    const category = categorize(e.eventType);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    return {
      eventId: e.eventId,
      eventType: e.eventType,
      category,
      timestamp: e.timestamp,
      source: e.source,
      agentId: e.agentId,
      deviceId: e.deviceId,
      summary: summarize(e),
    };
  });

  return {
    rangeStart: range.start,
    rangeEnd: range.end,
    totalEvents: entries.length,
    byCategory,
    entries,
  };
}

/** Convenience: replay for the previous full UTC calendar day relative to `now`. */
export function replayYesterday(bus: KernelEventBus, now: Date = new Date()): AuditReplayResult {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  return replay(bus, {
    start: new Date(yesterdayStart).toISOString(),
    end: new Date(todayStart - 1).toISOString(),
  });
}
