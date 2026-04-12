/**
 * CalibrationStore — Read/write .bob/calibrations.json with surgical updates.
 *
 * Reads are synchronous (data is small). Writes are atomic.
 * Exposes methods for updating specific sections without overwriting the whole file.
 */

import type { JSONStore } from '../storage/json-store'
import { StorageKeys } from '../storage/storage-init'
import type { WorkspaceCalibration, AgentCalibration } from '../types/calibration'
import { createDefaultCalibration, createDefaultAgentCalibration } from '../types/calibration'

export class CalibrationStore {
  constructor(private readonly json: JSONStore) {}

  /**
   * Read the full workspace calibration.
   */
  read(): WorkspaceCalibration {
    return this.json.read<WorkspaceCalibration>(
      StorageKeys.CALIBRATIONS,
      createDefaultCalibration(),
    )
  }

  /**
   * Write the full workspace calibration (replaces everything).
   */
  write(calibration: WorkspaceCalibration): void {
    this.json.write<WorkspaceCalibration>(StorageKeys.CALIBRATIONS, calibration)
  }

  /**
   * Update workspace identity.
   */
  updateWorkspace(partial: Partial<WorkspaceCalibration['workspace']>): void {
    const cal = this.read()
    cal.workspace = { ...cal.workspace, ...partial }
    this.write(cal)
  }

  /**
   * Update team defaults (partial merge).
   */
  updateTeamDefaults(partial: Partial<WorkspaceCalibration['teamDefaults']>): void {
    const cal = this.read()
    if (partial.goals) {
      cal.teamDefaults.goals = { ...cal.teamDefaults.goals, ...partial.goals }
    }
    if (partial.template !== undefined) cal.teamDefaults.template = partial.template
    if (partial.constraints) {
      cal.teamDefaults.constraints = partial.constraints
    }
    if (partial.escalationRules) {
      cal.teamDefaults.escalationRules = partial.escalationRules
    }
    this.write(cal)
  }

  /**
   * Update a specific agent's calibration (creates if doesn't exist).
   */
  updateAgentCalibration(agentId: string, partial: Partial<AgentCalibration>): void {
    const cal = this.read()
    const existing = cal.agentCalibrations[agentId] ?? createDefaultAgentCalibration()
    cal.agentCalibrations[agentId] = { ...existing, ...partial }

    // Merge arrays instead of replacing
    if (partial.preferences) {
      const merged = new Set([...existing.preferences, ...partial.preferences])
      cal.agentCalibrations[agentId].preferences = [...merged]
    }
    if (partial.constraints) {
      const merged = new Set([...existing.constraints, ...partial.constraints])
      cal.agentCalibrations[agentId].constraints = [...merged]
    }

    this.write(cal)
  }

  /**
   * Add a constraint to team defaults.
   */
  addConstraint(constraint: string): void {
    const cal = this.read()
    if (!cal.teamDefaults.constraints.includes(constraint)) {
      cal.teamDefaults.constraints.push(constraint)
      this.write(cal)
    }
  }

  /**
   * Add an escalation rule.
   */
  addEscalationRule(rule: string): void {
    const cal = this.read()
    if (!cal.teamDefaults.escalationRules.includes(rule)) {
      cal.teamDefaults.escalationRules.push(rule)
      this.write(cal)
    }
  }

  /**
   * Record a milestone achievement in history.
   */
  recordMilestone(title: string): void {
    const cal = this.read()
    cal.history.milestonesAchieved.push(title)
    cal.history.totalTasks++
    cal.history.lastSessionDate = new Date().toISOString()
    this.write(cal)
  }

  /**
   * Update last active team in history.
   */
  setLastActiveTeam(teamId: string): void {
    const cal = this.read()
    cal.history.lastActiveTeam = teamId
    cal.history.lastSessionDate = new Date().toISOString()
    this.write(cal)
  }

  /**
   * Get calibration for a specific agent (with defaults).
   */
  getAgentCalibration(agentId: string): AgentCalibration {
    const cal = this.read()
    return cal.agentCalibrations[agentId] ?? createDefaultAgentCalibration()
  }
}
