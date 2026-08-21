/**
 * Tool registry. Tools are declared once, with the permission scope and
 * risk level required to invoke them; the kernel consults this registry
 * on every tool call so a tool can never be invoked with a permission it
 * wasn't declared to need (see kernel.ts checkPermission).
 */
import type { DeviceType, ToolDefinition } from "@airdrop-os/types";

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

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  supportsDevice(name: string, device: DeviceType): boolean {
    return this.get(name).supportedDevices.includes(device);
  }
}
