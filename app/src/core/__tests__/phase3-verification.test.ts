/**
 * Phase 3 Verification Test — Calibration System
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { JSONStore } from '../storage/json-store'
import { CalibrationStore } from '../calibration/calibration-store'
import {
  GLOBAL_DEFAULTS,
  SessionOverrides,
  mergeCalibrations,
  buildEffectiveCalibration,
} from '../calibration/calibration-merger'
import {
  createQuestionSession,
  getCurrentQuestion,
  answerQuestion,
  skipQuestion,
  goBack,
  mapAnswersToCalibration,
} from '../calibration/question-engine'
import type { CalibrationQuestion } from '../types/calibration'

// Mock localStorage for tests
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

// Inject mock
beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true })
})

// ---------------------------------------------------------------------------
// CalibrationStore
// ---------------------------------------------------------------------------

describe('CalibrationStore', () => {
  it('reads default calibration when none exists', () => {
    const store = new CalibrationStore(new JSONStore())
    const cal = store.read()
    expect(cal.workspace.name).toBe('')
    expect(cal.teamDefaults.constraints).toEqual([])
    expect(cal.agentCalibrations).toEqual({})
  })

  it('surgical update to workspace identity', () => {
    const store = new CalibrationStore(new JSONStore())
    store.updateWorkspace({ name: 'my-app', type: 'mobile-app' })

    const cal = store.read()
    expect(cal.workspace.name).toBe('my-app')
    expect(cal.workspace.type).toBe('mobile-app')
  })

  it('surgical update to agent calibration merges arrays', () => {
    const store = new CalibrationStore(new JSONStore())
    store.updateAgentCalibration('ui', { framework: 'React', preferences: ['TypeScript'] })
    store.updateAgentCalibration('ui', { preferences: ['Hooks only'] })

    const cal = store.getAgentCalibration('ui')
    expect(cal.framework).toBe('React')
    expect(cal.preferences).toContain('TypeScript')
    expect(cal.preferences).toContain('Hooks only')
  })

  it('adds constraints without duplicates', () => {
    const store = new CalibrationStore(new JSONStore())
    store.addConstraint('No jQuery')
    store.addConstraint('No jQuery') // duplicate
    store.addConstraint('No class components')

    const cal = store.read()
    expect(cal.teamDefaults.constraints).toEqual(['No jQuery', 'No class components'])
  })

  it('records milestones in history', () => {
    const store = new CalibrationStore(new JSONStore())
    store.recordMilestone('Login page complete')
    store.recordMilestone('Auth API ready')

    const cal = store.read()
    expect(cal.history.milestonesAchieved).toHaveLength(2)
    expect(cal.history.totalTasks).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// CalibrationMerger
// ---------------------------------------------------------------------------

describe('CalibrationMerger', () => {
  it('merges 4 layers with correct priority', () => {
    const result = mergeCalibrations(
      GLOBAL_DEFAULTS,
      { framework: 'React' }, // template default
      { framework: 'Vue' }, // workspace override
      {}, // no session override
    )
    expect(result.framework).toBe('Vue') // workspace wins over template
    expect(result.decisionStyle).toBe('ask-on-major') // inherited from global
  })

  it('session override trumps everything', () => {
    const result = mergeCalibrations(
      GLOBAL_DEFAULTS,
      { framework: 'React' },
      { framework: 'Vue' },
      { framework: 'Svelte' },
    )
    expect(result.framework).toBe('Svelte')
  })

  it('merges arrays across layers', () => {
    const result = mergeCalibrations(
      { ...GLOBAL_DEFAULTS, preferences: ['Global pref'] },
      { preferences: ['Template pref'] },
      { preferences: ['Workspace pref'] },
      { preferences: ['Session pref'] },
    )
    expect(result.preferences).toContain('Global pref')
    expect(result.preferences).toContain('Template pref')
    expect(result.preferences).toContain('Workspace pref')
    expect(result.preferences).toContain('Session pref')
  })
})

describe('SessionOverrides', () => {
  it('stores and retrieves per-agent overrides', () => {
    const session = new SessionOverrides()
    session.setForAgent('ui', { framework: 'Svelte' })

    const override = session.getForAgent('ui')
    expect(override.framework).toBe('Svelte')
    expect(session.getForAgent('backend').framework).toBeUndefined()
  })

  it('global override applies to all agents', () => {
    const session = new SessionOverrides()
    session.setGlobal({ progressReporting: 'verbose' })

    expect(session.getForAgent('ui').progressReporting).toBe('verbose')
    expect(session.getForAgent('backend').progressReporting).toBe('verbose')
  })

  it('agent-specific override trumps global', () => {
    const session = new SessionOverrides()
    session.setGlobal({ framework: 'React' })
    session.setForAgent('ui', { framework: 'Vue' })

    expect(session.getForAgent('ui').framework).toBe('Vue')
    expect(session.getForAgent('backend').framework).toBe('React')
  })

  it('clear removes all overrides', () => {
    const session = new SessionOverrides()
    session.setGlobal({ framework: 'React' })
    session.setForAgent('ui', { framework: 'Vue' })
    session.clear()

    expect(session.getForAgent('ui').framework).toBeUndefined()
  })

  it('buildEffectiveCalibration merges all layers', () => {
    const session = new SessionOverrides()
    session.setForAgent('ui', { framework: 'Svelte' })

    const result = buildEffectiveCalibration(
      'ui',
      { framework: 'React' }, // template
      { preferences: ['TypeScript'] }, // workspace
      session,
    )
    expect(result.framework).toBe('Svelte') // session wins
    expect(result.preferences).toContain('TypeScript')
    expect(result.decisionStyle).toBe('ask-on-major') // from global
  })
})

// ---------------------------------------------------------------------------
// Question Engine
// ---------------------------------------------------------------------------

const testQuestions: CalibrationQuestion[] = [
  {
    id: 'q-platform',
    question: 'What platform?',
    category: 'platform',
    options: [
      { label: 'Web', value: 'web' },
      { label: 'Mobile', value: 'mobile' },
    ],
    appliesTo: '*',
    defaultOption: 'web',
  },
  {
    id: 'q-framework',
    question: 'Which framework?',
    category: 'framework',
    options: [
      { label: 'React', value: 'React' },
      { label: 'Vue', value: 'Vue' },
    ],
    appliesTo: ['ui'],
  },
  {
    id: 'q-testing',
    question: 'Testing approach?',
    category: 'testing',
    options: [
      { label: 'Vitest', value: 'Vitest' },
      { label: 'Jest', value: 'Jest' },
    ],
    appliesTo: '*',
    defaultOption: 'Vitest',
  },
]

describe('Question Engine', () => {
  it('creates session and gets first question', () => {
    const session = createQuestionSession(testQuestions)
    expect(session.currentIndex).toBe(0)
    expect(session.isComplete).toBe(false)

    const q = getCurrentQuestion(session)
    expect(q?.id).toBe('q-platform')
  })

  it('answers advance through questions', () => {
    let session = createQuestionSession(testQuestions)
    session = answerQuestion(session, 'web')
    expect(session.currentIndex).toBe(1)
    expect(session.answers).toHaveLength(1)

    session = answerQuestion(session, 'Vue')
    session = answerQuestion(session, 'Vitest')
    expect(session.isComplete).toBe(true)
    expect(session.answers).toHaveLength(3)
  })

  it('skip uses default option', () => {
    let session = createQuestionSession(testQuestions)
    session = skipQuestion(session) // uses default 'web'
    expect(session.answers[0].selectedValue).toBe('web')
  })

  it('goBack revises previous answer', () => {
    let session = createQuestionSession(testQuestions)
    session = answerQuestion(session, 'web')
    session = answerQuestion(session, 'React')
    expect(session.currentIndex).toBe(2)

    session = goBack(session)
    expect(session.currentIndex).toBe(1)
    expect(session.answers).toHaveLength(1) // second answer removed
  })

  it('maps answers to calibration', () => {
    let session = createQuestionSession(testQuestions)
    session = answerQuestion(session, 'mobile')
    session = answerQuestion(session, 'React')
    session = answerQuestion(session, 'Vitest')

    const result = mapAnswersToCalibration(session)
    expect(result.teamGoals.platform).toBe('mobile')
    expect(result.teamGoals.framework).toBe('React')
    expect(result.agentCalibrations['ui']?.framework).toBe('React')
    expect(result.agentCalibrations['_all']?.preferences).toContain('Use Vitest for testing')
  })

  it('empty questions produces complete session', () => {
    const session = createQuestionSession([])
    expect(session.isComplete).toBe(true)
    expect(getCurrentQuestion(session)).toBeNull()
  })
})
