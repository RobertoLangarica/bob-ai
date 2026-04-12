/**
 * Team template and specialist types.
 *
 * Teams are the unit of work in bob-ai. Templates define which agent roles
 * are included, what each role does, and what default calibrations apply.
 */

import type { AgentCalibration, CalibrationQuestion } from './calibration'

// ---------------------------------------------------------------------------
// Agent role (a slot within a team template)
// ---------------------------------------------------------------------------

export interface AgentRole {
  /** Role identifier (e.g., "ui", "backend") */
  id: string
  /** Display name (e.g., "UI Developer") */
  name: string
  /** Role category (e.g., "Frontend") */
  role: string
  /** What this agent does */
  description: string
  /** Base system prompt (calibrations get injected) */
  systemPromptTemplate: string

  /** What this role can be specialized for */
  specializations: string[]
  /** Which tools this agent gets */
  tools: string[]

  /** Default calibration for this role */
  defaultCalibration: AgentCalibration
}

// ---------------------------------------------------------------------------
// Team template (blueprint for creating teams)
// ---------------------------------------------------------------------------

export interface TeamTemplate {
  /** Unique identifier (e.g., "swe-team") */
  id: string
  /** Display name (e.g., "SWE Team") */
  name: string
  /** What this team is for */
  description: string
  /** Template version */
  version: string

  /** The agents in this team */
  roles: AgentRole[]

  /** Default team-level settings */
  defaults: {
    goals: Record<string, string>
    constraints: string[]
    escalationRules: string[]
  }

  /** Calibration questions to ask when creating from this template */
  calibrationFlow: CalibrationQuestion[]
}

// ---------------------------------------------------------------------------
// Specialist entry (catalog of available specializations)
// ---------------------------------------------------------------------------

export interface SpecialistEntry {
  /** e.g., "mobile-ui" */
  id: string
  /** e.g., "ui" (which template role this specializes) */
  baseRole: string
  /** e.g., "Mobile UI Developer" */
  name: string
  /** Description of what this specialist does */
  description: string
  /** Task keywords that trigger this specialist */
  keywords: string[]
  /** Associated frameworks */
  frameworks: string[]
  /** Pre-set calibration for this specialty */
  calibrationDefaults: Partial<AgentCalibration>
}

// ---------------------------------------------------------------------------
// Team instance (a created, calibrated team ready for work)
// ---------------------------------------------------------------------------

export interface TeamInstance {
  /** Unique team instance ID */
  id: string
  /** Display name */
  name: string
  /** Which template this was created from */
  templateId: string
  /** The active agent roles (after specialist swaps) */
  roles: AgentRole[]
  /** Current status */
  status: 'idle' | 'working' | 'paused' | 'completed' | 'error'
  /** When the team was created */
  createdAt: number
  /** Last activity timestamp */
  lastActiveAt: number
}
