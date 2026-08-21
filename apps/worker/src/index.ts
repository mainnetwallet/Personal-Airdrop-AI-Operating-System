import { Queue, Worker } from "bullmq";
import { loadConfig } from "@airdrop-os/config";

/**
 * Phase 1 foundation: establishes the BullMQ connection and a
 * placeholder queue/worker pair so the queue infrastructure is proven
 * end-to-end. Real job types (research, monitoring, workflow execution)
 * are added starting Phase 2 (Agent OS Kernel) - NOT_CONFIGURED here.
 */
const config = loadConfig();
const connection = { url: config.REDIS_URL };

export const foundationQueue = new Queue("foundation-heartbeat", { connection: { url: config.REDIS_URL } as any });

export function startFoundationWorker() {
  return new Worker(
    "foundation-heartbeat",
    async (job) => {
      return { receivedAt: new Date().toISOString(), jobName: job.name };
    },
    { connection: { url: config.REDIS_URL } as any }
  );
}

if (process.env.NODE_ENV !== "test") {
  const worker = startFoundationWorker();
  worker.on("completed", (job) => console.log(`[worker] heartbeat job ${job.id} completed`));
  console.log("Worker started. Job types beyond the foundation heartbeat are NOT_CONFIGURED until Phase 2.");
}
