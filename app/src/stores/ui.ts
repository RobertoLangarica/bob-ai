/**
 * UI Store — User interface preferences and display state.
 *
 * Controls verbosity level, view modes, and other UI-specific settings.
 * Persists preferences to localStorage so they survive restarts.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { VerbosityLevel } from '@/core/hub/visibility-rules'

const UI_PREFS_KEY = 'bob-ai:ui-prefs'

interface UIPrefs {
  verbosity: VerbosityLevel
  compactMode: boolean
  viewMode: 'chat' | 'activity'
  activityView: 'orbital' | 'tasks'
}

function loadPrefs(): Partial<UIPrefs> {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs: UIPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage may not be available
  }
}

export const useUIStore = defineStore('ui', () => {
  const saved = loadPrefs()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const verbosity = ref<VerbosityLevel>(saved.verbosity ?? 'normal')
  const compactMode = ref(saved.compactMode ?? false)
  const viewMode = ref<'chat' | 'activity'>(saved.viewMode ?? 'chat')
  const activityView = ref<'orbital' | 'tasks'>(saved.activityView ?? 'orbital')

  /** Whether the team navigation menu is open */
  const menuOpen = ref(false)

  // ---------------------------------------------------------------------------
  // Verbosity labels (for UI display)
  // ---------------------------------------------------------------------------

  const verbosityOptions: { value: VerbosityLevel; label: string; description: string }[] = [
    { value: 'minimal', label: 'Minimal', description: 'Milestones, code changes, errors' },
    { value: 'normal', label: 'Normal', description: 'Timeline + activity events' },
    { value: 'detailed', label: 'Detailed', description: 'Everything except debug' },
    { value: 'debug', label: 'Debug', description: 'All events including internal' },
  ]

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function setVerbosity(level: VerbosityLevel) {
    verbosity.value = level
  }

  function toggleCompactMode() {
    compactMode.value = !compactMode.value
  }

  function setViewMode(mode: 'chat' | 'activity') {
    viewMode.value = mode
  }

  function setActivityView(view: 'orbital' | 'tasks') {
    activityView.value = view
  }

  function toggleMenu() {
    menuOpen.value = !menuOpen.value
  }

  function closeMenu() {
    menuOpen.value = false
  }

  // ---------------------------------------------------------------------------
  // Persist on change
  // ---------------------------------------------------------------------------

  watch(
    [verbosity, compactMode, viewMode, activityView],
    () => {
      savePrefs({
        verbosity: verbosity.value,
        compactMode: compactMode.value,
        viewMode: viewMode.value,
        activityView: activityView.value,
      })
    },
    { deep: true },
  )

  return {
    // State
    verbosity,
    compactMode,
    viewMode,
    activityView,
    menuOpen,
    // Constants
    verbosityOptions,
    // Actions
    setVerbosity,
    toggleCompactMode,
    setViewMode,
    setActivityView,
    toggleMenu,
    closeMenu,
  }
})
