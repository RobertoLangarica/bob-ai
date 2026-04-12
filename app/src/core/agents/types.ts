/**
 * Agent types — interfaces for the agent integration layer.
 *
 * These define how bob-ai wraps the Cline SDK's agent spawning
 * with calibration injection, activity hub tools, and lifecycle management.
 */

import type { AgentCalibration } from '../types/calibration'
import type { AgentRole } from '../types/teams'

// ---------------------------------------------------------------------------
// Agent spawn configuration
// ---------------------------------------------------------------------------

export interface AgentSpawnConfig {
  /** Team this agent belongs to */
  teamId: string
  /** Role definition from team template */
  role: AgentRole
  /** Task assignment from Team Lead or BoB */
  task: string
  /** Merged calibration (global → template → workspace → session) */
  calibration: AgentCalibration
  /** Working directory (worktree path for code agents, project root for others) */
  workingDirectory: string
  /** Whether this agent needs a git worktree */
  useWorktree: boolean
  /** Branch name for worktree (if useWorktree is true) */
  worktreeBranch?: string
}

// ---------------------------------------------------------------------------
// Agent instance (running agent)
// ---------------------------------------------------------------------------

export type AgentStatus =
  | 'spawning'
  | 'debriefing'
  | 'planning'
  | 'working'
  | 'completed'
  | 'error'
  | 'paused'

export interface AgentInstance {
  /** Unique agent instance ID */
  id: string
  /** Team ID */
  teamId: string
  /** Role definition */
  role: AgentRole
  /** Current task */
  task: string
  /** Current lifecycle status */
  status: AgentStatus
  /** Spawn timestamp */
  spawnedAt: number
  /** Completion timestamp */
  completedAt?: number
  /** Result summary (on completion) */
  result?: string
  /** Produced artifacts (on completion) */
  artifacts?: string[]
  /** Error message (on error) */
  error?: string
  /** Number of retries attempted */
  retryCount: number
  /** Max retries from calibration */
  maxRetries: number
}

// ---------------------------------------------------------------------------
// Debrief result (returned by the debrief tool)
// ---------------------------------------------------------------------------

export interface DebriefResult {
  /** Workspace context summary */
  context: string
  /** Merged calibration for this agent */
  calibration: AgentCalibration
  /** Team-level goals */
  teamGoals: string[]
  /** Project conventions from .clinerules */
  conventions: string[]
  /** Relevant project structure */
  projectStructure: string[]
}

// ---------------------------------------------------------------------------
// Agent tools API (injected into each agent)
// ---------------------------------------------------------------------------

export interface BobAgentTools {
  /** Emit an event to the Activity Hub */
  emit(type: string, payload: Record<string, unknown>): void

  /** Read workspace context and calibrations (required first call) */
  debrief(): Promise<DebriefResult>

  /** Report progress on a goal */
  reportProgress(goalId: string, progress: number, current: string): void

  /** Report a milestone achievement */
  reportMilestone(title: string, stats: Record<string, number>): void

  /** Read current calibration */
  readCalibration(): AgentCalibration

  /** Ask the Team Lead a question */
  askLead(question: string): Promise<string>

  /** Report results to the Team Lead */
  reportToLead(result: string, artifacts: string[]): void
}

// ---------------------------------------------------------------------------
// Agent spawner interface (wraps Cline SDK)
// ---------------------------------------------------------------------------

export interface IAgentSpawner {
  /** Spawn an agent with bob-ai tools injected */
  spawn(config: AgentSpawnConfig): Promise<AgentInstance>

  /** Get a running agent by ID */
  getAgent(agentId: string): AgentInstance | undefined

  /** Get all agents for a team */
  getTeamAgents(teamId: string): AgentInstance[]

  /** Pause an agent */
  pause(agentId: string): Promise<void>

  /** Resume a paused agent */
  resume(agentId: string): Promise<void>

  /** Stop an agent */
  stop(agentId: string): Promise<void>
}
