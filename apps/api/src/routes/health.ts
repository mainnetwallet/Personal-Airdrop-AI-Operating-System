import type { FastifyInstance } from "fastify";
import { checkLiveness, checkReadiness } from "../health.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => checkLiveness());

  app.get("/readiness", async (_req, reply) => {
    const report = await checkReadiness(app.db, app.redis);
    if (report.status !== "ok") {
      reply.code(503);
    }
    return report;
  });
}
