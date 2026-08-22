import { randomUUID } from "node:crypto";
import type { ApprovalCheckResult, TxApproval } from "@airdrop-os/types";

/**
 * Phase 7: Approval binding.
 *
 * An approval binds a specific intent (by hash) to a full context:
 * project/campaign/mission/task/wallet/account/chain/contract, plus an
 * expiration. It can be checked exactly once for a given intent hash
 * (USED transitions it out of ACTIVE) - re-using an expired or already-
 * used approval always BLOCKs, never silently re-validates.
 */

export interface CreateApprovalInput {
  projectId?: string | null;
  campaignId?: string | null;
  missionId?: string | null;
  taskId?: string | null;
  walletAddress: string;
  accountId?: string | null;
  chainId: number;
  contractAddress?: string | null;
  intentHash: string;
  ttlMs: number;
}

export class ApprovalStore {
  private approvals = new Map<string, TxApproval>();

  create(input: CreateApprovalInput): TxApproval {
    const now = Date.now();
    const approval: TxApproval = {
      approvalId: randomUUID(),
      projectId: input.projectId ?? null,
      campaignId: input.campaignId ?? null,
      missionId: input.missionId ?? null,
      taskId: input.taskId ?? null,
      walletAddress: input.walletAddress,
      accountId: input.accountId ?? null,
      chainId: input.chainId,
      contractAddress: input.contractAddress ?? null,
      intentHash: input.intentHash,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + input.ttlMs).toISOString(),
      status: "ACTIVE",
      usedAt: null,
    };
    this.approvals.set(approval.approvalId, approval);
    return approval;
  }

  get(approvalId: string): TxApproval | null {
    return this.approvals.get(approvalId) ?? null;
  }

  revoke(approvalId: string): TxApproval | null {
    const approval = this.approvals.get(approvalId);
    if (!approval) return null;
    const updated: TxApproval = { ...approval, status: "REVOKED" };
    this.approvals.set(approvalId, updated);
    return updated;
  }

  /**
   * Checks and, if valid, consumes an approval for the given intent hash.
   * Never re-validates a used/expired/revoked approval, and never matches
   * an approval whose bound intent hash differs (a material intent change
   * always requires a fresh approval).
   */
  checkAndConsume(approvalId: string, intentHash: string, now: Date = new Date()): ApprovalCheckResult {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      return { ok: false, reason: "NOT_FOUND", detail: `No approval with id ${approvalId}` };
    }
    if (approval.intentHash !== intentHash) {
      return { ok: false, reason: "STALE_APPROVAL", detail: "Approval is bound to a different intent hash" };
    }
    if (approval.status !== "ACTIVE") {
      return { ok: false, reason: "STALE_APPROVAL", detail: `Approval status is ${approval.status}` };
    }
    if (new Date(approval.expiresAt).getTime() <= now.getTime()) {
      this.approvals.set(approvalId, { ...approval, status: "EXPIRED" });
      return { ok: false, reason: "STALE_APPROVAL", detail: "Approval has expired" };
    }
    this.approvals.set(approvalId, { ...approval, status: "USED", usedAt: now.toISOString() });
    return { ok: true };
  }
}
