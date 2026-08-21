import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "@airdrop-os/database";
import { hashSecret, verifySecret, issueTokenPair, verifyRefreshToken } from "@airdrop-os/security";
import { buildNewDeviceRecord } from "@airdrop-os/identity";
import { formatAgentLabel } from "@airdrop-os/identity";
import { recordAudit } from "../audit.js";

interface RegisterBody {
  email: string;
  password: string;
  device: { type: "VPS" | "PC" | "ANDROID" | "WEB" | "CHROME_EXTENSION"; name: string; platform: string; version: string };
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

    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (existing) {
      reply.code(409);
      return { error: "account already exists" };
    }

    const passwordHash = await hashSecret(password);
    const [user] = await db.insert(schema.users).values({ email, passwordHash }).returning();

    // One persistent agent identity per user, independent of device.
    const label = formatAgentLabel(1);
    const [agent] = await db
      .insert(schema.agentIdentities)
      .values({ userId: user.id, label })
      .returning();

    const deviceRecord = buildNewDeviceRecord({ agentId: agent.id, ...device });
    const [createdDevice] = await db
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
      await db.insert(schema.devicePermissions).values({ deviceId: createdDevice.id, scope });
    }

    await recordAudit(db, {
      actorType: "USER",
      actorId: user.id,
      action: "user.register",
      targetType: "device",
      targetId: createdDevice.id,
    });

    reply.code(201);
    return { userId: user.id, agentId: agent.id, agentLabel: agent.label, deviceId: createdDevice.id, deviceStatus: createdDevice.status };
  });

  app.post<{ Body: LoginBody }>("/auth/login", async (req, reply) => {
    const { email, password, device } = req.body;
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
