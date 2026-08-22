import { describe, it, expect } from "vitest";
import { planMigrationDryRun, executeMigration } from "../multidevice/migration.js";

describe("planMigrationDryRun", () => {
  it("is SAFE_TO_PROCEED when there are no conflicts, invalid checkpoints, schema drift, or missing plugins", () => {
    const report = planMigrationDryRun({
      route: "PC_TO_VPS",
      sourceRecordCounts: { projects: 3 },
      targetExistingRecordIds: new Set(["other-1"]),
      sourceRecordIds: new Set(["p1", "p2", "p3"]),
      targetSchemaVersion: "1.0.0",
      sourceSchemaVersion: "1.0.0",
      invalidCheckpointIds: [],
      targetInstalledPlugins: new Set(["plugin-a"]),
      sourceRequiredPlugins: new Set(["plugin-a"]),
      knownFeatureDegradations: [],
    });
    expect(report.verdict).toBe("SAFE_TO_PROCEED");
  });

  it("BLOCKS on a single ID conflict between source and target", () => {
    const report = planMigrationDryRun({
      route: "VPS_TO_VPS",
      sourceRecordCounts: {},
      targetExistingRecordIds: new Set(["p1"]),
      sourceRecordIds: new Set(["p1"]),
      targetSchemaVersion: "1.0.0",
      sourceSchemaVersion: "1.0.0",
      invalidCheckpointIds: [],
      targetInstalledPlugins: new Set(),
      sourceRequiredPlugins: new Set(),
      knownFeatureDegradations: [],
    });
    expect(report.verdict).toBe("BLOCKED");
    expect(report.conflicts).toEqual(["p1"]);
  });

  it("BLOCKS when target is missing a plugin the source requires", () => {
    const report = planMigrationDryRun({
      route: "PC_TO_PC",
      sourceRecordCounts: {},
      targetExistingRecordIds: new Set(),
      sourceRecordIds: new Set(),
      targetSchemaVersion: "1.0.0",
      sourceSchemaVersion: "1.0.0",
      invalidCheckpointIds: [],
      targetInstalledPlugins: new Set(),
      sourceRequiredPlugins: new Set(["plugin-required"]),
      knownFeatureDegradations: [],
    });
    expect(report.verdict).toBe("BLOCKED");
    expect(report.unsupportedPlugins).toEqual(["plugin-required"]);
  });
});

describe("executeMigration", () => {
  const safeDryRun = planMigrationDryRun({
    route: "ANDROID_TO_ANDROID",
    sourceRecordCounts: {},
    targetExistingRecordIds: new Set(),
    sourceRecordIds: new Set(),
    targetSchemaVersion: "1.0.0",
    sourceSchemaVersion: "1.0.0",
    invalidCheckpointIds: [],
    targetInstalledPlugins: new Set(),
    sourceRequiredPlugins: new Set(),
    knownFeatureDegradations: [],
  });

  it("refuses to execute a migration whose dry run was BLOCKED", async () => {
    const blockedDryRun = { ...safeDryRun, verdict: "BLOCKED" as const };
    const result = await executeMigration({
      dryRun: blockedDryRun,
      applyFn: async () => {},
      rollbackFn: async () => {},
    });
    expect(result.status).toBe("FAILED");
    expect(result.rollbackReason).toBe("DRY_RUN_NOT_SAFE_TO_PROCEED");
  });

  it("reports COMPLETED and preserved stable IDs when applyFn succeeds", async () => {
    const result = await executeMigration({
      dryRun: safeDryRun,
      applyFn: async () => {},
      rollbackFn: async () => {
        throw new Error("should never be called");
      },
    });
    expect(result.status).toBe("COMPLETED");
    expect(result.preservedStableIds).toBe(true);
  });

  it("rolls back and reports ROLLED_BACK, never leaving partial state, when applyFn throws", async () => {
    let rolledBack = false;
    const result = await executeMigration({
      dryRun: safeDryRun,
      applyFn: async () => {
        throw new Error("write failed midway");
      },
      rollbackFn: async () => {
        rolledBack = true;
      },
    });
    expect(rolledBack).toBe(true);
    expect(result.status).toBe("ROLLED_BACK");
    expect(result.rollbackReason).toContain("write failed midway");
  });

  it("if rollback itself fails, reports FAILED with both errors surfaced rather than swallowed", async () => {
    const result = await executeMigration({
      dryRun: safeDryRun,
      applyFn: async () => {
        throw new Error("apply broke");
      },
      rollbackFn: async () => {
        throw new Error("rollback also broke");
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.rollbackReason).toContain("apply broke");
    expect(result.rollbackReason).toContain("rollback also broke");
  });
});
