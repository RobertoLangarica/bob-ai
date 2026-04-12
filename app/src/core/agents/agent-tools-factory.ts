/**
 * AgentToolsFactory — Creates the bob-ai tool set for each agent.
 *
 * When an agent is spawned, this factory produces the tools that get
 * injected into the agent's environment. The tools are closures that
 * capture the teamId and agentId, so agents never need to know their own IDs.
 */

import type { ActivityHub } from '../hub/activity-hub'
import type { AgentCalibration } from '../types/calibration'
import { EventTypes } from '../types/events'
import type { BobAgentTools, DebriefResult } from './types'

// ---------------------------------------------------------------------------
// Debrief context reader
// ---------------------------------------------------------------------------

export interface DebriefContextReader {
  /** Read .clinerules files for project conventions */
  readConventions(): Promise<string[]>
  /** Read .bob/calibrations.json */
  readCalibration(): Promise<AgentCalibration>
  /** Read team goals from calibration */
  readTeamGoals(): Promise<string[]>
  /** Scan relevant project structure */
  scanProjectStructure(): Promise<string[]>
}

// ---------------------------------------------------------------------------
// Default debrief context reader (V0: reads from storage)
// ---------------------------------------------------------------------------

export class StorageDebriefReader implements DebriefContextReader {
  constructor(
    private readonly getCalibration: () => AgentCalibration,
    private readonly getTeamGoals: () => string[],
  ) {}

  async readConventions(): Promise<string[]> {
    // V0: Return empty — .clinerules reading will be added with Tauri file system
    // In V1, this reads actual .clinerules/ files
    return []
  }

  async readCalibration(): Promise<AgentCalibration> {
    return this.getCalibration()
  }

  async readTeamGoals(): Promise<string[]> {
    return this.getTeamGoals()
  }

  async scanProjectStructure(): Promise<string[]> {
    // V0: Return empty — file system scanning will be added with Tauri
    return []
  }
}

// ---------------------------------------------------------------------------
// Agent tools factory
// ---------------------------------------------------------------------------

/**
 * Create the bob-ai tool set for a specific agent.
 *
 * Tools are closures capturing teamId and agentId, so the agent
 * never needs to know its own identity in the system.
 */
export function createAgentTools(
  hub: ActivityHub,
  teamId: string,
  agentId: string,
  calibration: AgentCalibration,
  debriefReader: DebriefContextReader,
): BobAgentTools {
  return {
    emit(type: string, payload: Record<string, unknown>): void {
      hub.emit(teamId, agentId, type, payload)
    },

    async debrief(): Promise<DebriefResult> {
      const conventions = await debriefReader.readConventions()
      const cal = await debriefReader.readCalibration()
      const teamGoals = await debriefReader.readTeamGoals()
      const projectStructure = await debriefReader.scanProjectStructure()

      // Build context summary
      const context = [
        cal.framework ? `Framework: ${cal.framework}` : '',
        cal.specialization ? `Specialization: ${cal.specialization}` : '',
        cal.preferences.length > 0 ? `Preferences: ${cal.preferences.join(', ')}` : '',
        cal.constraints.length > 0 ? `Constraints: ${cal.constraints.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ')

      const result: DebriefResult = {
        context: context || 'No specific calibration context',
        calibration: cal,
        teamGoals,
        conventions,
        projectStructure,
      }

      // Emit debrief event
      hub.emit(teamId, agentId, EventTypes.AGENT_DEBRIEFED, {
        context: result.context,
        plan: '', // Agent will fill this in after processing debrief
        subgoals: teamGoals,
      })

      return result
    },

    reportProgress(goalId: string, progress: number, current: string): void {
      hub.emit(teamId, agentId, EventTypes.GOAL_PROGRESS, {
        goalId,
        progress: Math.min(1, Math.max(0, progress)),
        current,
      })
    },

    reportMilestone(title: string, stats: Record<string, number>): void {
      hub.emit(teamId, agentId, EventTypes.MILESTONE_ACHIEVED, {
        title,
        stats,
      })
    },

    readCalibration(): AgentCalibration {
      return calibration
    },

    async askLead(question: string): Promise<string> {
      // Emit the question as a message event
      hub.emit(teamId, agentId, EventTypes.MESSAGE_SENT, {
        from: agentId,
        to: 'lead',
        content: question,
      })
      // V0: Return a default acknowledgment
      // In V1, this blocks until the lead agent responds
      return 'Acknowledged. Proceed with your best judgment.'
    },

    reportToLead(result: string, artifacts: string[]): void {
      hub.emit(teamId, agentId, EventTypes.AGENT_COMPLETED, {
        result,
        artifacts,
      })
    },
  }
}
