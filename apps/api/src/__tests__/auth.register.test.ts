import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDatabase, schema, type Database } from "@airdrop-os/database";
import { buildApp } from "../app.js";

/**
 * These are regression tests for two Phase 1 bugs that were only caught
 * by exercising /auth/register and /auth/login against a real Postgres
 * instance (unit tests with a mocked db did not catch them):
 *
 *  1. /auth/register ran as sequential, unwrapped inserts. A failure
 *     partway through (e.g. the label collision below) left an orphaned
 *     `users` row with no agent identity - unrecoverable, since the user
 *     could neither log in (agent identity missing) nor re-register
 *     (email already taken).
 *  2. The agent label was hardcoded to formatAgentLabel(1), so the
 *     second real registration always hit a 500 from the unique index
 *     on agent_identities.label.
 *
 * A real (not mocked) test database is used because both bugs are about
 * actual transactional/constraint behavior - a mocked db object cannot
 * exercise "does the DB actually roll back" or "does the unique index
 * actually collide".
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://airdrop_os:change-me@localhost:5432/airdrop_os_test";
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

let app: FastifyInstance;
let db: Database;
let rawSql: ReturnType<typeof createDatabase>["sql"];

const testDevice = {
  type: "PC" as const,
  name: "test-device",
  platform: "linux",
  version: "1.0.0",
};

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

beforeAll(async () => {
  app = await buildApp({
    config: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      JWT_ACCESS_SECRET: "a".repeat(64),
      JWT_REFRESH_SECRET: "b".repeat(64),
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 2592000,
      API_HOST: "0.0.0.0",
      API_PORT: 0,
      RATE_LIMIT_MAX: 10_000,
      RATE_LIMIT_WINDOW_MS: 60_000,
    },
  });
  db = app.db;
  const created = createDatabase(TEST_DATABASE_URL);
  rawSql = created.sql;
});

afterAll(async () => {
  await app.close();
  await rawSql.end();
});

beforeEach(async () => {
  // Isolate each test: wipe everything the register flow touches. Order
  // matters for FK constraints (children before parents).
  await db.execute(sql`delete from device_permissions`);
  await db.execute(sql`delete from devices`);
  await db.execute(sql`delete from agent_identities`);
  await db.execute(sql`delete from audit_logs`);
  await db.execute(sql`delete from users`);
});

describe("POST /auth/register - agent label uniqueness", () => {
  it("assigns distinct agent labels across two sequential registrations", async () => {
    const emailA = uniqueEmail("userA");
    const emailB = uniqueEmail("userB");

    const resA = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: emailA, password: "correct-horse-battery", device: testDevice },
    });
    const resB = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: emailB, password: "correct-horse-battery", device: testDevice },
    });

    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);

    const bodyA = resA.json();
    const bodyB = resB.json();

    // The core regression: previously the second registration either
    // reused label "AIRDROP-USER-001" (hardcoded) and 500'd on the
    // unique index, or (post a naive COUNT(*)+1 fix) could race under
    // concurrency. Here we just assert the functional outcome: two
    // successful registrations never share a label.
    expect(bodyA.agentLabel).toBeTruthy();
    expect(bodyB.agentLabel).toBeTruthy();
    expect(bodyA.agentLabel).not.toBe(bodyB.agentLabel);

    const labels = await db.query.agentIdentities.findMany();
    const distinctLabels = new Set(labels.map((l) => l.label));
    expect(distinctLabels.size).toBe(labels.length);
  });

  it("does not leave a partial user/agent/device behind when the agent insert fails", async () => {
    // Pre-insert a row that collides with whatever label the NEXT
    // registration's nextval('agent_label_seq') call will produce, to
    // force the agent-identity insert to fail *inside* the transaction,
    // after the user row has already been inserted. This reproduces
    // Bug 1's failure mode directly (partial failure after the first
    // insert) rather than only its label-collision trigger (Bug 2).
    const [{ next_val: nextVal }] = await db.execute<{ next_val: string }>(
      sql`select last_value + case when is_called then 1 else 0 end as next_val from agent_label_seq`,
    );
    const collidingLabel = `AIRDROP-USER-${String(nextVal).padStart(3, "0")}`;

    const fillerEmail = uniqueEmail("filler");
    const [fillerUser] = await db
      .insert(schema.users)
      .values({ email: fillerEmail, passwordHash: "not-a-real-hash" })
      .returning();
    await db.insert(schema.agentIdentities).values({ userId: fillerUser.id, label: collidingLabel });

    const targetEmail = uniqueEmail("shouldNotPersist");
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: targetEmail, password: "correct-horse-battery", device: testDevice },
    });

    // The registration must fail (label collision from the setup above)...
    expect(res.statusCode).toBe(500);

    // ...and critically, must NOT leave an orphaned `users` row behind.
    // Before the transaction fix, this row would exist here with no
    // matching agent_identities row - a permanently broken account.
    const orphan = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, targetEmail),
    });
    expect(orphan).toBeUndefined();
  });

  it("returns 400 (not 500) for a malformed device object", async () => {
    const email = uniqueEmail("malformed");
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "correct-horse-battery", device: { type: "PC" } },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toMatch(/device/i);

    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    expect(user).toBeUndefined();
  });
});
