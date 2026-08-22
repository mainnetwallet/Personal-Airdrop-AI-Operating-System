import { describe, it, expect } from "vitest";
import { checkDomain, checkRedirectChain } from "../tx/domainProtection.js";

const OFFICIAL = ["official-airdrop.io"];

describe("checkDomain", () => {
  it("treats the official domain as SAFE", () => {
    const result = checkDomain("official-airdrop.io", OFFICIAL);
    expect(result.isOfficial).toBe(true);
    expect(result.verdict).toBe("SAFE");
  });

  it("treats a subdomain of the official domain as SAFE", () => {
    const result = checkDomain("app.official-airdrop.io", OFFICIAL);
    expect(result.isOfficial).toBe(true);
  });

  it("flags typosquatting via close edit distance", () => {
    const result = checkDomain("offical-airdrop.io", OFFICIAL);
    expect(result.signals).toContain("TYPOSQUATTING");
    expect(result.verdict).toBe("BLOCK");
  });

  it("flags a fake subdomain trick (official name embedded in an unrelated domain)", () => {
    const result = checkDomain("official-airdrop.io.evil-claim.net", OFFICIAL);
    expect(result.signals).toContain("FAKE_SUBDOMAIN");
    expect(result.verdict).toBe("BLOCK");
  });

  it("flags Unicode homoglyph lookalikes", () => {
    // Cyrillic 'а' (U+0430) instead of Latin 'a'
    const spoofed = "offici\u0430l-airdrop.io";
    const result = checkDomain(spoofed, OFFICIAL);
    expect(result.signals).toContain("UNICODE_LOOKALIKE");
    expect(result.verdict).toBe("BLOCK");
  });

  it("flags known URL shorteners", () => {
    const result = checkDomain("bit.ly", OFFICIAL);
    expect(result.signals).toContain("URL_SHORTENER");
  });

  it("flags a completely unrelated domain as UNEXPECTED_DOMAIN / SUSPICIOUS", () => {
    const result = checkDomain("totally-unrelated-site.xyz", OFFICIAL);
    expect(result.signals).toContain("UNEXPECTED_DOMAIN");
    expect(result.verdict).toBe("SUSPICIOUS");
  });
});

describe("checkRedirectChain", () => {
  it("flags a redirect landing on a non-official domain as suspicious at minimum", () => {
    const result = checkRedirectChain("official-airdrop.io", "totally-unrelated-site.xyz", OFFICIAL);
    expect(result.signals).toContain("SUSPICIOUS_REDIRECT");
    expect(result.verdict).not.toBe("SAFE");
  });

  it("does not flag a redirect that lands on the official domain", () => {
    const result = checkRedirectChain("bit.ly", "official-airdrop.io", OFFICIAL);
    expect(result.isOfficial).toBe(true);
  });
});
