/**
 * In-process kernel event bus.
 *
 * Every event carries a monotonically increasing `sequence` (per bus
 * instance) so subscribers can detect gaps/reordering, plus
 * correlationId/causationId so a causal chain (e.g. tool call ->
 * approval request -> approval granted -> execution) can be
 * reconstructed after the fact from the durable `events` table.
 */
import { randomUUID } from "node:crypto";
import type { KernelEvent } from "@airdrop-os/types";

export type EventListener = (event: KernelEvent) => void;

export interface EmitEventInput {
  eventType: string;
  source: string;
  agentId?: string | null;
  deviceId?: string | null;
  correlationId?: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
}

const SCHEMA_VERSION = "1";

export class KernelEventBus {
  private sequence = 0;
  private readonly log: KernelEvent[] = [];
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly wildcardListeners = new Set<EventListener>();

  emit(input: EmitEventInput): KernelEvent {
    this.sequence += 1;
    const event: KernelEvent = {
      eventId: randomUUID(),
      eventType: input.eventType,
      timestamp: new Date().toISOString(),
      source: input.source,
      agentId: input.agentId ?? null,
      deviceId: input.deviceId ?? null,
      correlationId: input.correlationId ?? randomUUID(),
      causationId: input.causationId ?? null,
      schemaVersion: SCHEMA_VERSION,
      sequence: this.sequence,
      payload: input.payload ?? {},
    };
    this.log.push(event);

    for (const listener of this.listeners.get(event.eventType) ?? []) {
      listener(event);
    }
    for (const listener of this.wildcardListeners) {
      listener(event);
    }
    return event;
  }

  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => this.listeners.get(eventType)?.delete(listener);
  }

  onAny(listener: EventListener): () => void {
    this.wildcardListeners.add(listener);
    return () => this.wildcardListeners.delete(listener);
  }

  /** Full event log, in emission (and therefore causal-safe) order. */
  getLog(): readonly KernelEvent[] {
    return this.log;
  }

  /** All events sharing a correlationId, in emission order. */
  getCorrelated(correlationId: string): KernelEvent[] {
    return this.log.filter((e) => e.correlationId === correlationId);
  }
}
