/**
 * SessionRestore — Handles app restart resilience.
 *
 * When the app restarts:
 * 1. Reloads calibrations from storage
 * 2. Restores the event store (localStorage-backed, so automatic in V0)
 * 3. Detects interrupted teams (teams that were active when the app closed)
 * 4. Provides session state information for the UI
 */

import type { StorageContext } from '../storage/storage-init'
import type { ChatMessage } from '../types/config'
import type { WorkspaceCalibration } from '../types/calibration'
import { createDefaultCalibration } from '../types/calibration'
import { StorageKeys } from '../storage/storage-init'

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface SessionState {
  /** Whether this is a fresh workspace (no prior data) */
  isFresh: boolean
  /** Whether there were interrupted teams (agents running when app closed) */
  hasInterruptedTeams: boolean
  /** IDs of teams that were interrupted */
  interruptedTeamIds: string[]
  /** Last active team ID (for restoring the view) */
  lastActiveTeamId: string | null
  /** Workspace name from calibrations */
  workspaceName: string
  /** Number of previous chat messages */
  messageCount: number
}

// ---------------------------------------------------------------------------
// Session restoration
// ---------------------------------------------------------------------------

/**
 * Analyze the current storage state and return session information.
 * Called on app startup to determine what to show the user.
 */
export function analyzeSession(storage: StorageContext): SessionState {
  const calibration = storage.json.read<WorkspaceCalibration>(
    StorageKeys.CALIBRATIONS,
    createDefaultCalibration(),
  )

  // Check if this is a fresh workspace
  const bobMessages = storage.events.getMessages('bob')
  const isFresh = bobMessages.length === 0

  // Check for interrupted teams — in V0, we store team state in a simple key
  const interruptedTeamIds = getInterruptedTeams(storage)

  // Get last active team from calibration history
  const lastActiveTeamId = calibration?.history?.lastActiveTeam || null

  return {
    isFresh,
    hasInterruptedTeams: interruptedTeamIds.length > 0,
    interruptedTeamIds,
    lastActiveTeamId,
    workspaceName: calibration?.workspace?.name ?? '',
    messageCount: bobMessages.length,
  }
}

/**
 * Mark teams as active (called when teams start working).
 */
export function markTeamsActive(storage: StorageContext, teamIds: string[]): void {
  storage.json.write('active-teams', { teamIds, timestamp: Date.now() })
}

/**
 * Clear active teams marker (called on clean shutdown).
 */
export function clearActiveTeams(storage: StorageContext): void {
  storage.json.delete('active-teams')
}

/**
 * Get teams that were marked active but never cleaned up (interrupted).
 */
function getInterruptedTeams(storage: StorageContext): string[] {
  const activeTeams = storage.json.read<{ teamIds: string[]; timestamp: number } | null>(
    'active-teams',
    null,
  )
  if (!activeTeams) return []
  return activeTeams.teamIds
}

/**
 * Generate a system message informing the user about interrupted teams.
 */
export function createInterruptionNotice(teamIds: string[]): ChatMessage {
  const plural = teamIds.length > 1
  return {
    id: crypto.randomUUID(),
    teamId: 'bob',
    sender: 'bob',
    content: `⚠️ Session ended — ${plural ? 'some teams were' : 'a team was'} interrupted. ${plural ? 'Their' : 'Its'} emitted events are safe, but agent state was lost. You can restart the work or review what was completed.`,
    timestamp: Date.now(),
    metadata: { type: 'system-notice', interruptedTeamIds: teamIds },
  }
}
