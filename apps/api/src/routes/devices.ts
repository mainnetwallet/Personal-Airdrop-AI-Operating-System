import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { schema } from "@airdrop-os/database";
import { assertValidDeviceTransition, InvalidDeviceTransitionError } from "@airdrop-os/identity";
import { requireAuth } from "../plugins/authenticate.js";
import { recordAudit } from "../audit.js";

interface TransitionBody {
  deviceId: string;
  to: "PENDING" | "TRUSTED" | "LIMITED" | "SUSPENDED" | "REVOKED";
}

export async function deviceRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/devices", { preHandler: requireAuth(app) }, async (req) => {
    const auth = req.authClaims!;
    const devices = await db.query.devices.findMany({
      where: (d, { eq }) => eq(d.agentId, auth.agentId),
    });
    return { devices };
  });

  // Trust-state changes are permission-foundation only in Phase 1: only
  // an ADMIN-scoped session may promote/suspend/revoke a device, and
  // every transition is validated against the allowed state machine and
  // written to the audit log.
  app.post<{ Body: TransitionBody }>("/devices/transition", { preHandler: requireAuth(app, "ADMIN") }, async (req, reply) => {
    const auth = req.authClaims!;
    const { deviceId, to } = req.body;

    const device = await db.query.devices.findFirst({ where: eq(schema.devices.id, deviceId) });
    if (!device || device.agentId !== auth.agentId) {
      reply.code(404);
      return { error: "device not found" };
    }

    try {
      assertValidDeviceTransition(device.status, to);
    } catch (err) {
      if (err instanceof InvalidDeviceTransitionError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }

    await db.update(schema.devices).set({ status: to, updatedAt: new Date() }).where(eq(schema.devices.id, deviceId));

    if (to === "REVOKED") {
      // Revoking a device kills every active session/refresh token for it.
      await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.deviceId, deviceId));
      await db.update(schema.refreshTokens).set({ revokedAt: new Date() }).where(eq(schema.refreshTokens.deviceId, deviceId));
    }

    await recordAudit(db, {
      actorType: "USER",
      actorId: auth.sub,
      action: "device.transition",
      targetType: "device",
      targetId: deviceId,
      metadata: { from: device.status, to },
    });

    return { deviceId, status: to };
  });
}
