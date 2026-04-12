/**
 * TimelineManager — Merges chat messages + activity events into a unified timeline.
 *
 * The timeline is the user's primary view of what's happening. It interleaves
 * BoB's messages with agent activity events, sorted by timestamp. The manager
 * supports both initial load (query) and real-time streaming (subscribe).
 */

import type { ActivityEvent, EventVisibility } from '../types/events'
import type { ChatMessage } from '../types/config'
import type { ActivityHub, UnsubscribeFn } from '../hub/activity-hub'
import type { IEventStore } from '../storage/event-store'
import { getVisibilityFilter, type VerbosityLevel } from '../hub/visibility-rules'

// ---------------------------------------------------------------------------
// Timeline item — the unified type the UI renders
// ---------------------------------------------------------------------------

export type TimelineItemKind = 'message' | 'event'

export interface TimelineItem {
  /** Unique ID (from the source message or event) */
  id: string
  /** Whether this is a chat message or an activity event */
  kind: TimelineItemKind
  /** Timestamp for sorting */
  timestamp: number
  /** The original chat message (if kind === 'message') */
  message?: ChatMessage
  /** The original activity event (if kind === 'event') */
  event?: ActivityEvent
}

// ---------------------------------------------------------------------------
// TimelineManager
// ---------------------------------------------------------------------------

export class TimelineManager {
  private unsubscribers: UnsubscribeFn[] = []

  constructor(
    private readonly hub: ActivityHub,
    private readonly eventStore: IEventStore,
  ) {}

  /**
   * Load the timeline for a team — merges messages + events, sorted by timestamp.
   * Uses pagination: returns the most recent `limit` items.
   */
  loadTimeline(teamId: string, verbosity: VerbosityLevel, limit = 200): TimelineItem[] {
    // Get messages
    const messages = this.eventStore.getMessages(teamId)
    const messageItems: TimelineItem[] = messages.map((m) => ({
      id: m.id,
      kind: 'message' as const,
      timestamp: m.timestamp,
      message: m,
    }))

    // Get events at the requested verbosity
    const visibilities = getVisibilityFilter(verbosity)
    const events = this.eventStore.queryEvents({
      teamId,
      visibility: visibilities,
    })
    const eventItems: TimelineItem[] = events.map((e) => ({
      id: e.id,
      kind: 'event' as const,
      timestamp: e.timestamp,
      event: e,
    }))

    // Merge and sort by timestamp
    const all = [...messageItems, ...eventItems].sort((a, b) => a.timestamp - b.timestamp)

    // Return the most recent `limit` items
    if (all.length > limit) {
      return all.slice(-limit)
    }
    return all
  }

  /**
   * Load older items before a given timestamp (for "load more" pagination).
   */
  loadOlder(
    teamId: string,
    verbosity: VerbosityLevel,
    beforeTimestamp: number,
    limit = 50,
  ): TimelineItem[] {
    const messages = this.eventStore.getMessages(teamId)
    const messageItems: TimelineItem[] = messages
      .filter((m) => m.timestamp < beforeTimestamp)
      .map((m) => ({
        id: m.id,
        kind: 'message' as const,
        timestamp: m.timestamp,
        message: m,
      }))

    const visibilities = getVisibilityFilter(verbosity)
    const events = this.eventStore.queryEvents({
      teamId,
      visibility: visibilities,
      until: beforeTimestamp - 1,
    })
    const eventItems: TimelineItem[] = events.map((e) => ({
      id: e.id,
      kind: 'event' as const,
      timestamp: e.timestamp,
      event: e,
    }))

    const all = [...messageItems, ...eventItems].sort((a, b) => a.timestamp - b.timestamp)

    // Return the most recent `limit` items before the cutoff
    if (all.length > limit) {
      return all.slice(-limit)
    }
    return all
  }

  /**
   * Subscribe to real-time timeline updates for a team.
   * Calls `onItem` whenever a new message or event arrives.
   */
  subscribeToUpdates(
    teamId: string,
    verbosity: VerbosityLevel,
    onItem: (item: TimelineItem) => void,
  ): UnsubscribeFn {
    const visibilities = getVisibilityFilter(verbosity)

    // Subscribe to activity events
    const unsubEvents = this.hub.subscribe('*', (event) => {
      if (event.teamId === teamId && visibilities.includes(event.visibility)) {
        onItem({
          id: event.id,
          kind: 'event',
          timestamp: event.timestamp,
          event,
        })
      }
    })

    this.unsubscribers.push(unsubEvents)
    return unsubEvents
  }

  /**
   * Push a new message into the timeline stream (called when BoB or user sends a message).
   * This is for the UI to call after inserting into the store.
   */
  static messageToTimelineItem(message: ChatMessage): TimelineItem {
    return {
      id: message.id,
      kind: 'message',
      timestamp: message.timestamp,
      message,
    }
  }

  /**
   * Clean up all subscriptions.
   */
  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }
}
