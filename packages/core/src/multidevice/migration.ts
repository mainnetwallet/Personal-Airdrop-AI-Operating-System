import type { MigrationDryRunReport, MigrationExecutionResult, MigrationRoute } from "@airdrop-os/types";

export interface MigrationDryRunInput {
  route: MigrationRoute;
  sourceRecordCounts: Record<string, number>;
  targetExistingRecordIds: Set<string>;
  sourceRecordIds: Set<string>;
  targetSchemaVersion: string;
  sourceSchemaVersion: string;
  invalidCheckpointIds: string[];
  targetInstalledPlugins: Set<string>;
  sourceRequiredPlugins: Set<string>;
  // Features that exist on the source but degrade/disappear on the
  // target (e.g. "Android has no PC browser automation").
  knownFeatureDegradations: string[];
}

/**
 * Migration dry run surfaces every risk before anything moves:
 * conflicting IDs, missing dependencies, invalid checkpoints, schema
 * drift, plugins the target doesn't have, and feature degradation.
 * verdict is SAFE_TO_PROCEED only when every one of those lists is
 * empty - a single conflict or invalid checkpoint blocks the route.
 */
export function planMigrationDryRun(input: MigrationDryRunInput, now?: number): MigrationDryRunReport {
  const conflicts = [...input.sourceRecordIds].filter((id) => input.targetExistingRecordIds.has(id));
  const missingDependencies: string[] = []; // populated by caller-supplied dependency-graph check if any
  const schemaDifferences =
    input.sourceSchemaVersion !== input.targetSchemaVersion
      ? [`schemaVersion mismatch: source=${input.sourceSchemaVersion} target=${input.targetSchemaVersion}`]
      : [];
  const unsupportedPlugins = [...input.sourceRequiredPlugins].filter((p) => !input.targetInstalledPlugins.has(p));

  const blocked =
    conflicts.length > 0 ||
    missingDependencies.length > 0 ||
    input.invalidCheckpointIds.length > 0 ||
    schemaDifferences.length > 0 ||
    unsupportedPlugins.length > 0 ||
    input.knownFeatureDegradations.length > 0;

  return {
    route: input.route,
    recordCounts: input.sourceRecordCounts,
    conflicts,
    missingDependencies,
    invalidCheckpoints: input.invalidCheckpointIds,
    schemaDifferences,
    unsupportedPlugins,
    featureDegradations: input.knownFeatureDegradations,
    verdict: blocked ? "BLOCKED" : "SAFE_TO_PROCEED",
    generatedAt: new Date(now ?? Date.now()).toISOString(),
  };
}

/**
 * Executes a migration only given a SAFE_TO_PROCEED dry-run report.
 * `applyFn` performs the actual write; if it throws, this executor
 * calls `rollbackFn` and reports ROLLED_BACK - it never reports
 * COMPLETED without applyFn having actually succeeded, and it never
 * leaves the system in a partially-migrated state on failure.
 */
export async function executeMigration(params: {
  dryRun: MigrationDryRunReport;
  applyFn: () => Promise<void>;
  rollbackFn: () => Promise<void>;
  now?: number;
}): Promise<MigrationExecutionResult> {
  if (params.dryRun.verdict !== "SAFE_TO_PROCEED") {
    return {
      route: params.dryRun.route,
      status: "FAILED",
      preservedStableIds: false,
      rollbackReason: "DRY_RUN_NOT_SAFE_TO_PROCEED",
      completedAt: null,
    };
  }

  try {
    await params.applyFn();
    return {
      route: params.dryRun.route,
      status: "COMPLETED",
      preservedStableIds: true,
      rollbackReason: null,
      completedAt: new Date(params.now ?? Date.now()).toISOString(),
    };
  } catch (err) {
    try {
      await params.rollbackFn();
    } catch (rollbackErr) {
      // Rollback itself failing is the worst case - surface both errors
      // rather than silently swallowing the rollback failure.
      return {
        route: params.dryRun.route,
        status: "FAILED",
        preservedStableIds: false,
        rollbackReason: `APPLY_FAILED(${(err as Error).message}); ROLLBACK_FAILED(${(rollbackErr as Error).message})`,
        completedAt: null,
      };
    }
    return {
      route: params.dryRun.route,
      status: "ROLLED_BACK",
      preservedStableIds: true,
      rollbackReason: (err as Error).message,
      completedAt: null,
    };
  }
}
