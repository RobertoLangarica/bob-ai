/**
 * Teams Store — Manages active teams, team switching, and team lifecycle.
 *
 * The UI uses this store to display the team list, switch between teams,
 * and control team states (pause, resume, stop).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TeamInstance } from '@/core/types/teams'
import type { BoBResponse } from '@/core/bob/bob-orchestrator'
import { useAppStore } from './app'

export const useTeamsStore = defineStore('teams', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Currently viewed team (or 'bob' for BoB's direct chat) */
  const currentTeamId = ref<string>('bob')

  /** Active teams from BoB orchestrator (reactive mirror) */
  const teams = ref<TeamInstance[]>([])

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  const currentTeam = computed(() => teams.value.find((t) => t.id === currentTeamId.value))

  const currentLabel = computed(() => {
    if (currentTeamId.value === 'bob') return 'BoB'
    return currentTeam.value?.name ?? 'BoB'
  })

  const otherTeams = computed(() => teams.value.filter((t) => t.id !== currentTeamId.value))

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Switch to a different team or to BoB's direct chat. */
  function switchTeam(teamId: string) {
    currentTeamId.value = teamId
  }

  /** Switch to BoB's direct chat (for new team creation). */
  function switchToBob() {
    currentTeamId.value = 'bob'
  }

  /** Sync teams from BoB orchestrator (call after processMessage). */
  function syncFromBob() {
    const app = useAppStore()
    if (!app.initialized) return
    teams.value = app.bob.getActiveTeams()
  }

  /** Add a team from a BoB response (when a new team is created). */
  function addTeamFromResponse(response: BoBResponse) {
    if (response.team) {
      // Sync all teams from BoB to ensure consistency
      syncFromBob()
      // Auto-switch to the new team
      currentTeamId.value = response.team.id
    }
  }

  /** Pause a team. */
  function pauseTeam(teamId: string) {
    const team = teams.value.find((t) => t.id === teamId)
    if (team) {
      team.status = 'paused'
    }
  }

  /** Resume a paused team. */
  function resumeTeam(teamId: string) {
    const team = teams.value.find((t) => t.id === teamId)
    if (team && team.status === 'paused') {
      team.status = 'working'
    }
  }

  /** Stop and remove a team. */
  function stopTeam(teamId: string) {
    const app = useAppStore()
    if (app.initialized) {
      app.bob.removeTeam(teamId)
    }
    teams.value = teams.value.filter((t) => t.id !== teamId)
    if (currentTeamId.value === teamId) {
      currentTeamId.value = 'bob'
    }
  }

  return {
    // State
    currentTeamId,
    teams,
    // Getters
    currentTeam,
    currentLabel,
    otherTeams,
    // Actions
    switchTeam,
    switchToBob,
    syncFromBob,
    addTeamFromResponse,
    pauseTeam,
    resumeTeam,
    stopTeam,
  }
})
