/**
 * Phase 5 Verification Test — BoB Orchestrator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EventStore } from '../storage/event-store'
import { ActivityHub } from '../hub/activity-hub'
import { defaultVisibilityRules } from '../hub/visibility-rules'
import { initializeStorage } from '../storage/storage-init'
import { BoBOrchestrator } from '../bob/bob-orchestrator'
import { analyzeTask } from '../bob/task-analyzer'
import { createDefaultCalibration } from '../types/calibration'
import { builtInTemplates } from '../templates/built-in-templates'

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
// Task Analyzer
// ---------------------------------------------------------------------------

describe('TaskAnalyzer', () => {
  const cal = createDefaultCalibration()

  it('classifies build tasks', () => {
    const result = analyzeTask('Build a login page with React', cal, builtInTemplates)
    expect(result.category).toBe('build')
    expect(result.suggestedTemplate).toBe('swe-team')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('classifies fix tasks', () => {
    const result = analyzeTask('Fix the bug in authentication', cal, builtInTemplates)
    expect(result.category).toBe('fix')
    expect(result.suggestedTemplate).toBe('swe-team')
  })

  it('classifies research tasks', () => {
    const result = analyzeTask('Compare React vs Vue for our frontend', cal, builtInTemplates)
    expect(result.category).toBe('research')
    expect(result.suggestedTemplate).toBe('research-team')
  })

  it('classifies content tasks', () => {
    const result = analyzeTask('Write API documentation for the auth module', cal, builtInTemplates)
    expect(result.category).toBe('content')
    expect(result.suggestedTemplate).toBe('content-team')
  })

  it('classifies calibration tasks', () => {
    const result = analyzeTask('Always use TypeScript strict mode', cal, builtInTemplates)
    expect(result.category).toBe('calibrate')
  })

  it('detects calibration conflicts', () => {
    const webCal = { ...cal, workspace: { ...cal.workspace, type: 'web-app' } }
    const result = analyzeTask('Build a mobile app for iOS', webCal, builtInTemplates)
    expect(result.calibrationConflict).toBeTruthy()
    expect(result.calibrationConflict).toContain('mobile')
  })

  it('extracts keywords', () => {
    const result = analyzeTask('Build a React dashboard with authentication', cal, builtInTemplates)
    expect(result.keywords.length).toBeGreaterThan(0)
    expect(result.keywords).toContain('react')
  })
})

// ---------------------------------------------------------------------------
// BoBOrchestrator
// ---------------------------------------------------------------------------

describe('BoBOrchestrator', () => {
  function createBob() {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    return new BoBOrchestrator(hub, ctx)
  }

  it('responds to build tasks with team creation', async () => {
    const bob = createBob()
    const response = await bob.processMessage('Build a login page')

    expect(response.message).toContain('SWE Team')
    expect(response.team).toBeDefined()
    expect(response.team?.templateId).toBe('swe-team')
    expect(response.analysis?.category).toBe('build')
  })

  it('responds to research tasks', async () => {
    const bob = createBob()
    const response = await bob.processMessage('Research the best testing frameworks')

    expect(response.message).toContain('Research Team')
    expect(response.team?.templateId).toBe('research-team')
  })

  it('responds to content tasks', async () => {
    const bob = createBob()
    const response = await bob.processMessage('Write documentation for the API')

    expect(response.message).toContain('Content Team')
    expect(response.team?.templateId).toBe('content-team')
  })

  it('responds to meta/help queries', async () => {
    const bob = createBob()
    const response = await bob.processMessage('What can you do?')

    expect(response.message).toContain('BoB')
    expect(response.message).toContain('team')
  })

  it('responds to ambiguous messages', async () => {
    const bob = createBob()
    const response = await bob.processMessage('xyz 123')

    expect(response.actions).toBeDefined()
    expect(response.actions!.length).toBeGreaterThan(0)
  })

  it('handles calibration "always use" pattern', async () => {
    const bob = createBob()
    const response = await bob.processMessage('Always use TypeScript strict mode')

    expect(response.message).toContain('TypeScript strict mode')
    expect(response.message).toContain('saved')
  })

  it('handles calibration "never use" pattern', async () => {
    const bob = createBob()
    const response = await bob.processMessage('Never use jQuery')

    expect(response.message).toContain('jQuery')
    expect(response.message).toContain('constraint')
  })

  it('stores chat messages', async () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const bob = new BoBOrchestrator(hub, ctx)

    await bob.processMessage('Hello BoB')

    const messages = ctx.events.getMessages('bob')
    expect(messages.length).toBeGreaterThanOrEqual(2) // user + bob response
    expect(messages[0].sender).toBe('user')
    expect(messages[1].sender).toBe('bob')
  })

  it('tracks active teams', async () => {
    const bob = createBob()
    await bob.processMessage('Build a login page')
    await bob.processMessage('Research testing frameworks')

    const teams = bob.getActiveTeams()
    expect(teams).toHaveLength(2)
  })

  it('detects calibration conflict for web workspace + mobile task', async () => {
    const ctx = initializeStorage()
    const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
    const bob = new BoBOrchestrator(hub, ctx)

    // Set workspace type
    ctx.json.write('calibrations', {
      ...createDefaultCalibration(),
      workspace: { name: 'my-app', type: 'web-app', description: '' },
    })

    const response = await bob.processMessage('Build a mobile app for iOS')
    expect(response.message).toContain('mobile')
    expect(response.actions).toBeDefined()
  })
})
