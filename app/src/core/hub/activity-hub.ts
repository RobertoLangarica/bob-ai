/**
 * ActivityHub — The central nervous system of bob-ai.
 *
 * Every agent action flows through this hub as a structured event.
 * The hub persists everything, assigns visibility, aggregates noisy events,
 * and pushes relevant events to subscribers (UI, logging, etc.).
 *
 * Agents emit → Hub stores + filters → Subscribers render
 */

import type { ActivityEvent, EventVisibility } from '../types/events'
import type { IEventStore, EventQueryOptions } from '../storage/event-store'
import { resolveVisibility } from './visibility-rules'
import type { VerbosityLevel } from './visibility-rules'
import { getVisibilityFilter } from './visibility-rules'
import { AggregationEngine } from './aggregation'

// ---------------------------------------------------------------------------
// Subscriber types
// ---------------------------------------------------------------------------

export type EventCallback = (event: ActivityEvent) => void
export type UnsubscribeFn = () => void

// ---------------------------------------------------------------------------
// ActivityHub
// ---------------------------------------------------------------------------

export class ActivityHub {
  private subscribers: Map<string, Set<EventCallback>> = new Map()
  private aggregation: AggregationEngine
  private visibilityRules: Record<string, EventVisibility>

  constructor(
    private readonly store: IEventStore,
    visibilityRules?: Record<string, EventVisibility>,
  ) {
    this.visibilityRules = visibilityRules ?? {}

    // Aggregation engine flushes batched events to subscribers
    this.aggregation = new AggregationEngine((event) => {
      if (event) {
        this.notifySubscribers(event)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Emit — the write path (called by agents)
  // -------------------------------------------------------------------------

  /**
   * Emit an event to the hub. The event gets:
   * 1. Assigned a UUID and timestamp
   * 2. Assigned visibility based on type rules
   * 3. Persisted to the event store (always)
   * 4. Passed through aggregation
   * 5. Published to matching subscribers
   */
  emit(
    teamId: string,
    agentId: string,
    type: string,
    payload: Record<string, unknown>,
  ): ActivityEvent {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      teamId,
      agentId,
      type,
      payload,
      visibility: resolveVisibility(type, this.visibilityRules),
    }

    // 1. Always persist (individual events are never lost)
    this.store.insertEvent(event)

    // 2. Pass through aggregation engine
    const aggregated = this.aggregation.process(event)

    // 3. If aggregation returned an event, publish it immediately.
    //    If null, event was buffered (will be published later via flush callback).
    if (aggregated) {
      this.notifySubscribers(aggregated)
    }

    return event
  }

  /**
   * Emit a pre-built event (useful for replaying or testing).
   */
  emitRaw(event: ActivityEvent): void {
    this.store.insertEvent(event)
    const aggregated = this.aggregation.process(event)
    if (aggregated) {
      this.notifySubscribers(aggregated)
    }
  }

  // -------------------------------------------------------------------------
  // Subscribe — the real-time path (called by UI)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events matching a filter.
   *
   * Filter can be:
   * - "*" — all events
   * - "timeline" — events with timeline visibility
   * - "activity" — events with activity visibility
   * - "tool.*" — events with type prefix "tool."
   * - A specific type: "milestone.achieved"
   *
   * Returns an unsubscribe function.
   */
  subscribe(filter: string, callback: EventCallback): UnsubscribeFn {
    if (!this.subscribers.has(filter)) {
      this.subscribers.set(filter, new Set())
    }
    this.subscribers.get(filter)!.add(callback)

    return () => {
      this.subscribers.get(filter)?.delete(callback)
      // Clean up empty filter sets
      if (this.subscribers.get(filter)?.size === 0) {
        this.subscribers.delete(filter)
      }
    }
  }

  /**
   * Subscribe to events for a specific team with a verbosity filter.
   * Convenience method that combines team filtering + visibility filtering.
   */
  subscribeToTeam(
    teamId: string,
    verbosity: VerbosityLevel,
    callback: EventCallback,
  ): UnsubscribeFn {
    const visibilities = getVisibilityFilter(verbosity)

    return this.subscribe('*', (event) => {
      if (event.teamId === teamId && visibilities.includes(event.visibility)) {
        callback(event)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Query — the history path (called by UI for initial load)
  // -------------------------------------------------------------------------

  /**
   * Query historical events from the store.
   */
  query(opts: EventQueryOptions): ActivityEvent[] {
    return this.store.queryEvents(opts)
  }

  /**
   * Get timeline events for a team (visibility: "timeline").
   */
  getTimelineEvents(teamId: string): ActivityEvent[] {
    return this.store.queryEvents({
      teamId,
      visibility: 'timeline',
    })
  }

  /**
   * Get all visible events for a team at a given verbosity level.
   */
  getVisibleEvents(teamId: string, verbosity: VerbosityLevel): ActivityEvent[] {
    const visibilities = getVisibilityFilter(verbosity)
    return this.store.queryEvents({
      teamId,
      visibility: visibilities,
    })
  }

  /**
   * Get event count summary by type for a team.
   */
  getEventCounts(teamId: string): Record<string, number> {
    return this.store.countEventsByType(teamId)
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Flush aggregation buffers (call before shutdown).
   */
  flush(): void {
    this.aggregation.flushBuffer()
  }

  /**
   * Destroy the hub (clean up timers and subscriptions).
   */
  destroy(): void {
    this.aggregation.destroy()
    this.subscribers.clear()
  }

  // -------------------------------------------------------------------------
  // Internal: notification dispatch
  // -------------------------------------------------------------------------

  private notifySubscribers(event: ActivityEvent): void {
    for (const [filter, callbacks] of this.subscribers) {
      if (this.matchesFilter(event, filter)) {
        for (const cb of callbacks) {
          try {
            cb(event)
          } catch (err) {
            console.error('[ActivityHub] Subscriber error:', err)
          }
        }
      }
    }
  }

  private matchesFilter(event: ActivityEvent, filter: string): boolean {
    // Wildcard: match everything
    if (filter === '*') return true

    // Visibility level match
    if (filter === event.visibility) return true

    // Type prefix match: "tool.*" matches "tool.invoke", "tool.result"
    if (filter.endsWith('*')) {
      const prefix = filter.slice(0, -1)
      return event.type.startsWith(prefix)
    }

    // Exact type match
    if (filter === event.type) return true

    return false
  }
}
