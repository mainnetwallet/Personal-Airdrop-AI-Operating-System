import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type AccessTokenClaims } from "@airdrop-os/security";

declare module "fastify" {
  interface FastifyRequest {
    authClaims?: AccessTokenClaims;
  }
}

/**
 * Fastify preHandler factory: verifies the bearer access token and,
 * if `requiredScope` is given, enforces that the token's scope includes
 * it. Fails closed - any missing/invalid/expired token or insufficient
 * scope returns 401/403 rather than proceeding.
 */
export function requireAuth(app: FastifyInstance, requiredScope?: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.code(401);
      throw new Error("missing bearer token");
    }
    const token = header.slice("Bearer ".length);
    let claims: AccessTokenClaims;
    try {
      claims = verifyAccessToken(token, app.config.JWT_ACCESS_SECRET);
    } catch {
      reply.code(401);
      throw new Error("invalid or expired access token");
    }
    if (requiredScope && !claims.scope.includes(requiredScope)) {
      reply.code(403);
      throw new Error(`missing required scope: ${requiredScope}`);
    }
    req.authClaims = claims;
  };
}
