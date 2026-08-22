/**
 * Airdrop adapter type classification.
 *
 * `classifyAirdropType` never throws and never guesses: any raw input
 * that doesn't exactly match a known AirdropType (after normalization)
 * resolves to UNKNOWN_AIRDROP_TYPE, which the adapter registry always
 * has a NOT_CONFIGURED stub for (see adapters/notConfiguredAdapter.ts).
 */
import type { AirdropType } from "@airdrop-os/types";

// Mirrors the AirdropType union in @airdrop-os/types exactly. Kept as a
// runtime array here (types are erased at runtime) so classification
// can validate against it.
export const AIRDROP_TYPES: readonly AirdropType[] = [
  "RETROACTIVE", "POINTS", "TESTNET", "MAINNET_USAGE", "HOLDER",
  "SNAPSHOT", "QUEST", "BOUNTY", "SOCIAL", "COMMUNITY", "DISCORD",
  "TELEGRAM", "GOVERNANCE", "NFT", "NFT_HOLDER", "DEFI", "LENDING",
  "BORROWING", "LIQUIDITY", "BRIDGE", "SWAP", "STAKING", "RESTAKING",
  "PERPETUALS", "TRADING", "PREDICTION_MARKET", "PAYMENTS", "WALLET",
  "L2", "L3", "APPCHAIN", "MODULAR", "DATA_AVAILABILITY",
  "INTEROPERABILITY", "CROSS_CHAIN", "ORACLE", "DEPIN", "AI", "GPU",
  "COMPUTE", "STORAGE", "BANDWIDTH", "MOBILE_NETWORK", "GAMING",
  "GAMEFI", "METAVERSE", "CREATOR", "CONTENT", "REFERRAL",
  "DEVELOPER", "GITHUB", "CODE_CONTRIBUTION", "BUG_REPORT",
  "FEEDBACK", "AMBASSADOR", "COMMUNITY_CONTRIBUTOR", "TRANSLATION",
  "EDUCATION", "PARTNERSHIP", "ECOSYSTEM", "INFRASTRUCTURE",
  "EARLY_ADOPTER", "USER_GROWTH", "TIERED", "RAFFLE", "LOYALTY",
  "SEASONAL", "EPOCH", "CAMPAIGN", "SNAPSHOT_BASED", "CLAIM_ONLY",
  "SPECULATIVE_PRE_TGE", "WAITLIST", "BETA", "EARLY_ACCESS",
  "LEARN_TO_EARN", "EXCHANGE_CAMPAIGN", "COMMUNITY_ACCOUNT",
  "EMAIL_CAMPAIGN", "UNKNOWN_AIRDROP_TYPE",
];

const KNOWN = new Set<string>(AIRDROP_TYPES);

/**
 * Normalizes free-form input (spaces/dashes -> underscores, upper-cased)
 * and checks it against the known taxonomy. Falls back to
 * UNKNOWN_AIRDROP_TYPE for null/empty/unrecognized input.
 */
export function classifyAirdropType(raw: string | null | undefined): AirdropType {
  if (!raw || !raw.trim()) return "UNKNOWN_AIRDROP_TYPE";
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return KNOWN.has(normalized) ? (normalized as AirdropType) : "UNKNOWN_AIRDROP_TYPE";
}
