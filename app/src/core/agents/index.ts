/**
 * Agents module barrel export.
 */

export { AgentSpawner } from './agent-spawner'
export { createAgentTools, StorageDebriefReader } from './agent-tools-factory'
export type { DebriefContextReader } from './agent-tools-factory'
export { injectCalibration, buildAgentSystemPrompt } from './calibration-injector'

export type {
  AgentSpawnConfig,
  AgentInstance,
  AgentStatus,
  BobAgentTools,
  DebriefResult,
  IAgentSpawner,
} from './types'
