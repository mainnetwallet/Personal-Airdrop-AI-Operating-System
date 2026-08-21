import { describe, it, expect } from "vitest";
import { ToolRegistry, DuplicateToolError, UnknownToolError } from "../toolRegistry.js";
import type { ToolDefinition } from "@airdrop-os/types";

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "http.get",
    description: "Fetch a URL",
    inputSchema: {},
    outputSchema: {},
    permission: "RESEARCH",
    risk: "LOW",
    supportedDevices: ["VPS", "PC"],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 2, backoffMs: 500 },
    auditEvent: true,
    requiresApproval: false,
    ...overrides,
  };
}

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool());
    expect(registry.has("http.get")).toBe(true);
    expect(registry.get("http.get").permission).toBe("RESEARCH");
  });

  it("throws on duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool());
    expect(() => registry.register(makeTool())).toThrow(DuplicateToolError);
  });

  it("throws on lookup of an unknown tool", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("nope")).toThrow(UnknownToolError);
  });

  it("lists all registered tools", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool({ name: "a" }));
    registry.register(makeTool({ name: "b" }));
    expect(registry.list().map((t) => t.name).sort()).toEqual(["a", "b"]);
  });

  it("checks device support correctly", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool({ name: "browser.click", supportedDevices: ["PC"] }));
    expect(registry.supportsDevice("browser.click", "PC")).toBe(true);
    expect(registry.supportsDevice("browser.click", "ANDROID")).toBe(false);
  });

  it("flags high-risk tools that require approval", () => {
    const registry = new ToolRegistry();
    registry.register(
      makeTool({
        name: "tx.prepare",
        permission: "TRANSACTION_PREPARE",
        risk: "HIGH",
        requiresApproval: true,
      })
    );
    expect(registry.get("tx.prepare").requiresApproval).toBe(true);
  });
});
