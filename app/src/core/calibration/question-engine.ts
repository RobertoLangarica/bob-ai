/**
 * Structured Question Engine — Powers BoB's calibration conversations.
 *
 * Given a CalibrationQuestion[] array (from a team template), the engine
 * presents questions, collects answers, and maps them to calibration updates.
 */

import type { CalibrationQuestion, AgentCalibration } from '../types/calibration'

// ---------------------------------------------------------------------------
// Question session state
// ---------------------------------------------------------------------------

export interface QuestionAnswer {
  questionId: string
  selectedValue: string
  selectedLabel: string
}

export interface QuestionSession {
  /** The questions to ask */
  questions: CalibrationQuestion[]
  /** Current question index */
  currentIndex: number
  /** Collected answers */
  answers: QuestionAnswer[]
  /** Whether the session is complete */
  isComplete: boolean
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Create a new question session from a set of calibration questions.
 */
export function createQuestionSession(questions: CalibrationQuestion[]): QuestionSession {
  return {
    questions,
    currentIndex: 0,
    answers: [],
    isComplete: questions.length === 0,
  }
}

/**
 * Get the current question to present.
 */
export function getCurrentQuestion(session: QuestionSession): CalibrationQuestion | null {
  if (session.isComplete) return null
  return session.questions[session.currentIndex] ?? null
}

/**
 * Answer the current question and advance to the next.
 */
export function answerQuestion(session: QuestionSession, value: string): QuestionSession {
  const question = session.questions[session.currentIndex]
  if (!question) return { ...session, isComplete: true }

  const option = question.options.find((o) => o.value === value)
  const answer: QuestionAnswer = {
    questionId: question.id,
    selectedValue: value,
    selectedLabel: option?.label ?? value,
  }

  const newAnswers = [...session.answers, answer]
  const nextIndex = session.currentIndex + 1

  return {
    ...session,
    currentIndex: nextIndex,
    answers: newAnswers,
    isComplete: nextIndex >= session.questions.length,
  }
}

/**
 * Skip the current question (uses defaultOption if available).
 */
export function skipQuestion(session: QuestionSession): QuestionSession {
  const question = session.questions[session.currentIndex]
  if (!question) return { ...session, isComplete: true }

  if (question.defaultOption) {
    return answerQuestion(session, question.defaultOption)
  }

  // No default — just skip
  const nextIndex = session.currentIndex + 1
  return {
    ...session,
    currentIndex: nextIndex,
    isComplete: nextIndex >= session.questions.length,
  }
}

/**
 * Go back to revise a previous answer.
 */
export function goBack(session: QuestionSession): QuestionSession {
  if (session.currentIndex <= 0) return session

  const prevIndex = session.currentIndex - 1
  return {
    ...session,
    currentIndex: prevIndex,
    answers: session.answers.slice(0, prevIndex),
    isComplete: false,
  }
}

// ---------------------------------------------------------------------------
// Answer → Calibration mapping
// ---------------------------------------------------------------------------

/**
 * Map collected answers to calibration updates.
 * Returns partial calibrations keyed by agent role ID.
 */
export function mapAnswersToCalibration(session: QuestionSession): {
  teamGoals: Record<string, string>
  agentCalibrations: Record<string, Partial<AgentCalibration>>
} {
  const teamGoals: Record<string, string> = {}
  const agentCalibrations: Record<string, Partial<AgentCalibration>> = {}

  for (const answer of session.answers) {
    const question = session.questions.find((q) => q.id === answer.questionId)
    if (!question) continue

    // Map answer to calibration based on category
    const update = mapCategoryToCalibration(question.category, answer.selectedValue)

    // Apply to team goals
    if (
      question.category === 'platform' ||
      question.category === 'framework' ||
      question.category === 'language' ||
      question.category === 'testing'
    ) {
      teamGoals[question.category] = answer.selectedValue
    }

    // Apply to agent calibrations
    if (question.appliesTo === '*') {
      // Apply to all roles — use '_all' key
      const existing = agentCalibrations['_all'] ?? {}
      agentCalibrations['_all'] = deepMergePartial(existing, update)
    } else {
      for (const roleId of question.appliesTo) {
        const existing = agentCalibrations[roleId] ?? {}
        agentCalibrations[roleId] = deepMergePartial(existing, update)
      }
    }
  }

  return { teamGoals, agentCalibrations }
}

function mapCategoryToCalibration(category: string, value: string): Partial<AgentCalibration> {
  switch (category) {
    case 'framework':
      return { framework: value }
    case 'testing':
      return { preferences: [`Use ${value} for testing`] }
    case 'dependencies':
      return { constraints: [value] }
    case 'error-handling':
      return { errorEscalation: value as AgentCalibration['errorEscalation'] }
    case 'decision-making':
      return { decisionStyle: value as AgentCalibration['decisionStyle'] }
    case 'communication':
      return { progressReporting: value as AgentCalibration['progressReporting'] }
    case 'code-style':
      return { preferences: [value] }
    default:
      return { preferences: [value] }
  }
}

function deepMergePartial(
  a: Partial<AgentCalibration>,
  b: Partial<AgentCalibration>,
): Partial<AgentCalibration> {
  const result = { ...a, ...b }
  // Merge arrays
  if (a.preferences || b.preferences) {
    result.preferences = [...(a.preferences ?? []), ...(b.preferences ?? [])]
  }
  if (a.constraints || b.constraints) {
    result.constraints = [...(a.constraints ?? []), ...(b.constraints ?? [])]
  }
  return result
}
