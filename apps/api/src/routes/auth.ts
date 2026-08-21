import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { schema } from "@airdrop-os/database";
import { hashSecret, verifySecret, issueTokenPair, verifyRefreshToken } from "@airdrop-os/security";
import { buildNewDeviceRecord } from "@airdrop-os/identity";
import { formatAgentLabel } from "@airdrop-os/identity";
import { recordAudit } from "../audit.js";

const DEVICE_TYPES = ["VPS", "PC", "ANDROID", "WEB", "CHROME_EXTENSION"] as const;
type DeviceType = (typeof DEVICE_TYPES)[number];

interface RegisterBody {
  email: string;
  password: string;
  device: { type: "VPS" | "PC" | "ANDROID" | "WEB" | "CHROME_EXTENSION"; name: string; platform: string; version: string };
}

/**
 * Validates the `device` object on register/login bodies. Fastify's type
 * generics only guide TypeScript at compile time - they do nothing to
 * reject a malformed JSON body at runtime, so without this a missing or
 * wrong-typed field (e.g. no `device` at all, or `device.type` not in
 * the enum) sails through to the DB layer and surfaces as a raw 500 with
 * a leaked constraint/column name instead of a clean 400.
 */
function validateDevice(device: unknown): string | null {
  if (typeof device !== "object" || device === null) {
    return "device is required";
  }
  const d = device as Record<string, unknown>;
  if (typeof d.type !== "string" || !DEVICE_TYPES.includes(d.type as DeviceType)) {
    return `device.type is required and must be one of: ${DEVICE_TYPES.join(", ")}`;
  }
  if (typeof d.name !== "string" || d.name.trim().length === 0) {
    return "device.name is required";
  }
  if (typeof d.platform !== "string" || d.platform.trim().length === 0) {
    return "device.platform is required";
  }
  if (typeof d.version !== "string" || d.version.trim().length === 0) {
    return "device.version is required";
  }
  return null;
}

interface LoginBody {
  email: string;
  password: string;
  device: { type: "VPS" | "PC" | "ANDROID" | "WEB" | "CHROME_EXTENSION"; name: string; platform: string; version: string };
}

interface RefreshBody {
  refreshToken: string;
}

interface RevokeBody {
  refreshToken: string;
}

