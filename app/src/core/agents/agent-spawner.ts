/**
 * AgentSpawner — Manages agent lifecycle from spawn to completion.
 *
 * V0 implementation: Simulated agent spawning (no real Cline SDK yet).
 * When the SDK is available, the SimulatedAgentSpawner is swapped for
 * a ClineAgentSpawner that calls the real spawn_agent.
 *
 * The spawner:
 * - Creates agent instances with unique IDs
 * - Emits lifecycle events (spawned, debriefed, completed, error)
 * - Manages retry logic for recoverable errors
 * - Tracks all running agents per team
 */

import type { ActivityHub } from '../hub/activity-hub'
import { EventTypes } from '../types/events'
import type { AgentSpawnConfig, AgentInstance, AgentStatus, IAgentSpawner } from './types'

// ---------------------------------------------------------------------------
// Agent spawner implementation
// ---------------------------------------------------------------------------

export class AgentSpawner implements IAgentSpawner {
  private agents: Map<string, AgentInstance> = new Map()

  constructor(private readonly hub: ActivityHub) {}

  /**
   * Spawn a new agent. Creates the instance, emits spawned event,
   * and registers it for tracking.
   */
  async spawn(config: AgentSpawnConfig): Promise<AgentInstance> {
    const agentId = `${config.role.id}-${crypto.randomUUID().slice(0, 8)}`

    const instance: AgentInstance = {
      id: agentId,
      teamId: config.teamId,
      role: config.role,
      task: config.task,
      status: 'spawning',
      spawnedAt: Date.now(),
      retryCount: 0,
      maxRetries: config.calibration.retryLimit ?? 3,
    }

    this.agents.set(agentId, instance)

    // Emit spawned event
    this.hub.emit(config.teamId, agentId, EventTypes.AGENT_SPAWNED, {
      role: config.role.name,
      task: config.task,
      calibration: {
        framework: config.calibration.framework,
        specialization: config.calibration.specialization,
        preferences: config.calibration.preferences,
      },
    })

    // Transition to debriefing
    this.updateStatus(agentId, 'debriefing')

    return instance
  }

  /**
   * Get a running agent by ID.
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all agents for a team.
   */
  getTeamAgents(teamId: string): AgentInstance[] {
    return Array.from(this.agents.values()).filter((a) => a.teamId === teamId)
  }

  /**
   * Get all agents with a specific status.
   */
  getAgentsByStatus(status: AgentStatus): AgentInstance[] {
    return Array.from(this.agents.values()).filter((a) => a.status === status)
  }

  /**
   * Pause an agent.
   */
  async pause(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent || agent.status === 'completed' || agent.status === 'error') return

    this.updateStatus(agentId, 'paused')
    this.hub.emit(agent.teamId, agentId, EventTypes.AGENT_PAUSED, {
      reason: 'User requested pause',
    })
  }

  /**
   * Resume a paused agent.
   */
  async resume(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent || agent.status !== 'paused') return

    this.updateStatus(agentId, 'working')
    this.hub.emit(agent.teamId, agentId, EventTypes.AGENT_RESUMED, {})
  }

  /**
   * Stop an agent entirely.
   */
  async stop(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return

    this.updateStatus(agentId, 'completed')
    agent.completedAt = Date.now()
    agent.result = 'Stopped by user'

    this.hub.emit(agent.teamId, agentId, EventTypes.AGENT_COMPLETED, {
      result: 'Stopped by user',
      artifacts: [],
    })
  }

  // -------------------------------------------------------------------------
  // Lifecycle transitions
  // -------------------------------------------------------------------------

  /**
   * Update an agent's status.
   */
  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = status
    }
  }

  /**
   * Mark an agent as completed with results.
   */
  completeAgent(agentId: string, result: string, artifacts: string[]): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    agent.status = 'completed'
    agent.completedAt = Date.now()
    agent.result = result
    agent.artifacts = artifacts

    this.hub.emit(agent.teamId, agentId, EventTypes.AGENT_COMPLETED, {
      result,
      artifacts,
    })
  }

  /**
   * Handle an agent error with retry logic.
   * Returns true if the agent should retry, false if it's exhausted retries.
   */
  handleError(agentId: string, error: string, recoverable: boolean): boolean {
    const agent = this.agents.get(agentId)
    if (!agent) return false

    this.hub.emit(agent.teamId, agentId, EventTypes.AGENT_ERROR, {
      error,
      recoverable,
    })

    if (recoverable && agent.retryCount < agent.maxRetries) {
      agent.retryCount++
      agent.status = 'working' // Back to work
      return true // Should retry
    }

    // Non-recoverable or retries exhausted
    agent.status = 'error'
    agent.error = error
    return false
  }

  /**
   * Remove a completed/errored agent from tracking.
   */
  removeAgent(agentId: string): void {
    this.agents.delete(agentId)
  }

  /**
   * Get summary stats for all tracked agents.
   */
  getStats(): {
    total: number
    byStatus: Record<AgentStatus, number>
  } {
    const byStatus = {} as Record<AgentStatus, number>
    for (const agent of this.agents.values()) {
      byStatus[agent.status] = (byStatus[agent.status] || 0) + 1
    }
    return { total: this.agents.size, byStatus }
  }
}
