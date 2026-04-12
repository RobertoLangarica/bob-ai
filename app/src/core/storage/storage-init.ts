/**
 * StorageInit — Initializes the .bob/ directory structure on first run.
 *
 * This is idempotent — running it on an already-initialized workspace
 * changes nothing. It ensures all required stores and default data exist.
 */

import { JSONStore } from './json-store'
import { EventStore } from './event-store'
import { createDefaultCalibration } from '../types/calibration'
import { createDefaultConfig, createDefaultMilestones } from '../types/config'
import type { WorkspaceCalibration } from '../types/calibration'
import type { AppConfig, MilestoneSummary } from '../types/config'

// ---------------------------------------------------------------------------
// Storage keys (simulate .bob/ directory paths)
// ---------------------------------------------------------------------------

export const StorageKeys = {
  CALIBRATIONS: 'calibrations',
  CONFIG: 'config',
  MILESTONES: 'milestones',
  TEAMS_PREFIX: 'teams/',
} as const

// ---------------------------------------------------------------------------
// Storage context (all stores bundled for dependency injection)
// ---------------------------------------------------------------------------

export interface StorageContext {
  json: JSONStore
  events: EventStore
  initialized: boolean
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize storage for a workspace. Idempotent — safe to call on every app launch.
 *
 * Creates default calibrations.json, config.json, and milestones.json
 * if they don't already exist.
 */
export function initializeStorage(): StorageContext {
  const json = new JSONStore()
  const events = new EventStore(true)

  // Create calibrations.json if missing
  if (!json.exists(StorageKeys.CALIBRATIONS)) {
    json.write<WorkspaceCalibration>(StorageKeys.CALIBRATIONS, createDefaultCalibration())
  }

  // Create config.json if missing
  if (!json.exists(StorageKeys.CONFIG)) {
    json.write<AppConfig>(StorageKeys.CONFIG, createDefaultConfig())
  }

  // Create milestones.json if missing
  if (!json.exists(StorageKeys.MILESTONES)) {
    json.write<MilestoneSummary>(StorageKeys.MILESTONES, createDefaultMilestones())
  }

  return {
    json,
    events,
    initialized: true,
  }
}

/**
 * Reset all storage (for testing or factory reset).
 */
export function resetStorage(ctx: StorageContext): void {
  ctx.events.clear()

  // Reset JSON stores to defaults
  ctx.json.write<WorkspaceCalibration>(StorageKeys.CALIBRATIONS, createDefaultCalibration())
  ctx.json.write<AppConfig>(StorageKeys.CONFIG, createDefaultConfig())
  ctx.json.write<MilestoneSummary>(StorageKeys.MILESTONES, createDefaultMilestones())

  // Remove any custom team templates
  const teamKeys = ctx.json.list(StorageKeys.TEAMS_PREFIX)
  for (const key of teamKeys) {
    ctx.json.delete(key)
  }
}
