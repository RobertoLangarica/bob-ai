/**
 * EventStore — Persistence layer for activity events, chat messages, and metrics.
 *
 * V0 implementation: In-memory with localStorage persistence.
 * When Tauri + SQLite is available, swap this implementation for a real
 * SQLite backend — the interface stays the same.
 */

import type { ActivityEvent, EventVisibility } from '../types/events'
import type { ChatMessage, AgentMetric } from '../types/config'

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export interface EventQueryOptions {
  teamId?: string
  type?: string
  visibility?: EventVisibility | EventVisibility[]
  since?: number
  until?: number
  limit?: number
  offset?: number
}

export interface MessageQueryOptions {
  teamId?: string
  since?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// EventStore interface (for future backend swaps)
// ---------------------------------------------------------------------------

export interface IEventStore {
  // Events
  insertEvent(event: ActivityEvent): void
  queryEvents(opts: EventQueryOptions): ActivityEvent[]
  getEventsByTeam(teamId: string, visibility?: EventVisibility[]): ActivityEvent[]
  countEventsByType(teamId: string): Record<string, number>

  // Messages
  insertMessage(message: ChatMessage): void
  getMessages(teamId: string, limit?: number): ChatMessage[]

  // Metrics
  insertMetric(metric: AgentMetric): void
  getAgentMetrics(teamId: string, agentId?: string): AgentMetric[]

  // Lifecycle
  clear(): void
}

// ---------------------------------------------------------------------------
// In-memory EventStore (V0 implementation)
// ---------------------------------------------------------------------------

const STORAGE_KEY_EVENTS = 'bob-ai:events'
const STORAGE_KEY_MESSAGES = 'bob-ai:messages'
const STORAGE_KEY_METRICS = 'bob-ai:metrics'

export class EventStore implements IEventStore {
  private events: ActivityEvent[] = []
  private messages: ChatMessage[] = []
  private metrics: AgentMetric[] = []
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly persistToStorage = true) {
    if (this.persistToStorage) {
      this.loadFromStorage()
    }
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  insertEvent(event: ActivityEvent): void {
    this.events.push(event)
    this.schedulePersist()
  }

  queryEvents(opts: EventQueryOptions): ActivityEvent[] {
    let results = this.events

    if (opts.teamId) {
      results = results.filter((e) => e.teamId === opts.teamId)
    }

    if (opts.type) {
      // Support prefix matching: "tool.*" matches "tool.invoke", "tool.result"
      if (opts.type.endsWith('*')) {
        const prefix = opts.type.slice(0, -1)
        results = results.filter((e) => e.type.startsWith(prefix))
      } else {
        results = results.filter((e) => e.type === opts.type)
      }
    }

    if (opts.visibility) {
      const visibilities = Array.isArray(opts.visibility) ? opts.visibility : [opts.visibility]
      results = results.filter((e) => visibilities.includes(e.visibility))
    }

    if (opts.since) {
      results = results.filter((e) => e.timestamp >= opts.since!)
    }

    if (opts.until) {
      results = results.filter((e) => e.timestamp <= opts.until!)
    }

    // Sort by timestamp ascending
    results = results.sort((a, b) => a.timestamp - b.timestamp)

    if (opts.offset) {
      results = results.slice(opts.offset)
    }

    if (opts.limit) {
      results = results.slice(0, opts.limit)
    }

    return results
  }

  getEventsByTeam(teamId: string, visibility?: EventVisibility[]): ActivityEvent[] {
    return this.queryEvents({
      teamId,
      visibility: visibility as EventVisibility | EventVisibility[] | undefined,
    })
  }

  countEventsByType(teamId: string): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const event of this.events) {
      if (event.teamId === teamId) {
        counts[event.type] = (counts[event.type] || 0) + 1
      }
    }
    return counts
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  insertMessage(message: ChatMessage): void {
    this.messages.push(message)
    this.schedulePersist()
  }

  getMessages(teamId: string, limit?: number): ChatMessage[] {
    let results = this.messages
      .filter((m) => m.teamId === teamId)
      .sort((a, b) => a.timestamp - b.timestamp)

    if (limit) {
      results = results.slice(-limit)
    }

    return results
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  insertMetric(metric: AgentMetric): void {
    this.metrics.push(metric)
    this.schedulePersist()
  }

  getAgentMetrics(teamId: string, agentId?: string): AgentMetric[] {
    return this.metrics.filter((m) => m.teamId === teamId && (!agentId || m.agentId === agentId))
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  clear(): void {
    this.events = []
    this.messages = []
    this.metrics = []
    if (this.persistToStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY_EVENTS)
        localStorage.removeItem(STORAGE_KEY_MESSAGES)
        localStorage.removeItem(STORAGE_KEY_METRICS)
      } catch {
        // localStorage may not be available
      }
    }
  }

  /** Force immediate persist (useful before app close) */
  flush(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.persistNow()
  }

  // -------------------------------------------------------------------------
  // Persistence (localStorage for V0, SQLite when Tauri arrives)
  // -------------------------------------------------------------------------

  private schedulePersist(): void {
    if (!this.persistToStorage) return
    if (this.persistTimer) return // already scheduled
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persistNow()
    }, 500) // debounce: persist at most every 500ms
  }

  private persistNow(): void {
    if (!this.persistToStorage) return
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events))
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(this.messages))
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(this.metrics))
    } catch {
      // localStorage quota exceeded or not available — silent fail
      // In production, we'd use SQLite which doesn't have this problem
    }
  }

  private loadFromStorage(): void {
    try {
      const events = localStorage.getItem(STORAGE_KEY_EVENTS)
      const messages = localStorage.getItem(STORAGE_KEY_MESSAGES)
      const metrics = localStorage.getItem(STORAGE_KEY_METRICS)

      if (events) this.events = JSON.parse(events)
      if (messages) this.messages = JSON.parse(messages)
      if (metrics) this.metrics = JSON.parse(metrics)
    } catch {
      // Corrupted data — start fresh
      this.events = []
      this.messages = []
      this.metrics = []
    }
  }
}
