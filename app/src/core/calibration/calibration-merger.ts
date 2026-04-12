/**
 * CalibrationMerger — 4-layer calibration merge.
 *
 * Layers (lower overrides higher):
 *   1. Global defaults       (shipped with bob-ai)
 *   2. Template defaults     (from team template)
 *   3. Workspace calibrations (.bob/calibrations.json)
 *   4. Session overrides     (transient, not persisted)
 *
 * Unset fields inherit from the parent layer.
 */

import type { AgentCalibration } from '../types/calibration'
import { createDefaultAgentCalibration } from '../types/calibration'

// ---------------------------------------------------------------------------
// Global defaults (Layer 1 — shipped with bob-ai)
// ---------------------------------------------------------------------------

export const GLOBAL_DEFAULTS: AgentCalibration = {
  preferences: [],
  constraints: [],
  decisionStyle: 'ask-on-major',
  retryLimit: 3,
  errorEscalation: 'report-and-continue',
  progressReporting: 'milestone-based',
}

// ---------------------------------------------------------------------------
// Session overrides (Layer 4 — transient, in-memory)
// ---------------------------------------------------------------------------

export class SessionOverrides {
  private overrides: Map<string, Partial<AgentCalibration>> = new Map()
  private globalOverride: Partial<AgentCalibration> = {}

  /**
   * Set a session override for a specific agent.
   */
  setForAgent(agentId: string, override: Partial<AgentCalibration>): void {
    const existing = this.overrides.get(agentId) ?? {}
    this.overrides.set(agentId, { ...existing, ...override })
  }

  /**
   * Set a global session override (applies to all agents).
   */
  setGlobal(override: Partial<AgentCalibration>): void {
    this.globalOverride = { ...this.globalOverride, ...override }
  }

  /**
   * Get session overrides for a specific agent (merged with global).
   */
  getForAgent(agentId: string): Partial<AgentCalibration> {
    const agentOverride = this.overrides.get(agentId) ?? {}
    return { ...this.globalOverride, ...agentOverride }
  }

  /**
   * Clear all session overrides.
   */
  clear(): void {
    this.overrides.clear()
    this.globalOverride = {}
  }

  /**
   * Clear overrides for a specific agent.
   */
  clearForAgent(agentId: string): void {
    this.overrides.delete(agentId)
  }
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/**
 * Merge calibration layers for a specific agent.
 *
 * Priority (highest to lowest):
 * sessionOverride > workspaceCalibration > templateDefault > globalDefault
 */
export function mergeCalibrations(
  globalDefault: AgentCalibration,
  templateDefault: Partial<AgentCalibration>,
  workspaceCalibration: Partial<AgentCalibration>,
  sessionOverride: Partial<AgentCalibration>,
): AgentCalibration {
  // Start with global defaults
  const result = { ...globalDefault }

  // Apply template defaults (Layer 2)
  applyLayer(result, templateDefault)

  // Apply workspace calibrations (Layer 3)
  applyLayer(result, workspaceCalibration)

  // Apply session overrides (Layer 4)
  applyLayer(result, sessionOverride)

  return result
}

/**
 * Apply a partial calibration layer on top of a base.
 * Only overrides fields that are explicitly set (not undefined).
 */
function applyLayer(base: AgentCalibration, layer: Partial<AgentCalibration>): void {
  if (layer.framework !== undefined) base.framework = layer.framework
  if (layer.specialization !== undefined) base.specialization = layer.specialization
  if (layer.decisionStyle !== undefined) base.decisionStyle = layer.decisionStyle
  if (layer.retryLimit !== undefined) base.retryLimit = layer.retryLimit
  if (layer.errorEscalation !== undefined) base.errorEscalation = layer.errorEscalation
  if (layer.progressReporting !== undefined) base.progressReporting = layer.progressReporting

  // Arrays: merge (deduplicate)
  if (layer.preferences && layer.preferences.length > 0) {
    const merged = new Set([...base.preferences, ...layer.preferences])
    base.preferences = [...merged]
  }
  if (layer.constraints && layer.constraints.length > 0) {
    const merged = new Set([...base.constraints, ...layer.constraints])
    base.constraints = [...merged]
  }
}

/**
 * Convenience: merge all 4 layers for an agent using the standard flow.
 */
export function buildEffectiveCalibration(
  agentId: string,
  templateDefault: Partial<AgentCalibration>,
  workspaceAgentCal: Partial<AgentCalibration>,
  sessionOverrides: SessionOverrides,
): AgentCalibration {
  return mergeCalibrations(
    GLOBAL_DEFAULTS,
    templateDefault,
    workspaceAgentCal,
    sessionOverrides.getForAgent(agentId),
  )
}
