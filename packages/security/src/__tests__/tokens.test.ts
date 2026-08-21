import { describe, it, expect } from "vitest";
import { issueTokenPair, verifyAccessToken, verifyRefreshToken } from "../tokens.js";

const accessSecret = "a".repeat(32);
const refreshSecret = "b".repeat(32);

describe("token issuance", () => {
  it("issues device-bound access and refresh tokens", () => {
    const pair = issueTokenPair({
      userId: "user-1",
      agentId: "AIRDROP-USER-001",
      deviceId: "device-1",
      scope: ["READ"],
      accessSecret,
      refreshSecret,
      accessTtlSeconds: 900,
      refreshTtlSeconds: 2592000,
    });

    const access = verifyAccessToken(pair.accessToken, accessSecret);
    expect(access.deviceId).toBe("device-1");
    expect(access.type).toBe("access");

    const refresh = verifyRefreshToken(pair.refreshToken, refreshSecret);
    expect(refresh.deviceId).toBe("device-1");
    expect(refresh.family).toBe(pair.refreshFamily);
  });

  it("rejects an access token verified as a refresh token", () => {
    const pair = issueTokenPair({
      userId: "user-1",
      agentId: "AIRDROP-USER-001",
      deviceId: "device-1",
      scope: ["READ"],
      accessSecret,
      refreshSecret,
      accessTtlSeconds: 900,
      refreshTtlSeconds: 2592000,
    });
    expect(() => verifyRefreshToken(pair.accessToken, accessSecret)).toThrow();
  });
});
