import { randomUUID } from "node:crypto";
import type { KernelEvent } from "@airdrop-os/types";

export const EVENT_SCHEMA_VERSION = 1;

export interface PublishEventInput {
  eventId?: string;
  eventType: string;
  source: string;
  agentId?: string | null;
  deviceId?: string | null;
  correlationId?: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
}

export type EventHandler = (event: KernelEvent) => void | Promise<void>;

/**
 * In-memory event bus for the Agent OS Kernel.
 *
 * - Every event carries a correlationId (shared across a causal chain)
 *   and an optional causationId (the eventId that directly caused it),
 *   so a full chain of "why did this happen" can be reconstructed.
 * - publish() is idempotent by eventId: publishing the same eventId
 *   twice appends it to history only once and does not re-notify
 *   subscribers, so retried publishes cannot duplicate side effects.
 * - Subscribers are invoked in registration order; a throwing
 *   subscriber does not prevent other subscribers from running.
 */
export class KernelEventBus {
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly wildcardHandlers: EventHandler[] = [];
  private readonly seenEventIds = new Set<string>();
  private readonly _history: KernelEvent[] = [];

  get history(): readonly KernelEvent[] {
    return this._history;
  }

  subscribe(eventType: string | "*", handler: EventHandler): () => void {
    if (eventType === "*") {
      this.wildcardHandlers.push(handler);
      return () => {
        const idx = this.wildcardHandlers.indexOf(handler);
        if (idx >= 0) this.wildcardHandlers.splice(idx, 1);
      };
    }
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  async publish(input: PublishEventInput): Promise<KernelEvent> {
    const eventId = input.eventId ?? randomUUID();

    const event: KernelEvent = {
      eventId,
      eventType: input.eventType,
      timestamp: new Date().toISOString(),
      source: input.source,
      agentId: input.agentId ?? null,
      deviceId: input.deviceId ?? null,
      correlationId: input.correlationId ?? eventId,
      causationId: input.causationId ?? null,
      schemaVersion: EVENT_SCHEMA_VERSION,
      payload: input.payload ?? {},
    };

    if (this.seenEventIds.has(eventId)) {
      // Idempotent replay: return the already-recorded event unchanged.
      return this._history.find((e) => e.eventId === eventId) ?? event;
    }
    this.seenEventIds.add(eventId);
    this._history.push(event);

    const handlers = [...(this.handlers.get(event.eventType) ?? []), ...this.wildcardHandlers];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // A misbehaving subscriber must never stop delivery to the rest
        // of the subscribers, or break the publisher's control flow.
        console.error(`[kernel-event-bus] handler error for "${event.eventType}":`, err);
      }
    }
    return event;
  }

  /** All events sharing a correlationId, in publish order. */
  chain(correlationId: string): KernelEvent[] {
    return this._history.filter((e) => e.correlationId === correlationId);
  }
}
