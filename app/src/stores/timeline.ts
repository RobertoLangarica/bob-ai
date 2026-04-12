/**
 * Timeline Store — Per-team timeline data with real-time streaming.
 *
 * Manages the merged view of chat messages + activity events for the
 * currently viewed team. Handles verbosity filtering and real-time updates.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { TimelineManager, type TimelineItem } from '@/core/timeline/timeline-manager'
import type { ChatMessage } from '@/core/types/config'
import type { UnsubscribeFn } from '@/core/hub/activity-hub'
import type { VerbosityLevel } from '@/core/hub/visibility-rules'
import { useAppStore } from './app'
import { useTeamsStore } from './teams'
import { useUIStore } from './ui'

export const useTimelineStore = defineStore('timeline', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Timeline items for the current team, sorted by timestamp */
  const items = ref<TimelineItem[]>([])

  /** Whether there are older items to load */
  const hasMore = ref(false)

  /** Loading state */
  const loading = ref(false)

  /** Active subscription cleanup */
  let unsubscribe: UnsubscribeFn | null = null

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Load the timeline for the current team + verbosity.
   * Called when team switches or verbosity changes.
   */
  function loadCurrentTimeline() {
    const app = useAppStore()
    const teamsStore = useTeamsStore()
    const ui = useUIStore()

    if (!app.initialized) return

    const teamId = teamsStore.currentTeamId
    const verbosity = ui.verbosity

    loading.value = true

    // Clean up previous subscription
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }

    // Load initial data
    const limit = 200
    const loaded = app.timeline.loadTimeline(teamId, verbosity, limit)
    items.value = loaded
    hasMore.value = loaded.length >= limit

    // Subscribe to real-time updates
    unsubscribe = app.timeline.subscribeToUpdates(teamId, verbosity, (item) => {
      items.value = [...items.value, item]
    })

    loading.value = false
  }

  /**
   * Load older items (pagination — scroll up).
   */
  function loadOlder() {
    const app = useAppStore()
    const teamsStore = useTeamsStore()
    const ui = useUIStore()

    if (!app.initialized || !hasMore.value || items.value.length === 0) return

    const oldest = items.value[0]
    const limit = 50
    const older = app.timeline.loadOlder(
      teamsStore.currentTeamId,
      ui.verbosity,
      oldest.timestamp,
      limit,
    )

    if (older.length > 0) {
      items.value = [...older, ...items.value]
    }
    hasMore.value = older.length >= limit
  }

  /**
   * Add a message to the timeline (called after BoB or user sends a message).
   * This avoids reloading the entire timeline just for one new message.
   */
  function pushMessage(message: ChatMessage) {
    const item = TimelineManager.messageToTimelineItem(message)
    items.value = [...items.value, item]
  }

  /**
   * Clear timeline (when switching away or destroying).
   */
  function clear() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    items.value = []
    hasMore.value = false
  }

  return {
    // State
    items,
    hasMore,
    loading,
    // Actions
    loadCurrentTimeline,
    loadOlder,
    pushMessage,
    clear,
  }
})
