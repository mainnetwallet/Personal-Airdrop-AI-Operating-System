/**
 * A single persistent Agent Identity (e.g. "AIRDROP-USER-001") that is
 * independent of any VPS, IP, hostname, browser, or device. Every device
 * a user connects (VPS/PC/Android/Web/Extension) attaches to the SAME
 * agent identity rather than creating a new one.
 */
export function formatAgentLabel(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Agent sequence must be a positive integer");
  }
  return `AIRDROP-USER-${String(sequence).padStart(3, "0")}`;
}
