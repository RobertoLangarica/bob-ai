/**
 * Visibility rules — maps event types to visibility levels.
 *
 * The hub assigns visibility to each event based on these rules.
 * Agents don't decide what the user sees — the hub does.
 */

import type { EventVisibility } from '../types/events'

// ---------------------------------------------------------------------------
// Default visibility rules
// ---------------------------------------------------------------------------

export const defaultVisibilityRules: Record<string, EventVisibility> = {
  // TIMELINE — shown in the main chat view
  'delegation.sent': 'timeline',
  'milestone.achieved': 'timeline',
  'goal.completed': 'timeline',
  'code.changed': 'timeline',
  'test.run': 'timeline',
  'agent.error': 'timeline',

  // ACTIVITY — shown in the activity view only
  'agent.spawned': 'activity',
  'agent.debriefed': 'activity',
  'agent.thinking': 'activity',
  'agent.completed': 'activity',
  'tool.invoke': 'activity',
  'tool.batch': 'activity',
  'goal.progress': 'activity',
  'web.search': 'activity',
  'web.scrape': 'activity',

  // INTERNAL — stored but never shown by default
  'message.sent': 'internal',
  'tool.result': 'internal',
  'tool.error': 'internal',
  'test.passed': 'internal',
  'test.failed': 'internal',
  'agent.paused': 'internal',
  'agent.resumed': 'internal',
  'knowledge.read': 'internal',
}

/**
 * Resolve visibility for an event type.
 * Unknown types default to "activity" — custom events are always surfaceable.
 */
export function resolveVisibility(
  type: string,
  rules: Record<string, EventVisibility> = defaultVisibilityRules,
): EventVisibility {
  // Exact match first
  if (rules[type]) return rules[type]

  // Try prefix match (e.g., "design.mockup.created" might match "design.*" rule)
  for (const [pattern, visibility] of Object.entries(rules)) {
    if (pattern.endsWith('*') && type.startsWith(pattern.slice(0, -1))) {
      return visibility
    }
  }

  // Unknown types default to activity
  return 'activity'
}

// ---------------------------------------------------------------------------
// Verbosity filter helpers
// ---------------------------------------------------------------------------

export type VerbosityLevel = 'minimal' | 'normal' | 'detailed' | 'debug'

/**
 * Get which visibility levels to show for a given verbosity setting.
 */
export function getVisibilityFilter(level: VerbosityLevel): EventVisibility[] {
  switch (level) {
    case 'minimal':
      return ['timeline']
    case 'normal':
      return ['timeline', 'activity']
    case 'detailed':
      return ['timeline', 'activity', 'internal']
    case 'debug':
      return ['timeline', 'activity', 'internal', 'debug']
  }
}
