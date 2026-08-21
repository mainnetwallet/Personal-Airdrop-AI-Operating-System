import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { TokenPair } from "@airdrop-os/types";

export interface AccessTokenClaims {
  sub: string; // userId
  agentId: string;
  deviceId: string;
  scope: string[];
  jti: string;
  type: "access";
}

export interface RefreshTokenClaims {
  sub: string;
  agentId: string;
  deviceId: string;
  jti: string;
  family: string; // rotation family id, for reuse detection
  type: "refresh";
}

export interface IssueTokensParams {
  userId: string;
  agentId: string;
  deviceId: string;
  scope: string[];
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  refreshFamily?: string;
}

/**
 * Issues a short-lived access token and a rotating refresh token, both
 * bound to a specific device. Each token carries a unique jti so it can
 * be individually revoked/blacklisted server-side.
 */
export function issueTokenPair(params: IssueTokensParams): TokenPair & {
  refreshFamily: string;
  accessJti: string;
  refreshJti: string;
} {
  const now = Math.floor(Date.now() / 1000);
  const accessJti = randomUUID();
  const refreshJti = randomUUID();
  const refreshFamily = params.refreshFamily ?? randomUUID();

  const accessToken = jwt.sign(
    {
      sub: params.userId,
      agentId: params.agentId,
      deviceId: params.deviceId,
      scope: params.scope,
      jti: accessJti,
      type: "access",
    } satisfies AccessTokenClaims,
    params.accessSecret,
    { expiresIn: params.accessTtlSeconds }
  );

  const refreshToken = jwt.sign(
    {
      sub: params.userId,
      agentId: params.agentId,
      deviceId: params.deviceId,
      jti: refreshJti,
      family: refreshFamily,
      type: "refresh",
    } satisfies RefreshTokenClaims,
    params.refreshSecret,
    { expiresIn: params.refreshTtlSeconds }
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date((now + params.accessTtlSeconds) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date((now + params.refreshTtlSeconds) * 1000).toISOString(),
    refreshFamily,
    accessJti,
    refreshJti,
  };
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims {
  const decoded = jwt.verify(token, secret) as AccessTokenClaims;
  if (decoded.type !== "access") throw new Error("Not an access token");
  return decoded;
}

export function verifyRefreshToken(token: string, secret: string): RefreshTokenClaims {
  const decoded = jwt.verify(token, secret) as RefreshTokenClaims;
  if (decoded.type !== "refresh") throw new Error("Not a refresh token");
  return decoded;
}
