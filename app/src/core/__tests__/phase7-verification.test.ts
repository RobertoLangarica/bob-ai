/**
 * Phase 7 Verification Test — Polish & Edge Cases
 *
 * Tests milestone extraction, session restoration, error handling,
 * empty state detection, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ActivityHub } from '../hub/activity-hub'
import { defaultVisibilityRules } from '../hub/visibility-rules'
import { initializeStorage } from '../storage/storage-init'
import { EventTypes } from '../types/events'
import type { ActivityEvent } from '../types/events'
import { MilestoneExtractor } from '../polish/milestone-extractor'
import {
  analyzeSession,
  markTeamsActive,
  clearActiveTeams,
  createInterruptionNotice,
} from '../polish/session-restore'
import { classifyError, shouldRetry, extractErrors } from '../polish/error-handling'
import { detectEmptyState } from '../polish/empty-states'

// Mock localStorage
const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  get length() {
    return storage.size
  },
  key: (i: number) => [...storage.keys()][i] ?? null,
  clear: () => storage.clear(),
}
beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true })
})

// ---------------------------------------------------------------------------
// MilestoneExtractor
// ---------------------------------------------------------------------------

describe('MilestoneExtractor', () => {
  it('captures milestone events and persists them', () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const extractor = new MilestoneExtractor(hub, ctx.json)

    extractor.start()

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Login page complete',
      stats: { files: 4, tests: 8, agents: 2 },
    })

    const milestones = extractor.getMilestones()
    expect(milestones.milestones).toHaveLength(1)
    expect(milestones.milestones[0].title).toBe('Login page complete')
    expect(milestones.milestones[0].team).toBe('team-1')
    expect(milestones.milestones[0].stats.files).toBe(4)
  })

  it('appends multiple milestones', () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const extractor = new MilestoneExtractor(hub, ctx.json)

    extractor.start()

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Auth complete',
      stats: { files: 2 },
    })
    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Dashboard ready',
      stats: { files: 5 },
    })

    const milestones = extractor.getMilestones()
    expect(milestones.milestones).toHaveLength(2)
    expect(milestones.milestones[1].title).toBe('Dashboard ready')
  })

  it('stops capturing when stopped', () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const extractor = new MilestoneExtractor(hub, ctx.json)

    extractor.start()

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'First',
      stats: {},
    })

    extractor.stop()

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Second',
      stats: {},
    })

    const milestones = extractor.getMilestones()
    expect(milestones.milestones).toHaveLength(1)
  })

  it('ignores non-milestone events', () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const extractor = new MilestoneExtractor(hub, ctx.json)

    extractor.start()

    hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'test.ts', additions: 10 }],
    })

    const milestones = extractor.getMilestones()
    expect(milestones.milestones).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Session Restore
// ---------------------------------------------------------------------------

describe('SessionRestore', () => {
  it('detects fresh workspace', () => {
    const ctx = initializeStorage()
    const session = analyzeSession(ctx)

    expect(session.isFresh).toBe(true)
    expect(session.hasInterruptedTeams).toBe(false)
    expect(session.messageCount).toBe(0)
  })

  it('detects existing session with messages', () => {
    const ctx = initializeStorage()

    // Insert some messages
    ctx.events.insertMessage({
      id: '1',
      teamId: 'bob',
      sender: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    })
    ctx.events.insertMessage({
      id: '2',
      teamId: 'bob',
      sender: 'bob',
      content: 'Hi!',
      timestamp: Date.now(),
    })

    const session = analyzeSession(ctx)
    expect(session.isFresh).toBe(false)
    expect(session.messageCount).toBe(2)
  })

  it('marks and detects interrupted teams', () => {
    const ctx = initializeStorage()

    // Simulate app startup — no interrupted teams
    let session = analyzeSession(ctx)
    expect(session.hasInterruptedTeams).toBe(false)

    // Mark teams active (simulating work starting)
    markTeamsActive(ctx, ['team-1', 'team-2'])

    // Simulate crash — analyze again without clearing
    session = analyzeSession(ctx)
    expect(session.hasInterruptedTeams).toBe(true)
    expect(session.interruptedTeamIds).toEqual(['team-1', 'team-2'])
  })

  it('clears active teams on clean shutdown', () => {
    const ctx = initializeStorage()

    markTeamsActive(ctx, ['team-1'])
    clearActiveTeams(ctx)

    const session = analyzeSession(ctx)
    expect(session.hasInterruptedTeams).toBe(false)
  })

  it('creates interruption notice message', () => {
    const notice = createInterruptionNotice(['team-1', 'team-2'])

    expect(notice.sender).toBe('bob')
    expect(notice.teamId).toBe('bob')
    expect(notice.content).toContain('interrupted')
    expect(notice.content).toContain('some teams were')
    expect(notice.metadata?.type).toBe('system-notice')
  })

  it('creates singular interruption notice for one team', () => {
    const notice = createInterruptionNotice(['team-1'])
    expect(notice.content).toContain('a team was')
  })
})

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

describe('ErrorHandling', () => {
  function makeErrorEvent(
    error: string,
    recoverable: boolean,
    type = EventTypes.AGENT_ERROR,
  ): ActivityEvent {
    return {
      id: 'err-1',
      timestamp: Date.now(),
      teamId: 'team-1',
      agentId: 'ui',
      type,
      payload: { error, recoverable },
      visibility: 'timeline',
    }
  }

  it('classifies agent errors', () => {
    const event = makeErrorEvent('Agent failed to complete task', false)
    const classified = classifyError(event)

    expect(classified.category).toBe('agent')
    expect(classified.recoverable).toBe(false)
    expect(classified.message).toBe('Agent failed to complete task')
  })

  it('classifies auth errors', () => {
    const event = makeErrorEvent('API key is invalid (401 Unauthorized)', false)
    const classified = classifyError(event)

    expect(classified.category).toBe('auth')
    expect(classified.suggestion).toContain('API key')
  })

  it('classifies network errors', () => {
    const event = makeErrorEvent('Network timeout after 30s', true)
    const classified = classifyError(event)

    expect(classified.category).toBe('network')
    expect(classified.recoverable).toBe(true)
  })

  it('classifies tool errors', () => {
    const event = makeErrorEvent('Command failed', false, EventTypes.TOOL_ERROR)
    const classified = classifyError(event)

    expect(classified.category).toBe('tool')
  })

  it('shouldRetry returns true for recoverable errors under limit', () => {
    const event = makeErrorEvent('Temporary failure', true)
    const classified = classifyError(event)

    expect(shouldRetry(classified, 0, 3)).toBe(true)
    expect(shouldRetry(classified, 2, 3)).toBe(true)
    expect(shouldRetry(classified, 3, 3)).toBe(false)
  })

  it('shouldRetry returns false for non-recoverable errors', () => {
    const event = makeErrorEvent('Fatal error', false)
    const classified = classifyError(event)

    expect(shouldRetry(classified, 0, 3)).toBe(false)
  })

  it('shouldRetry returns false for auth errors even if recoverable', () => {
    const event = makeErrorEvent('401 Unauthorized', true)
    const classified = classifyError(event)

    expect(classified.category).toBe('auth')
    expect(shouldRetry(classified, 0, 3)).toBe(false)
  })

  it('extractErrors filters only error events', () => {
    const events: ActivityEvent[] = [
      makeErrorEvent('Error 1', true),
      {
        id: 'ok-1',
        timestamp: Date.now(),
        teamId: 'team-1',
        agentId: 'ui',
        type: EventTypes.CODE_CHANGED,
        payload: { files: [] },
        visibility: 'timeline',
      },
      makeErrorEvent('Error 2', false),
    ]

    const errors = extractErrors(events)
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toBe('Error 1')
    expect(errors[1].message).toBe('Error 2')
  })
})

// ---------------------------------------------------------------------------
// Empty States
// ---------------------------------------------------------------------------

describe('EmptyStates', () => {
  it('detects fresh workspace empty state', () => {
    const ctx = initializeStorage()
    const state = detectEmptyState(ctx, 'bob', [])

    expect(state).not.toBeNull()
    expect(state!.kind).toBe('fresh-workspace')
    expect(state!.title).toContain('Welcome')
  })

  it('detects no-teams empty state', () => {
    const ctx = initializeStorage()

    // Add a message so it's not "fresh"
    ctx.events.insertMessage({
      id: '1',
      teamId: 'bob',
      sender: 'bob',
      content: 'Welcome!',
      timestamp: Date.now(),
    })
    ctx.events.insertMessage({
      id: '2',
      teamId: 'bob',
      sender: 'user',
      content: 'Hi',
      timestamp: Date.now(),
    })

    const state = detectEmptyState(ctx, 'bob', [])
    expect(state).not.toBeNull()
    expect(state!.kind).toBe('no-teams')
  })

  it('detects empty team state', () => {
    const ctx = initializeStorage()

    // Add bob messages so not fresh
    ctx.events.insertMessage({
      id: '1',
      teamId: 'bob',
      sender: 'bob',
      content: 'Created team',
      timestamp: Date.now(),
    })
    ctx.events.insertMessage({
      id: '2',
      teamId: 'bob',
      sender: 'user',
      content: 'ok',
      timestamp: Date.now(),
    })

    const teams = [
      {
        id: 'team-1',
        name: 'SWE Team',
        templateId: 'swe-team',
        roles: [],
        status: 'idle' as const,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      },
    ]

    const state = detectEmptyState(ctx, 'team-1', teams)
    expect(state).not.toBeNull()
    expect(state!.kind).toBe('empty-team')
  })

  it('returns null when content exists', () => {
    const ctx = initializeStorage()

    // Add messages for bob and team
    ctx.events.insertMessage({
      id: '1',
      teamId: 'bob',
      sender: 'bob',
      content: 'Working...',
      timestamp: Date.now(),
    })
    ctx.events.insertMessage({
      id: '2',
      teamId: 'bob',
      sender: 'user',
      content: 'ok',
      timestamp: Date.now(),
    })
    ctx.events.insertMessage({
      id: '3',
      teamId: 'team-1',
      sender: 'user',
      content: 'Build a form',
      timestamp: Date.now(),
    })

    const teams = [
      {
        id: 'team-1',
        name: 'SWE Team',
        templateId: 'swe-team',
        roles: [],
        status: 'working' as const,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      },
    ]

    const state = detectEmptyState(ctx, 'team-1', teams)
    expect(state).toBeNull()
  })
})
