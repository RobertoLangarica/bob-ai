/**
 * TeamFactory — creates calibrated team instances from templates.
 *
 * Template in → specialist swaps → calibration overlay → ready team out.
 */

import type { TeamTemplate, TeamInstance, AgentRole } from '../types/teams'
import type { WorkspaceCalibration } from '../types/calibration'
import { findSpecialistForRole } from './specialist-catalog'

/**
 * Create a team instance from a template with specialist swaps.
 */
export function createTeamInstance(
  template: TeamTemplate,
  taskDescription: string,
  workspaceCalibration: WorkspaceCalibration,
): TeamInstance {
  const workspaceType = workspaceCalibration.workspace.type

  // Apply specialist swaps based on task + workspace context
  const roles = template.roles.map((role) => {
    const specialist = findSpecialistForRole(role.id, taskDescription, workspaceType)
    if (!specialist) return role

    // Swap the role with specialist overrides
    const swapped: AgentRole = {
      ...role,
      name: specialist.name,
      description: specialist.description,
      defaultCalibration: {
        ...role.defaultCalibration,
        ...specialist.calibrationDefaults,
      },
    }

    // Apply workspace calibration for this agent if it exists
    const agentCal = workspaceCalibration.agentCalibrations[role.id]
    if (agentCal) {
      swapped.defaultCalibration = {
        ...swapped.defaultCalibration,
        ...agentCal,
        preferences: [...swapped.defaultCalibration.preferences, ...(agentCal.preferences ?? [])],
        constraints: [...swapped.defaultCalibration.constraints, ...(agentCal.constraints ?? [])],
      }
    }

    return swapped
  })

  return {
    id: `${template.id}-${crypto.randomUUID().slice(0, 8)}`,
    name: template.name,
    templateId: template.id,
    roles,
    status: 'idle',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }
}
