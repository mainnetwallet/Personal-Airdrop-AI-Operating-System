import { describe, it, expect } from "vitest";
import { reconcile } from "../chain/reconciliation.js";

describe("reconciliation", () => {
  it("reports MATCH when all sources agree", () => {
    const result = reconcile({
      chain: "ETHEREUM",
      subject: "0xhash:finality",
      sources: [
        { sourceType: "PRIMARY_RPC", value: "CONFIRMED" },
        { sourceType: "BACKUP_RPC", value: "CONFIRMED" },
        { sourceType: "EXPLORER", value: "CONFIRMED" },
      ],
    });
    expect(result.status).toBe("MATCH");
  });

  it("requires ALL sources to agree - one dissenter forces RECONCILIATION_REQUIRED", () => {
    const result = reconcile({
      chain: "ETHEREUM",
      subject: "0xhash:finality",
      sources: [
        { sourceType: "PRIMARY_RPC", value: "CONFIRMED" },
        { sourceType: "BACKUP_RPC", value: "CONFIRMED" },
        { sourceType: "INDEXER", value: "REORGED" },
      ],
    });
    expect(result.status).toBe("RECONCILIATION_REQUIRED");
  });
});
