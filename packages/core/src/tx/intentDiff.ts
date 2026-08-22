import type { TxIntent, TxIntentDiffField, TxIntentDiffResult } from "@airdrop-os/types";

/**
 * Phase 7: Intent diff.
 *
 * Compares the intent the user/system originally expected against the
 * actual decoded action right before signing. Any material change on a
 * security-relevant field invalidates the approval - this is what
 * catches a swapped recipient/spender/chain injected between approval
 * and signing (e.g. via a compromised page or a malicious redirect).
 */

const FIELDS: Array<TxIntentDiffField["field"]> = [
  "action", "walletAddress", "chainId", "contractAddress", "recipient", "token", "amount", "spender",
];

function normalize(field: TxIntentDiffField["field"], value: string | number | null): string | null {
  if (value === null || value === undefined) return null;
  if (field === "walletAddress" || field === "contractAddress" || field === "recipient" || field === "spender" || field === "token") {
    return String(value).toLowerCase();
  }
  return String(value);
}

export function diffIntent(expected: TxIntent, actual: TxIntent): TxIntentDiffResult {
  const fields: TxIntentDiffField[] = FIELDS.map((field) => {
    const expectedRaw = field === "chainId" ? expected.chainId : (expected as unknown as Record<string, string | null>)[field];
    const actualRaw = field === "chainId" ? actual.chainId : (actual as unknown as Record<string, string | null>)[field];
    const expectedVal = normalize(field, expectedRaw as string | number | null);
    const actualVal = normalize(field, actualRaw as string | number | null);
    return {
      field,
      expected: expectedVal,
      actual: actualVal,
      materialChange: expectedVal !== actualVal,
    };
  });

  return {
    intentHash: expected.intentHash,
    fields,
    hasMaterialChange: fields.some((f) => f.materialChange),
    evaluatedAt: new Date().toISOString(),
  };
}
