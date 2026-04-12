/**
 * App Store — Root store that initializes and holds the core system.
 *
 * This store is the single source of truth for the storage context,
 * activity hub, timeline manager, and BoB orchestrator. All other stores
 * depend on this one.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { initializeStorage, type StorageContext } from '@/core/storage/storage-init'
import { ActivityHub } from '@/core/hub/activity-hub'
import { defaultVisibilityRules } from '@/core/hub/visibility-rules'
import { TimelineManager } from '@/core/timeline/timeline-manager'
import { BoBOrchestrator } from '@/core/bob/bob-orchestrator'

export const useAppStore = defineStore('app', () => {
  // ---------------------------------------------------------------------------
  // State — lazy-initialized singletons
  // ---------------------------------------------------------------------------

  const _storage = ref<StorageContext | null>(null)
  const _hub = ref<ActivityHub | null>(null)
  const _timeline = ref<TimelineManager | null>(null)
  const _bob = ref<BoBOrchestrator | null>(null)
  const initialized = ref(false)

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  const storage = computed(() => {
    if (!_storage.value) throw new Error('App not initialized. Call init() first.')
    return _storage.value
  })

  const hub = computed(() => {
    if (!_hub.value) throw new Error('App not initialized. Call init() first.')
    return _hub.value
  })

  const timeline = computed(() => {
    if (!_timeline.value) throw new Error('App not initialized. Call init() first.')
    return _timeline.value
  })

  const bob = computed(() => {
    if (!_bob.value) throw new Error('App not initialized. Call init() first.')
    return _bob.value
  })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Initialize the entire core system. Idempotent. */
  function init() {
    if (initialized.value) return

    const ctx = initializeStorage()
    _storage.value = ctx

    const activityHub = new ActivityHub(ctx.events, defaultVisibilityRules)
    _hub.value = activityHub

    _timeline.value = new TimelineManager(activityHub, ctx.events)
    _bob.value = new BoBOrchestrator(activityHub, ctx)

    initialized.value = true
  }

  /** Flush all pending data before app close. */
  function shutdown() {
    if (_hub.value) {
      _hub.value.flush()
      _hub.value.destroy()
    }
    if (_timeline.value) {
      _timeline.value.destroy()
    }
    if (_storage.value) {
      _storage.value.events.flush()
    }
  }

  return {
    // State
    initialized,
    // Getters
    storage,
    hub,
    timeline,
    bob,
    // Actions
    init,
    shutdown,
  }
})
