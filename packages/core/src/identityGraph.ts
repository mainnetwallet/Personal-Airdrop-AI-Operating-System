/**
 * Identity graph: USER -> account edges (wallet, X, Discord, Telegram,
 * GitHub, quest, exchange, email, game).
 *
 * `associate()` never silently merges: if (accountType, accountRef) is
 * already linked to a *different* userId, it throws
 * ConflictingIdentityAssociationError rather than reassigning
 * ownership. A caller who has verified the reassignment is intentional
 * must explicitly call `reassociate()`, which requires acknowledging
 * the conflict it's resolving.
 */
import { randomUUID } from "node:crypto";
import type { AccountType, AssociationState, IdentityAssociation } from "@airdrop-os/types";

export class ConflictingIdentityAssociationError extends Error {
  constructor(
    public readonly accountType: AccountType,
    public readonly accountRef: string,
    public readonly existingUserId: string,
    public readonly attemptedUserId: string
  ) {
    super(
      `${accountType}:${accountRef} is already associated with user ${existingUserId}; refusing to silently reassign it to ${attemptedUserId}`
    );
    this.name = "ConflictingIdentityAssociationError";
  }
}

export class UnknownAssociationError extends Error {
  constructor(associationId: string) {
    super(`Unknown associationId: ${associationId}`);
    this.name = "UnknownAssociationError";
  }
}

export interface AssociateInput {
  userId: string;
  accountType: AccountType;
  accountRef: string;
  state: AssociationState;
}

// Association-state strength ordering, weakest to strongest. Used only
// to decide whether a repeated associate() call for the same
// (user, account) pair is an upgrade; it is never used to resolve a
// cross-user conflict.
const STATE_STRENGTH: Record<AssociationState, number> = {
  UNCERTAIN: 0,
  OBSERVED: 1,
  KNOWN: 2,
  USER_CONFIRMED: 3,
};

export class IdentityGraph {
  private readonly associations = new Map<string, IdentityAssociation>();

  private findByAccount(accountType: AccountType, accountRef: string): IdentityAssociation | undefined {
    return [...this.associations.values()].find(
      (a) => a.accountType === accountType && a.accountRef === accountRef
    );
  }

  /**
   * Links a userId to an account. If the account is already linked to
   * the same user, the association's state is upgraded (never
   * downgraded) rather than duplicated. If it's already linked to a
   * different user, throws instead of merging.
   */
  associate(input: AssociateInput): IdentityAssociation {
    const existing = this.findByAccount(input.accountType, input.accountRef);
    if (existing && existing.userId !== input.userId) {
      throw new ConflictingIdentityAssociationError(
        input.accountType,
        input.accountRef,
        existing.userId,
        input.userId
      );
    }
    if (existing) {
      if (STATE_STRENGTH[input.state] > STATE_STRENGTH[existing.state]) {
        existing.state = input.state;
        existing.updatedAt = new Date().toISOString();
      }
      return existing;
    }
    const now = new Date().toISOString();
    const association: IdentityAssociation = {
      associationId: randomUUID(),
      userId: input.userId,
      accountType: input.accountType,
      accountRef: input.accountRef,
      state: input.state,
      createdAt: now,
      updatedAt: now,
    };
    this.associations.set(association.associationId, association);
    return association;
  }

  /**
   * Explicitly reassigns an account to a different user, acknowledging
   * the conflict rather than hitting it silently. The caller must pass
   * the userId it expects to be displacing, as a confirmation that
   * this is an intentional correction and not an accidental merge.
   */
  reassociate(accountType: AccountType, accountRef: string, expectedCurrentUserId: string, newUserId: string, state: AssociationState): IdentityAssociation {
    const existing = this.findByAccount(accountType, accountRef);
    if (!existing) {
      return this.associate({ userId: newUserId, accountType, accountRef, state });
    }
    if (existing.userId !== expectedCurrentUserId) {
      throw new ConflictingIdentityAssociationError(accountType, accountRef, existing.userId, newUserId);
    }
    existing.userId = newUserId;
    existing.state = state;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  get(associationId: string): IdentityAssociation {
    const association = this.associations.get(associationId);
    if (!association) throw new UnknownAssociationError(associationId);
    return association;
  }

  accountsFor(userId: string): IdentityAssociation[] {
    return [...this.associations.values()].filter((a) => a.userId === userId);
  }

  /** Normally at most one, but returns an array so an accidental multi-user link (which associate() should prevent) is still inspectable rather than silently hidden. */
  associationsForAccount(accountType: AccountType, accountRef: string): IdentityAssociation[] {
    return [...this.associations.values()].filter(
      (a) => a.accountType === accountType && a.accountRef === accountRef
    );
  }
}
