import type { DeviceInput } from "./api";

/** Best-effort browser device descriptor for registering the WEB device type. Never fabricated as a stronger identifier than it is. */
export function currentWebDevice(): DeviceInput {
  const platform = typeof navigator !== "undefined" ? navigator.platform || "unknown" : "unknown";
  return {
    type: "WEB",
    name: "Browser Console",
    platform,
    version: "0.1.0",
  };
}
