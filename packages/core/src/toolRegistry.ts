import type { DeviceType, PermissionScope, ToolDefinition } from "@airdrop-os/types";

export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(`Tool already registered: ${name}`);
    this.name = "DuplicateToolError";
  }
}

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "UnknownToolError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(toolName: string, required: PermissionScope) {
    super(`Permission denied for tool "${toolName}": requires ${required}`);
    this.name = "PermissionDeniedError";
  }
}

export class ApprovalRequiredError extends Error {
  constructor(toolName: string) {
    super(`Tool "${toolName}" requires explicit human approval before it can run`);
    this.name = "ApprovalRequiredError";
  }
}

export class DeviceNotSupportedError extends Error {
  constructor(toolName: string, device: DeviceType) {
    super(`Tool "${toolName}" does not support device type ${device}`);
    this.name = "DeviceNotSupportedError";
  }
}

/**
 * Registry of tools available to the kernel, and the enforcement gate
 * every tool call must pass through.
 *
 * TRANSACTION_APPROVAL is never satisfied implicitly: a tool whose
 * permission is TRANSACTION_APPROVAL, or which sets requiresApproval,
 * only proceeds when the caller explicitly passes approved: true - the
 * kernel itself never grants signing authority on an agent's behalf.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new UnknownToolError(name);
    return tool;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  listForDevice(device: DeviceType): ToolDefinition[] {
    return this.list().filter((t) => t.supportedDevices.includes(device));
  }

  /**
   * Validates that a tool call is allowed. Throws rather than returning
   * a boolean so a caller cannot accidentally ignore a denial.
   */
  assertCallAllowed(input: {
    toolName: string;
    grantedPermissions: PermissionScope[];
    device?: DeviceType;
    approved?: boolean;
  }): ToolDefinition {
    const tool = this.get(input.toolName);

    if (input.device && !tool.supportedDevices.includes(input.device)) {
      throw new DeviceNotSupportedError(tool.name, input.device);
    }

    if (!input.grantedPermissions.includes(tool.permission)) {
      throw new PermissionDeniedError(tool.name, tool.permission);
    }

    const needsApproval = tool.requiresApproval || tool.permission === "TRANSACTION_APPROVAL";
    if (needsApproval && input.approved !== true) {
      throw new ApprovalRequiredError(tool.name);
    }

    return tool;
  }
}
