import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  DuplicateToolError,
  UnknownToolError,
  PermissionDeniedError,
  ApprovalRequiredError,
  DeviceNotSupportedError,
} from "../toolRegistry.js";
import type { ToolDefinition } from "@airdrop-os/types";

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "research.fetch",
    description: "Fetch a public URL for research",
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

describe("tool registry", () => {
  it("registers and retrieves a tool", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool());
    expect(reg.get("research.fetch").permission).toBe("RESEARCH");
  });

  it("rejects duplicate registration", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool());
    expect(() => reg.register(makeTool())).toThrow(DuplicateToolError);
  });

  it("throws UnknownToolError for an unregistered tool", () => {
    const reg = new ToolRegistry();
    expect(() => reg.get("nope")).toThrow(UnknownToolError);
  });

  it("allows a call when the required permission is granted", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool());
    expect(() =>
      reg.assertCallAllowed({ toolName: "research.fetch", grantedPermissions: ["RESEARCH"] })
    ).not.toThrow();
  });

  it("denies a call when the required permission is missing", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool());
    expect(() =>
      reg.assertCallAllowed({ toolName: "research.fetch", grantedPermissions: ["READ"] })
    ).toThrow(PermissionDeniedError);
  });

  it("denies a call on an unsupported device", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool({ supportedDevices: ["VPS"] }));
    expect(() =>
      reg.assertCallAllowed({ toolName: "research.fetch", grantedPermissions: ["RESEARCH"], device: "ANDROID" })
    ).toThrow(DeviceNotSupportedError);
  });

  it("never auto-approves a TRANSACTION_APPROVAL tool - requires explicit approved:true", () => {
    const reg = new ToolRegistry();
    reg.register(
      makeTool({
        name: "wallet.sign",
        permission: "TRANSACTION_APPROVAL",
        supportedDevices: ["VPS"],
      })
    );
    expect(() =>
      reg.assertCallAllowed({
        toolName: "wallet.sign",
        grantedPermissions: ["TRANSACTION_APPROVAL"],
        device: "VPS",
      })
    ).toThrow(ApprovalRequiredError);

    expect(() =>
      reg.assertCallAllowed({
        toolName: "wallet.sign",
        grantedPermissions: ["TRANSACTION_APPROVAL"],
        device: "VPS",
        approved: true,
      })
    ).not.toThrow();
  });

  it("honors a tool-level requiresApproval flag even for lower-risk permissions", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool({ name: "account.link", requiresApproval: true }));
    expect(() =>
      reg.assertCallAllowed({ toolName: "account.link", grantedPermissions: ["RESEARCH"] })
    ).toThrow(ApprovalRequiredError);
  });
});
