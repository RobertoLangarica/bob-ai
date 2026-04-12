/**
 * Phase 2 Verification Test
 *
 * Tests agent integration: spawning, debrief, tools, lifecycle, and error retry.
 *
 * This verifies:
 * 1. Agent spawn emits lifecycle events to the hub
 * 2. Debrief tool reads calibration and emits debrief event
 * 3. Agent tools emit correct event types
 * 4. Error retry logic respects calibration limits
 * 5. Calibration injector produces deterministic prompt text
 */

import { describe, it, expect } from 'vitest'
import { EventStore } from '../storage/event-store'
import { ActivityHub } from '../hub/activity-hub'
import { defaultVisibilityRules } from '../hub/visibility-rules'
import { AgentSpawner } from '../agents/agent-spawner'
import { createAgentTools, StorageDebriefReader } from '../agents/agent-tools-factory'
import { injectCalibration, buildAgentSystemPrompt } from '../agents/calibration-injector'
import { createDefaultAgentCalibration } from '../types/calibration'
import type { AgentCalibration } from '../types/calibration'
import type { AgentRole } from '../types/teams'
import type { ActivityEvent } from '../types/events'

function createTestHub() {
  const store = new EventStore(false)
  const hub = new ActivityHub(store, defaultVisibilityRules)
  return { hub, store }
}

function createTestRole(id = 'ui'): AgentRole {
  return {
    id,
    name: 'UI Developer',
    role: 'Frontend',
    description: 'Builds user-facing components',
    systemPromptTemplate: 'You are a UI developer.',
    specializations: ['web', 'mobile'],
    tools: ['read_file', 'write_file', 'terminal'],
    defaultCalibration: createDefaultAgentCalibration(),
  }
}

// ---------------------------------------------------------------------------
// 1. Agent spawn emits lifecycle events
// ---------------------------------------------------------------------------

