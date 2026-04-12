/**
 * BoBOrchestrator — The "BoB" intelligence layer.
 *
 * BoB is the user's primary interface. It:
 * 1. Receives user messages
 * 2. Analyzes intent (task, calibration, meta)
 * 3. Creates/selects teams from templates
 * 4. Delegates work through Team Leads
 * 5. Reports results back to the user
 */

import type { ActivityHub } from '../hub/activity-hub'
import type { StorageContext } from '../storage/storage-init'
import { CalibrationStore } from '../calibration/calibration-store'
import { TemplateStore } from '../templates/template-store'
import type { TeamTemplate, TeamInstance } from '../types/teams'
import type { ChatMessage } from '../types/config'
import { createTeamInstance } from '../templates/team-factory'
import { analyzeTask } from './task-analyzer'
import type { TaskAnalysis, TaskCategory } from './task-analyzer'

// ---------------------------------------------------------------------------
// BoB response types
// ---------------------------------------------------------------------------

export interface BoBResponse {
  /** BoB's message to the user */
  message: string
  /** Suggested actions (e.g., buttons the UI can show) */
  actions?: BoBAction[]
  /** Created or selected team (if applicable) */
  team?: TeamInstance
  /** Task analysis result */
  analysis?: TaskAnalysis
}

export interface BoBAction {
  label: string
  actionId: string
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// BoBOrchestrator
// ---------------------------------------------------------------------------

export class BoBOrchestrator {
  private calibrationStore: CalibrationStore
  private templateStore: TemplateStore
  private activeTeams: Map<string, TeamInstance> = new Map()

  constructor(
    private readonly hub: ActivityHub,
    private readonly storage: StorageContext,
  ) {
    this.calibrationStore = new CalibrationStore(storage.json)
    this.templateStore = new TemplateStore(storage.json)
  }

  /**
   * Process a user message and return BoB's response.
   * This is the main entry point for all user interactions.
   */
  async processMessage(userMessage: string, teamId?: string): Promise<BoBResponse> {
    // Store the user message
    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      teamId: teamId ?? 'bob',
      sender: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }
    this.storage.events.insertMessage(chatMessage)

    // Analyze the message
    const calibration = this.calibrationStore.read()
    const templates = this.templateStore.listAll()
    const analysis = analyzeTask(userMessage, calibration, templates)

    // Route to handler based on category
    let response: BoBResponse

    switch (analysis.category) {
      case 'build':
      case 'fix':
      case 'refactor':
        response = this.handleWorkTask(userMessage, analysis, teamId)
        break
      case 'research':
        response = this.handleWorkTask(userMessage, analysis, teamId)
        break
      case 'content':
        response = this.handleWorkTask(userMessage, analysis, teamId)
        break
      case 'calibrate':
        response = this.handleCalibration(userMessage, analysis)
        break
      case 'meta':
        response = this.handleMeta(userMessage, analysis)
        break
      default:
        response = this.handleAmbiguous(userMessage, analysis)
        break
    }

    // Store BoB's response
    const bobMessage: ChatMessage = {
      id: crypto.randomUUID(),
      teamId: teamId ?? 'bob',
      sender: 'bob',
      content: response.message,
      timestamp: Date.now(),
    }
    this.storage.events.insertMessage(bobMessage)

    return response
  }

  // -------------------------------------------------------------------------
  // Work tasks (build, fix, refactor, research, content)
  // -------------------------------------------------------------------------

  private handleWorkTask(
    message: string,
    analysis: TaskAnalysis,
    existingTeamId?: string,
  ): BoBResponse {
    // If there's a calibration conflict, warn first
    if (analysis.calibrationConflict) {
      return {
        message:
          analysis.calibrationConflict +
          '\n\nShould I:\n1. Bring in a specialist for this task\n2. Create a separate team\n3. Proceed with current calibration',
        actions: [
          { label: 'Bring in specialist', actionId: 'specialist-swap', data: { analysis } },
          { label: 'Create separate team', actionId: 'new-team', data: { analysis } },
          { label: 'Proceed anyway', actionId: 'proceed', data: { analysis } },
        ],
        analysis,
      }
    }

    // If user is in an existing team, delegate to that team
    if (existingTeamId) {
      const team = this.activeTeams.get(existingTeamId)
      if (team) {
        return {
          message: `Got it. I'll have the ${team.name} work on this.`,
          team,
          analysis,
        }
      }
    }

    // Suggest a template for the task
    const templateId = analysis.suggestedTemplate
    if (!templateId) {
      return {
        message:
          "I'm not sure what kind of team this needs. Could you tell me more about what you'd like to do?",
        analysis,
      }
    }

    const template = this.templateStore.getById(templateId)
    if (!template) {
      return {
        message: `I'd suggest a ${templateId} for this, but that template isn't available. Would you like to choose a team type?`,
        actions: this.getTemplateActions(),
        analysis,
      }
    }

    // Create the team
    const calibration = this.calibrationStore.read()
    const team = createTeamInstance(template, message, calibration)
    this.activeTeams.set(team.id, team)

    // Update last active team
    this.calibrationStore.setLastActiveTeam(team.id)

    const roleNames = team.roles.map((r) => r.name).join(', ')
    return {
      message: `I'll put together a **${team.name}** for this.\n\nTeam: ${roleNames}\n\nI'll brief them and get started.`,
      team,
      analysis,
    }
  }

