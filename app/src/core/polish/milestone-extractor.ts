/**
 * MilestoneExtractor — Listens for milestone.achieved events and appends
 * them to the milestones store (milestones.json in V0).
 *
 * Creates a human-readable, git-committable record of team accomplishments.
 * The file is append-only during a session.
 */

import type { ActivityHub, UnsubscribeFn } from '../hub/activity-hub'
import type { JSONStore } from '../storage/json-store'
import { EventTypes, type ActivityEvent } from '../types/events'
import type { MilestoneSummary } from '../types/config'
import { StorageKeys } from '../storage/storage-init'

export class MilestoneExtractor {
  private unsubscribe: UnsubscribeFn | null = null

  constructor(
    private readonly hub: ActivityHub,
    private readonly json: JSONStore,
  ) {}

  /**
   * Start listening for milestone events and persisting them.
   */
  start(): void {
    if (this.unsubscribe) return // already running

    this.unsubscribe = this.hub.subscribe(EventTypes.MILESTONE_ACHIEVED, (event) => {
      this.extractAndStore(event)
    })
  }

  /**
   * Stop listening for milestone events.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  /**
   * Extract milestone data from an event and append to the store.
   */
  private extractAndStore(event: ActivityEvent): void {
    const payload = event.payload as {
      title?: string
      description?: string
      stats?: Record<string, number>
    }

    const milestones = this.json.read<MilestoneSummary>(StorageKeys.MILESTONES, {
      milestones: [],
    })

    milestones.milestones.push({
      title: payload.title ?? 'Untitled milestone',
      team: event.teamId,
      date: new Date(event.timestamp).toISOString(),
      stats: payload.stats ?? {},
      agents: [event.agentId],
    })

    this.json.write(StorageKeys.MILESTONES, milestones)
  }

  /**
   * Get all recorded milestones.
   */
  getMilestones(): MilestoneSummary {
    return this.json.read<MilestoneSummary>(StorageKeys.MILESTONES, { milestones: [] })
  }
}
