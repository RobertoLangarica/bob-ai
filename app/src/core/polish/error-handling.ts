/**
 * Error Handling — Graceful error management for agent failures.
 *
 * Provides retry logic, error classification, and user-facing error messages.
 * Agent errors marked `recoverable: true` trigger automatic retry.
 */

import type { ActivityEvent } from '../types/events'
import { EventTypes } from '../types/events'

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export interface ClassifiedError {
  /** Original event */
  event: ActivityEvent
  /** Whether the error can be retried */
  recoverable: boolean
  /** Human-readable error message */
  message: string
  /** Suggested action for the user */
  suggestion: string
  /** Error category */
  category: 'agent' | 'tool' | 'network' | 'auth' | 'unknown'
}

/**
 * Classify an error event into a user-friendly structure.
 */
export function classifyError(event: ActivityEvent): ClassifiedError {
  const payload = event.payload as {
    error?: string
    recoverable?: boolean
    tool?: string
  }

  const errorMsg = payload.error ?? 'Unknown error occurred'
  const recoverable = payload.recoverable ?? false

  // Determine category from error message patterns
  const category = categorizeError(errorMsg, event.type)

  return {
    event,
    recoverable,
    message: errorMsg,
    suggestion: getSuggestion(category, recoverable),
    category,
  }
}

function categorizeError(
  message: string,
  eventType: string,
): 'agent' | 'tool' | 'network' | 'auth' | 'unknown' {
  const lower = message.toLowerCase()

  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'auth'
  }
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('fetch')
  ) {
    return 'network'
  }
  if (eventType === EventTypes.TOOL_ERROR || eventType.startsWith('tool.')) {
    return 'tool'
  }
  if (eventType === EventTypes.AGENT_ERROR) {
    return 'agent'
  }
  return 'unknown'
}

function getSuggestion(category: string, recoverable: boolean): string {
  if (recoverable) {
    return 'This error may resolve on retry. BoB will attempt to retry automatically.'
  }

  switch (category) {
    case 'auth':
      return 'Check your API key configuration in settings.'
    case 'network':
      return 'Check your network connection and try again.'
    case 'tool':
      return 'A tool execution failed. You can retry the task or try a different approach.'
    case 'agent':
      return 'An agent encountered an error. You can retry or dismiss.'
    default:
      return 'An unexpected error occurred. You can retry or start a new task.'
  }
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

export interface RetryState {
  teamId: string
  agentId: string
  attempts: number
  maxAttempts: number
  lastError: string
}

/**
 * Determine if a retry should be attempted for an error event.
 */
export function shouldRetry(
  error: ClassifiedError,
  currentAttempts: number,
  maxRetries: number,
): boolean {
  if (!error.recoverable) return false
  if (currentAttempts >= maxRetries) return false

  // Don't retry auth errors — they need user action
  if (error.category === 'auth') return false

  return true
}

// ---------------------------------------------------------------------------
// Error event extraction
// ---------------------------------------------------------------------------

/**
 * Extract all error events from a list of activity events.
 */
export function extractErrors(events: ActivityEvent[]): ClassifiedError[] {
  return events
    .filter((e) => e.type === EventTypes.AGENT_ERROR || e.type === EventTypes.TOOL_ERROR)
    .map(classifyError)
}