describe('Agent spawning', () => {
  it('spawns an agent and emits agent.spawned event', async () => {
    const { hub, store } = createTestHub()
    const spawner = new AgentSpawner(hub)
    const calibration = createDefaultAgentCalibration()

    const agent = await spawner.spawn({
      teamId: 'team-1',
      role: createTestRole(),
      task: 'Build login form',
      calibration,
      workingDirectory: '/tmp/test',
      useWorktree: false,
    })

    expect(agent.id).toBeDefined()
    expect(agent.status).toBe('debriefing')
    expect(agent.teamId).toBe('team-1')

    // Check spawned event in store
    const events = store.queryEvents({ teamId: 'team-1', type: 'agent.spawned' })
    expect(events).toHaveLength(1)
    expect((events[0].payload as { role: string }).role).toBe('UI Developer')
  })

  it('tracks multiple agents per team', async () => {
    const { hub } = createTestHub()
    const spawner = new AgentSpawner(hub)
    const cal = createDefaultAgentCalibration()

    await spawner.spawn({
      teamId: 'team-1',
      role: createTestRole('ui'),
      task: 'UI work',
      calibration: cal,
      workingDirectory: '/tmp',
      useWorktree: false,
    })
    await spawner.spawn({
      teamId: 'team-1',
      role: createTestRole('backend'),
      task: 'Backend work',
      calibration: cal,
      workingDirectory: '/tmp',
      useWorktree: false,
    })

    const agents = spawner.getTeamAgents('team-1')
    expect(agents).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 2. Debrief tool reads calibration
// ---------------------------------------------------------------------------

describe('Debrief tool', () => {
  it('reads calibration and emits debrief event', async () => {
    const { hub, store } = createTestHub()

    const calibration: AgentCalibration = {
      ...createDefaultAgentCalibration(),
      framework: 'React',
      specialization: 'web',
      preferences: ['TypeScript strict mode'],
    }

    const debriefReader = new StorageDebriefReader(
      () => calibration,
      () => ['Build login page', 'Add tests'],
    )

    const tools = createAgentTools(hub, 'team-1', 'ui-agent', calibration, debriefReader)
    const result = await tools.debrief()

    expect(result.context).toContain('React')
    expect(result.context).toContain('web')
    expect(result.calibration.framework).toBe('React')
    expect(result.teamGoals).toEqual(['Build login page', 'Add tests'])

    // Check debrief event
    const events = store.queryEvents({ type: 'agent.debriefed' })
    expect(events).toHaveLength(1)
    expect((events[0].payload as { context: string }).context).toContain('React')
  })
})

// ---------------------------------------------------------------------------
// 3. Agent tools emit correct events
// ---------------------------------------------------------------------------

describe('Agent tools', () => {
  it('emit() sends events with correct teamId and agentId', () => {
    const { hub, store } = createTestHub()
    const cal = createDefaultAgentCalibration()
    const reader = new StorageDebriefReader(
      () => cal,
      () => [],
    )

    const tools = createAgentTools(hub, 'team-1', 'ui-agent', cal, reader)
    tools.emit('tool.invoke', { tool: 'read_file', args: 'src/App.vue' })

    const events = store.queryEvents({ teamId: 'team-1' })
    expect(events).toHaveLength(1)
    expect(events[0].agentId).toBe('ui-agent')
    expect(events[0].type).toBe('tool.invoke')
  })

  it('reportProgress emits goal.progress', () => {
    const { hub, store } = createTestHub()
    const cal = createDefaultAgentCalibration()
    const reader = new StorageDebriefReader(
      () => cal,
      () => [],
    )

    const tools = createAgentTools(hub, 'team-1', 'ui-agent', cal, reader)
    tools.reportProgress('login-form', 0.5, 'Form layout complete')

    const events = store.queryEvents({ type: 'goal.progress' })
    expect(events).toHaveLength(1)
    expect((events[0].payload as { progress: number }).progress).toBe(0.5)
  })

  it('reportMilestone emits milestone.achieved', () => {
    const { hub, store } = createTestHub()
    const cal = createDefaultAgentCalibration()
    const reader = new StorageDebriefReader(
      () => cal,
      () => [],
    )

    const tools = createAgentTools(hub, 'team-1', 'lead', cal, reader)
    tools.reportMilestone('Login page complete', { files: 4, tests: 8 })

    const events = store.queryEvents({ type: 'milestone.achieved' })
    expect(events).toHaveLength(1)
    expect((events[0].payload as { title: string }).title).toBe('Login page complete')
  })

  it('reportProgress clamps progress between 0 and 1', () => {
    const { hub, store } = createTestHub()
    const cal = createDefaultAgentCalibration()
    const reader = new StorageDebriefReader(
      () => cal,
      () => [],
    )

    const tools = createAgentTools(hub, 'team-1', 'ui', cal, reader)
    tools.reportProgress('test', 1.5, 'Over-reported')
    tools.reportProgress('test', -0.3, 'Under-reported')

    const events = store.queryEvents({ type: 'goal.progress' })
    expect((events[0].payload as { progress: number }).progress).toBe(1)
    expect((events[1].payload as { progress: number }).progress).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Error retry logic
// ---------------------------------------------------------------------------

describe('Error retry logic', () => {
  it('retries recoverable errors up to maxRetries', async () => {
    const { hub } = createTestHub()
    const spawner = new AgentSpawner(hub)

    const agent = await spawner.spawn({
      teamId: 'team-1',
      role: createTestRole(),
      task: 'Test task',
      calibration: { ...createDefaultAgentCalibration(), retryLimit: 2 },
      workingDirectory: '/tmp',
      useWorktree: false,
    })

    // First retry — should succeed
    const retry1 = spawner.handleError(agent.id, 'ENOSPC', true)
    expect(retry1).toBe(true)
    expect(spawner.getAgent(agent.id)?.retryCount).toBe(1)

    // Second retry — should succeed
    const retry2 = spawner.handleError(agent.id, 'ENOSPC', true)
    expect(retry2).toBe(true)
    expect(spawner.getAgent(agent.id)?.retryCount).toBe(2)

    // Third retry — should fail (exceeded limit)
    const retry3 = spawner.handleError(agent.id, 'ENOSPC', true)
    expect(retry3).toBe(false)
    expect(spawner.getAgent(agent.id)?.status).toBe('error')
  })

  it('non-recoverable errors do not retry', async () => {
    const { hub } = createTestHub()
    const spawner = new AgentSpawner(hub)

    const agent = await spawner.spawn({
      teamId: 'team-1',
      role: createTestRole(),
      task: 'Test task',
      calibration: createDefaultAgentCalibration(),
      workingDirectory: '/tmp',
      useWorktree: false,
    })

    const shouldRetry = spawner.handleError(agent.id, 'Fatal error', false)
    expect(shouldRetry).toBe(false)
    expect(spawner.getAgent(agent.id)?.status).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// 5. Calibration injector
// ---------------------------------------------------------------------------

describe('Calibration injector', () => {
  it('produces deterministic output', () => {
    const cal: AgentCalibration = {
      framework: 'Vue 3',
      specialization: 'web',
      preferences: ['Composition API', 'TypeScript strict'],
      constraints: ['No jQuery', 'No class components'],
      decisionStyle: 'ask-on-major',
      retryLimit: 3,
      errorEscalation: 'report-and-continue',
      progressReporting: 'milestone-based',
    }

    const result1 = injectCalibration(cal)
    const result2 = injectCalibration(cal)
    expect(result1).toBe(result2) // Deterministic

    expect(result1).toContain('Vue 3')
    expect(result1).toContain('web')
    expect(result1).toContain('Composition API')
    expect(result1).toContain('No jQuery')
    expect(result1).toContain('CALIBRATION')
  })

  it('returns empty string for empty calibration', () => {
    const cal = createDefaultAgentCalibration()
    cal.decisionStyle = undefined
    cal.errorEscalation = undefined
    cal.progressReporting = undefined
    const result = injectCalibration(cal)
    expect(result).toBe('')
  })

  it('buildAgentSystemPrompt includes all sections', () => {
    const cal: AgentCalibration = {
      ...createDefaultAgentCalibration(),
      framework: 'React',
    }

    const prompt = buildAgentSystemPrompt('You are a UI developer.', cal, 'Build a login form')

    expect(prompt).toContain('You are a UI developer.')
    expect(prompt).toContain('React')
    expect(prompt).toContain('debrief')
    expect(prompt).toContain('Build a login form')
  })
})
