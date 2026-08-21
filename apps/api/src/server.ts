import { buildApp } from "./app.js";
import { loadConfig } from "@airdrop-os/config";

async function main() {
  const config = loadConfig();
  const app = await buildApp({ config });

  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
