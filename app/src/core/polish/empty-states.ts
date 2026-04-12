/**
 * Empty States — Detects empty conditions and provides user guidance.
 *
 * A new workspace, a team with no history, a first-time user — all need
 * thoughtful empty states. These are onboarding opportunities, not error states.
 */

import type { StorageContext } from '../storage/storage-init'
import type { TeamInstance } from '../types/teams'

// ---------------------------------------------------------------------------
// Empty state types
// ---------------------------------------------------------------------------

export type EmptyStateKind = 'fresh-workspace' | 'no-teams' | 'empty-team' | 'empty-bob-chat'

export interface EmptyState {
  kind: EmptyStateKind
  title: string
  message: string
  action?: {
    label: string
    actionId: string
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect the appropriate empty state for the current context.
 * Returns null if there's no empty state (i.e., content exists).
 */
export function detectEmptyState(
  storage: StorageContext,
  currentTeamId: string,
  teams: TeamInstance[],
): EmptyState | null {
  // Fresh workspace — no bob chat history at all
  const bobMessages = storage.events.getMessages('bob')
  if (bobMessages.length === 0) {
    return {
      kind: 'fresh-workspace',
      title: 'Welcome to BoB',
      message: "Tell me about your project and I'll assemble a team of AI agents to help.",
      action: {
        label: 'Get Started',
        actionId: 'focus-input',
      },
    }
  }

  // No teams created yet
  if (teams.length === 0 && currentTeamId === 'bob') {
    return {
      kind: 'no-teams',
      title: 'No teams yet',
      message: "Describe a task and I'll put the right team together.",
      action: {
        label: 'Create a Team',
        actionId: 'focus-input',
      },
    }
  }

  // Viewing a specific team with no activity
  if (currentTeamId !== 'bob') {
    const teamMessages = storage.events.getMessages(currentTeamId)
    const teamEvents = storage.events.getEventsByTeam(currentTeamId)

    if (teamMessages.length === 0 && teamEvents.length === 0) {
      return {
        kind: 'empty-team',
        title: 'Team standing by',
        message: "This team is ready. Tell me what to work on and they'll get started.",
        action: {
          label: 'Assign Task',
          actionId: 'focus-input',
        },
      }
    }
  }

  // Bob chat but with messages — check if it's just the welcome
  if (currentTeamId === 'bob' && bobMessages.length <= 1) {
    return {
      kind: 'empty-bob-chat',
      title: "What's on your mind?",
      message:
        'I can build features, fix bugs, research topics, or write documentation. What do you need?',
    }
  }

  return null
}
