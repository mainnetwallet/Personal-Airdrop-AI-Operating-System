/**
 * Phase 3: the first real tool definitions registered into the Phase 2
 * ToolRegistry (previously empty). These are declarative metadata only
 * — per toolRegistry.ts, ToolDefinition carries no execution logic; the
 * kernel's callTool() only checks permission/device/run-limits against
 * it. Actual HTTP execution belongs to apps/worker (Phase 6+), invoked
 * only after the kernel has authorized the call.
 */
import type { ToolDefinition } from "@airdrop-os/types";

export const HTTP_FETCH_TOOL: ToolDefinition = {
  name: "source.http_fetch",
  description:
    "Retrieves raw content from a URL for the research pipeline's discover/retrieve step. Read-only: never submits forms, never bypasses CAPTCHA/KYC/2FA, never signs or transfers anything.",
  inputSchema: {
    type: "object",
    properties: { url: { type: "string" } },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      statusCode: { type: "number" },
      content: { type: "string" },
      retrievedAt: { type: "string" },
    },
  },
  permission: "RESEARCH",
  risk: "LOW",
  supportedDevices: ["VPS", "PC"],
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1_000 },
  auditEvent: true,
  requiresApproval: false,
};

export function registerResearchTools(registry: { register: (tool: ToolDefinition) => void }): void {
  registry.register(HTTP_FETCH_TOOL);
}
