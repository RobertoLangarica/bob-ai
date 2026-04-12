/**
 * Calibration types — workspace memory for agent behavior.
 *
 * Calibrations are how users make agents behave consistently across sessions.
 * They're set conversationally through BoB but stored as structured data.
 */

// ---------------------------------------------------------------------------
// Per-agent calibration
// ---------------------------------------------------------------------------

export interface AgentCalibration {
  /** e.g., "mobile" overrides generic "ui" */
  specialization?: string
  /** Agent-specific framework preference */
  framework?: string

  /** Positive rules ("always do X") */
  preferences: string[]
  /** Negative rules ("never do Y") */
  constraints: string[]

  /** How autonomous the agent should be */
  decisionStyle?: 'autonomous' | 'ask-first' | 'ask-on-major'

  /** How many times to retry on error (default: 3) */
  retryLimit?: number
  /** Error handling strategy */
  errorEscalation?: 'auto-fix' | 'report-and-continue' | 'stop-and-ask'

  /** How often the agent reports progress */
  progressReporting?: 'verbose' | 'milestone-based' | 'completion-only'
}

// ---------------------------------------------------------------------------
// Workspace calibration (the full .bob/calibrations.json schema)
// ---------------------------------------------------------------------------

export interface WorkspaceCalibration {
  /** Workspace identity */
  workspace: {
    name: string
    type: string // "web-app" | "mobile-app" | "library" | "api" | "monorepo" | string
    description?: string
  }

  /** Team-level defaults (apply to all agents) */
  teamDefaults: {
    template: string // Base template ID (e.g., "swe-team")
    goals: {
      platform?: string
      framework?: string
      language?: string
      testing?: string
      deployment?: string
    }
    constraints: string[]
    escalationRules: string[]
  }

  /** Per-agent calibrations, keyed by agent role ID */
  agentCalibrations: Record<string, AgentCalibration>

  /** Work history (auto-updated by BoB) */
  history: {
    milestonesAchieved: string[]
    lastActiveTeam: string
    totalTasks: number
    lastSessionDate: string
  }
}

// ---------------------------------------------------------------------------
// Calibration question (for structured calibration flows)
// ---------------------------------------------------------------------------

export interface CalibrationQuestion {
  id: string
  question: string
  category: string // "code-style" | "dependencies" | "testing" | etc.
  options: Array<{
    label: string
    value: string
    description?: string
  }>
  /** Which agent roles this affects ("*" = all) */
  appliesTo: string[] | '*'
  /** Pre-selected if user skips */
  defaultOption?: string
}

// ---------------------------------------------------------------------------
// Factory: empty calibration defaults
// ---------------------------------------------------------------------------

export function createDefaultCalibration(): WorkspaceCalibration {
  return {
    workspace: {
      name: '',
      type: '',
      description: '',
    },
    teamDefaults: {
      template: '',
      goals: {},
      constraints: [],
      escalationRules: [],
    },
    agentCalibrations: {},
    history: {
      milestonesAchieved: [],
      lastActiveTeam: '',
      totalTasks: 0,
      lastSessionDate: new Date().toISOString(),
    },
  }
}

export function createDefaultAgentCalibration(): AgentCalibration {
  return {
    preferences: [],
    constraints: [],
    decisionStyle: 'ask-on-major',
    retryLimit: 3,
    errorEscalation: 'report-and-continue',
    progressReporting: 'milestone-based',
  }
}