  // -------------------------------------------------------------------------
  // Calibration (conversational preference setting)
  // -------------------------------------------------------------------------

  private handleCalibration(message: string, analysis: TaskAnalysis): BoBResponse {
    // Extract calibration intent from message — use original case for user-facing text

    // Pattern: "always use X" / "prefer X"
    const alwaysMatch = message.match(/always (?:use |prefer )(.+)/i)
    if (alwaysMatch) {
      const preference = alwaysMatch[1].trim()
      this.calibrationStore.addConstraint(preference)
      return {
        message: `Got it. I'll make sure all agents follow: "${preference}". This is now saved as a workspace default.`,
        analysis,
      }
    }

    // Pattern: "never use X" / "don't use X"
    const neverMatch = message.match(/(?:never|don'?t) use (.+)/i)
    if (neverMatch) {
      const constraint = `Never use ${neverMatch[1].trim()}`
      this.calibrationStore.addConstraint(constraint)
      return {
        message: `Noted. I've added the constraint: "${constraint}". All agents will follow this.`,
        analysis,
      }
    }

    // Pattern: "switch to X" / "use X for Y"
    const switchMatch = message.match(/(?:switch to|use) (.+?)(?:\s+for\s+(.+))?$/i)
    if (switchMatch) {
      const value = switchMatch[1].trim()
      const target = switchMatch[2]?.trim()

      if (target) {
        // Agent-specific calibration
        this.calibrationStore.updateAgentCalibration(target, { framework: value })
        return {
          message: `Updated: ${target} agents will now use ${value}.`,
          analysis,
        }
      } else {
        // Global calibration
        this.calibrationStore.updateTeamDefaults({ goals: { framework: value } })
        return {
          message: `Updated workspace default framework to ${value}.`,
          analysis,
        }
      }
    }

    return {
      message:
        'I\'d like to update your preferences. Could you be more specific? For example:\n- "Always use TypeScript strict mode"\n- "Never use jQuery"\n- "Use Vitest for testing"',
      analysis,
    }
  }

  // -------------------------------------------------------------------------
  // Meta (status, help, info)
  // -------------------------------------------------------------------------

  private handleMeta(_message: string, analysis: TaskAnalysis): BoBResponse {
    const teams = Array.from(this.activeTeams.values())
    const calibration = this.calibrationStore.read()
    const templates = this.templateStore.listAll()

    if (teams.length === 0) {
      return {
        message: `I'm BoB, your AI team orchestrator. I can assemble specialized teams for you.\n\nAvailable team types: ${templates.map((t) => `**${t.name}**`).join(', ')}\n\nJust tell me what you need to do and I'll put the right team together.`,
        analysis,
      }
    }

    const teamList = teams
      .map((t) => `- **${t.name}** (${t.status}) — ${t.roles.length} agents`)
      .join('\n')

    return {
      message: `Here's what's going on:\n\n${teamList}\n\nWorkspace: ${calibration.workspace.name || 'Not configured'}\nType: ${calibration.workspace.type || 'Not set'}`,
      analysis,
    }
  }

  // -------------------------------------------------------------------------
  // Ambiguous (needs clarification)
  // -------------------------------------------------------------------------

  private handleAmbiguous(_message: string, analysis: TaskAnalysis): BoBResponse {
    return {
      message:
        "I'm not sure what you'd like me to do. I can:\n- **Build** features or fix bugs (SWE Team)\n- **Research** topics and compare options (Research Team)\n- **Write** documentation and content (Content Team)\n\nWhat would you like to work on?",
      actions: this.getTemplateActions(),
      analysis,
    }
  }

  // -------------------------------------------------------------------------
  // Team management
  // -------------------------------------------------------------------------

  /** Get active teams. */
  getActiveTeams(): TeamInstance[] {
    return Array.from(this.activeTeams.values())
  }

  /** Get a specific active team. */
  getTeam(teamId: string): TeamInstance | undefined {
    return this.activeTeams.get(teamId)
  }

  /** Remove a completed or errored team. */
  removeTeam(teamId: string): void {
    this.activeTeams.delete(teamId)
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getTemplateActions(): BoBAction[] {
    return this.templateStore.listAll().map((t) => ({
      label: t.name,
      actionId: 'select-template',
      data: { templateId: t.id },
    }))
  }
}
