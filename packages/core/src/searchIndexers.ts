/**
 * Search Indexers (spec 224 follow-up).
 *
 * globalSearch.ts's GlobalSearchIndex is deliberately store-agnostic —
 * it only knows about SearchableRecord, not about Project/Task/
 * Wallet/etc. This module is the missing link: one pure mapper
 * function per domain entity (`*ToSearchRecord`), plus `reindexAll()`
 * to bulk-sync a store's current contents into an index in one call.
 *
 * Deliberate scope: entities from spec 224's explicit list that
 * already have a store with a `listAll()`/`list()` method are wired
 * here — Projects, Campaigns, Requirements, Tasks, Missions, Wallets.
 * Accounts/Transactions/Activities/Workflows/Research/Evidence/
 * Claims/Rewards/Memories/Events/Checkpoints/Devices are on the same
 * list in the spec but are not wired here; wiring them is future work,
 * not silently assumed done by this module's existence.
 *
 * This module does not subscribe to anything automatically (no event
 * bus listener registered here) — a caller must invoke `reindexAll()`
 * after mutations, or wire per-mutation `index.upsert()` calls at the
 * kernel/API layer. Keeping it manual keeps this module simple and
 * testable without requiring every store to depend on
 * GlobalSearchIndex.
 */
import type {
  Campaign,
  Mission,
  Project,
  Requirement,
  SearchableRecord,
  Task,
  Wallet,
} from "@airdrop-os/types";
import type { GlobalSearchIndex } from "./globalSearch.js";

export function projectToSearchRecord(project: Project): SearchableRecord {
  return {
    entityType: "PROJECT",
    entityId: project.projectId,
    label: project.name,
    searchableText: [
      project.slug,
      project.category ?? "",
      project.status,
      project.website ?? "",
      ...project.chains,
    ].join(" "),
  };
}

export function campaignToSearchRecord(campaign: Campaign): SearchableRecord {
  return {
    entityType: "CAMPAIGN",
    entityId: campaign.campaignId,
    label: campaign.name,
    searchableText: [campaign.projectId, campaign.currentPhase].join(" "),
  };
}

export function requirementToSearchRecord(requirement: Requirement): SearchableRecord {
  return {
    entityType: "REQUIREMENT",
    entityId: requirement.requirementId,
    label: requirement.description,
    searchableText: [
      requirement.type,
      requirement.status,
      requirement.chain ?? "",
      requirement.activity ?? "",
      requirement.source,
    ].join(" "),
  };
}

export function taskToSearchRecord(task: Task): SearchableRecord {
  return {
    entityType: "TASK",
    entityId: task.taskId,
    label: task.title,
    searchableText: [task.type, task.status, task.description].join(" "),
  };
}

export function missionToSearchRecord(mission: Mission): SearchableRecord {
  return {
    entityType: "MISSION",
    entityId: mission.missionId,
    label: mission.objective,
    searchableText: [mission.status, mission.projectId, mission.campaignId ?? ""].join(" "),
  };
}

export function walletToSearchRecord(wallet: Wallet): SearchableRecord {
  return {
    entityType: "WALLET",
    entityId: wallet.walletId,
    label: wallet.address,
    searchableText: [wallet.label, wallet.status, ...wallet.chains].join(" "),
  };
}

/**
 * Bulk-syncs `entities` into `index` using `mapper`. Clears any
 * existing records of that entityType first so removed/renamed
 * entities don't linger as stale search hits — this makes reindexAll
 * idempotent and safe to call repeatedly (e.g. on a schedule or after
 * a batch of mutations) rather than only additive.
 */
export function reindexAll<T>(
  index: GlobalSearchIndex,
  entityType: string,
  entities: T[],
  mapper: (entity: T) => SearchableRecord
): void {
  index.clearType(entityType);
  for (const entity of entities) {
    index.upsert(mapper(entity));
  }
}
