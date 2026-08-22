import { z } from "zod";

/**
 * Message contract between the content script (page context) and the
 * background service worker. This is the one piece of the extension that
 * is real logic rather than a chrome.* stub: it is what decides whether
 * an observation coming out of a web page is even shaped correctly
 * before it's handed to `@airdrop-os/core`'s `toSafeBrowserEvent`
 * (redaction happens downstream in core - this layer only validates
 * shape and rejects malformed messages, fail-closed).
 */

export const rawObservationMessageSchema = z.object({
  type: z.literal("OBSERVATION"),
  sessionId: z.string().min(1),
  url: z.string().url(),
  title: z.string().nullable(),
  eventType: z.enum(["NAVIGATION", "CLICK", "INPUT", "SUBMIT", "OBSERVATION"]),
  action: z.string().nullable(),
  elementMetadata: z.record(z.unknown()).nullable(),
  projectId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  missionId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  wallet: z.string().nullable().optional(),
  account: z.string().nullable().optional(),
  chain: z.string().nullable().optional(),
});
export type RawObservationMessage = z.infer<typeof rawObservationMessageSchema>;

export const teachControlMessageSchema = z.object({
  type: z.literal("TEACH_CONTROL"),
  sessionId: z.string().min(1),
  command: z.enum(["START", "STOP", "SAVE", "DISCARD"]),
});
export type TeachControlMessage = z.infer<typeof teachControlMessageSchema>;

export const extensionMessageSchema = z.discriminatedUnion("type", [
  rawObservationMessageSchema,
  teachControlMessageSchema,
]);
export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;

/** Fail-closed parse: an unrecognized or malformed message is rejected
 * rather than partially trusted. Returns null on any validation failure
 * so callers can drop the message instead of throwing across the
 * content-script/background boundary. */
export function parseExtensionMessage(input: unknown): ExtensionMessage | null {
  const result = extensionMessageSchema.safeParse(input);
  return result.success ? result.data : null;
}
