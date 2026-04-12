/**
 * CalibrationInjector — Converts calibration data into system prompt segments.
 *
 * Structured calibration data → natural language instructions injected
 * into agent system prompts. Deterministic: same input always produces
 * the same output.
 */

import type { AgentCalibration } from '../types/calibration'

/**
 * Convert a merged calibration object into text that gets prepended
 * to an agent's system prompt.
 *
 * The output is deterministic — the same calibration always produces
 * the same prompt text.
 */
export function injectCalibration(calibration: AgentCalibration): string {
  const sections: string[] = []

  // Framework
  if (calibration.framework) {
    sections.push(`You must use ${calibration.framework} as the primary framework.`)
  }

  // Specialization
  if (calibration.specialization) {
    sections.push(`Your specialization is ${calibration.specialization}.`)
  }

  // Preferences (positive rules)
  if (calibration.preferences.length > 0) {
    sections.push('REQUIRED PREFERENCES:')
    for (const pref of calibration.preferences) {
      sections.push(`- ${pref}`)
    }
  }

  // Constraints (negative rules)
  if (calibration.constraints.length > 0) {
    sections.push('CONSTRAINTS (must follow):')
    for (const constraint of calibration.constraints) {
      sections.push(`- ${constraint}`)
    }
  }

  // Decision making style
  if (calibration.decisionStyle) {
    switch (calibration.decisionStyle) {
      case 'autonomous':
        sections.push(
          'Decision style: Make decisions autonomously. Only ask for help if you encounter an unrecoverable blocker.',
        )
        break
      case 'ask-first':
        sections.push(
          'Decision style: Ask the Team Lead before making any significant decision. Proceed only after confirmation.',
        )
        break
      case 'ask-on-major':
        sections.push(
          "Decision style: Proceed autonomously on minor decisions. Ask the Team Lead before major architectural decisions or changes that affect other agents' work.",
        )
        break
    }
  }

  // Error handling
  if (calibration.errorEscalation) {
    switch (calibration.errorEscalation) {
      case 'auto-fix':
        sections.push(
          `Error handling: When you encounter an error, attempt to fix it automatically. Retry up to ${calibration.retryLimit ?? 3} times before escalating.`,
        )
        break
      case 'report-and-continue':
        sections.push(
          'Error handling: When you encounter an error, report it and continue with the next task. Do not block on errors.',
        )
        break
      case 'stop-and-ask':
        sections.push(
          'Error handling: When you encounter an error, stop and ask for guidance. Do not attempt to fix it automatically.',
        )
        break
    }
  }

  // Progress reporting
  if (calibration.progressReporting) {
    switch (calibration.progressReporting) {
      case 'verbose':
        sections.push(
          'Progress reporting: Report progress frequently — after each significant action or file change.',
        )
        break
      case 'milestone-based':
        sections.push(
          'Progress reporting: Report progress when you complete a sub-goal or reach a meaningful milestone.',
        )
        break
      case 'completion-only':
        sections.push(
          'Progress reporting: Only report when the entire task is complete. Minimize intermediate updates.',
        )
        break
    }
  }

  if (sections.length === 0) {
    return ''
  }

  return `\n--- WORKSPACE CALIBRATION ---\n${sections.join('\n')}\n--- END CALIBRATION ---\n`
}

/**
 * Build the full system prompt for an agent by combining:
 * 1. The role's base system prompt template
 * 2. Calibration injection
 * 3. The mandatory debrief instruction
 */
export function buildAgentSystemPrompt(
  basePrompt: string,
  calibration: AgentCalibration,
  task: string,
): string {
  const calibrationBlock = injectCalibration(calibration)

  const debriefInstruction = `
Before starting any work, you MUST call the debrief tool to read workspace
context and calibrations. Do not proceed until debrief is complete.
After debrief, emit an agent.debriefed event with your context assessment and plan.
`

  const taskBlock = `
--- CURRENT TASK ---
${task}
--- END TASK ---
`

  return [basePrompt, calibrationBlock, debriefInstruction, taskBlock].filter(Boolean).join('\n')
}