export async function authRoutes(app: FastifyInstance) {
  const { db, config } = app;

  app.post<{ Body: RegisterBody }>("/auth/register", async (req, reply) => {
    const { email, password, device } = req.body;
    if (!email || !password || password.length < 12) {
      reply.code(400);
      return { error: "email and a password of at least 12 characters are required" };
    }

    const deviceError = validateDevice(device);
    if (deviceError) {
      reply.code(400);
      return { error: deviceError };
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (existing) {
      reply.code(409);
      return { error: "account already exists" };
    }

    const passwordHash = await hashSecret(password);

    // The whole registration (user -> agent identity -> device -> device
    // permissions) runs as a single DB transaction. Previously these were
    // sequential, unwrapped inserts: a failure partway through (e.g. the
    // duplicate-label bug below, or a bad device payload) left an
    // orphaned user row with no agent identity and no way to log in or
    // re-register. Wrapping in db.transaction means any failure at any
    // step rolls back everything atomically - either the full account
    // exists or none of it does.
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.insert(schema.users).values({ email, passwordHash }).returning();

      // One persistent agent identity per user, independent of device.
      // The numeric suffix comes from a DB sequence (nextval), not a
      // hardcoded literal or a COUNT(*) read - a sequence is atomic and
      // race-safe under concurrent registrations, so two users can never
      // be assigned the same label (agent_identities_label_idx is a
      // unique index) even if their transactions overlap.
      const [{ nextval }] = await tx.execute<{ nextval: string }>(
        sql`select nextval('agent_label_seq') as nextval`,
      );
      const label = formatAgentLabel(Number(nextval));
      const [agent] = await tx
        .insert(schema.agentIdentities)
        .values({ userId: user.id, label })
        .returning();

      const deviceRecord = buildNewDeviceRecord({ agentId: agent.id, ...device });
      const [createdDevice] = await tx
        .insert(schema.devices)
        .values({
          agentId: agent.id,
          type: deviceRecord.type,
          name: deviceRecord.name,
          platform: deviceRecord.platform,
          version: deviceRecord.version,
          status: deviceRecord.status,
        })
        .returning();

      for (const scope of deviceRecord.permissions) {
        await tx.insert(schema.devicePermissions).values({ deviceId: createdDevice.id, scope });
      }

      await recordAudit(tx, {
        actorType: "USER",
        actorId: user.id,
        action: "user.register",
        targetType: "device",
        targetId: createdDevice.id,
      });

      return { user, agent, createdDevice };
    });

    const { user, agent, createdDevice } = result;
    reply.code(201);
    return { userId: user.id, agentId: agent.id, agentLabel: agent.label, deviceId: createdDevice.id, deviceStatus: createdDevice.status };
  });

  app.post<{ Body: LoginBody }>("/auth/login", async (req, reply) => {
    const { email, password, device } = req.body;
    const deviceError = validateDevice(device);
    if (deviceError) {
      reply.code(400);
      return { error: deviceError };
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user || !(await verifySecret(user.passwordHash, password))) {
      reply.code(401);
      return { error: "invalid credentials" };
    }

    const agent = await db.query.agentIdentities.findFirst({ where: eq(schema.agentIdentities.userId, user.id) });
    if (!agent) {
      reply.code(500);
      return { error: "agent identity missing for user" };
    }

    // Look up or register this device against the user's single agent identity.
    let existingDevice = await db.query.devices.findFirst({
      where: (d, { and, eq }) => and(eq(d.agentId, agent.id), eq(d.name, device.name), eq(d.type, device.type)),
    });

    if (!existingDevice) {
      const deviceRecord = buildNewDeviceRecord({ agentId: agent.id, ...device });
      [existingDevice] = await db
        .insert(schema.devices)
        .values({
          agentId: agent.id,
          type: deviceRecord.type,
          name: deviceRecord.name,
          platform: deviceRecord.platform,
          version: deviceRecord.version,
          status: deviceRecord.status,
        })
        .returning();
      for (const scope of deviceRecord.permissions) {
        await db.insert(schema.devicePermissions).values({ deviceId: existingDevice.id, scope });
      }
    }

    if (existingDevice.status === "REVOKED" || existingDevice.status === "SUSPENDED") {
      reply.code(403);
      return { error: `device is ${existingDevice.status.toLowerCase()}` };
    }

    const grants = await db.query.devicePermissions.findMany({
      where: (p, { and, eq, isNull }) => and(eq(p.deviceId, existingDevice!.id), isNull(p.revokedAt)),
    });
    const scope = grants.map((g) => g.scope);

    const pair = issueTokenPair({
      userId: user.id,
      agentId: agent.id,
      deviceId: existingDevice.id,
      scope,
      accessSecret: config.JWT_ACCESS_SECRET,
      refreshSecret: config.JWT_REFRESH_SECRET,
      accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlSeconds: config.REFRESH_TOKEN_TTL_SECONDS,
    });

    await db.insert(schema.sessions).values({
      userId: user.id,
      deviceId: existingDevice.id,
      accessTokenJti: pair.accessJti,
      expiresAt: new Date(pair.accessTokenExpiresAt),
    });

    const refreshTokenHash = await hashSecret(pair.refreshToken);
    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      deviceId: existingDevice.id,
      tokenHash: refreshTokenHash,
      family: pair.refreshFamily,
      expiresAt: new Date(pair.refreshTokenExpiresAt),
    });

    await db.update(schema.devices).set({ lastSeen: new Date(), updatedAt: new Date() }).where(eq(schema.devices.id, existingDevice.id));

    await recordAudit(db, { actorType: "USER", actorId: user.id, action: "user.login", targetType: "device", targetId: existingDevice.id });

    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessTokenExpiresAt: pair.accessTokenExpiresAt,
      refreshTokenExpiresAt: pair.refreshTokenExpiresAt,
      deviceId: existingDevice.id,
      deviceStatus: existingDevice.status,
      scope,
    };
  });

  // Refresh token rotation: every refresh consumes the old token and
  // issues a new one in the same family. If a token is reused after
  // rotation (replay), the whole family is revoked - this is the
  // standard refresh-token-reuse-detection pattern.
  app.post<{ Body: RefreshBody }>("/auth/refresh", async (req, reply) => {
    const { refreshToken } = req.body;
    let claims;
    try {
      claims = verifyRefreshToken(refreshToken, config.JWT_REFRESH_SECRET);
    } catch {
      reply.code(401);
      return { error: "invalid or expired refresh token" };
    }

    const stored = await db.query.refreshTokens.findFirst({
      where: (t, { and, eq }) => and(eq(t.family, claims!.family), eq(t.deviceId, claims!.deviceId)),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    if (!stored || stored.revokedAt) {
      reply.code(401);
      return { error: "refresh token family revoked" };
    }

    if (stored.rotatedAt) {
      // Reuse of an already-rotated token => revoke entire family, fail closed.
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.family, claims.family));
      await recordAudit(db, {
        actorType: "SYSTEM",
        actorId: "auth",
        action: "auth.refresh_token_reuse_detected",
        targetType: "device",
        targetId: claims.deviceId,
      });
      reply.code(401);
      return { error: "refresh token reuse detected; session revoked" };
    }

    const device = await db.query.devices.findFirst({ where: eq(schema.devices.id, claims.deviceId) });
    if (!device || device.status === "REVOKED" || device.status === "SUSPENDED") {
      reply.code(403);
      return { error: "device no longer authorized" };
    }

    const grants = await db.query.devicePermissions.findMany({
      where: (p, { and, eq, isNull }) => and(eq(p.deviceId, device.id), isNull(p.revokedAt)),
    });
    const scope = grants.map((g) => g.scope);

    const pair = issueTokenPair({
      userId: claims.sub,
      agentId: claims.agentId,
      deviceId: claims.deviceId,
      scope,
      accessSecret: config.JWT_ACCESS_SECRET,
      refreshSecret: config.JWT_REFRESH_SECRET,
      accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlSeconds: config.REFRESH_TOKEN_TTL_SECONDS,
      refreshFamily: claims.family,
    });

    await db.update(schema.refreshTokens).set({ rotatedAt: new Date() }).where(eq(schema.refreshTokens.id, stored.id));
    const newHash = await hashSecret(pair.refreshToken);
    await db.insert(schema.refreshTokens).values({
      userId: claims.sub,
      deviceId: claims.deviceId,
      tokenHash: newHash,
      family: pair.refreshFamily,
      expiresAt: new Date(pair.refreshTokenExpiresAt),
    });

    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessTokenExpiresAt: pair.accessTokenExpiresAt,
      refreshTokenExpiresAt: pair.refreshTokenExpiresAt,
      scope,
    };
  });

  app.post<{ Body: RevokeBody }>("/auth/revoke", async (req, reply) => {
    const { refreshToken } = req.body;
    let claims;
    try {
      claims = verifyRefreshToken(refreshToken, config.JWT_REFRESH_SECRET);
    } catch {
      reply.code(401);
      return { error: "invalid refresh token" };
    }
    await db.update(schema.refreshTokens).set({ revokedAt: new Date() }).where(eq(schema.refreshTokens.family, claims.family));
    await recordAudit(db, { actorType: "USER", actorId: claims.sub, action: "auth.revoke", targetType: "device", targetId: claims.deviceId });
    return { revoked: true };
  });
}
