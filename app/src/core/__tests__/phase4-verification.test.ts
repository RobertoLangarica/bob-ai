/**
 * Phase 4 Verification Test — Team Templates
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { JSONStore } from '../storage/json-store'
import {
  builtInTemplates,
  sweTeamTemplate,
  researchTeamTemplate,
  contentTeamTemplate,
} from '../templates/built-in-templates'
import { findMatchingSpecialists, findSpecialistForRole } from '../templates/specialist-catalog'
import { TemplateStore } from '../templates/template-store'
import { createTeamInstance } from '../templates/team-factory'
import { createDefaultCalibration } from '../types/calibration'

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
// Built-in templates
// ---------------------------------------------------------------------------

describe('Built-in templates', () => {
  it('ships 3 templates', () => {
    expect(builtInTemplates).toHaveLength(3)
    expect(builtInTemplates.map((t) => t.id)).toEqual(['swe-team', 'research-team', 'content-team'])
  })

  it('SWE team has required roles', () => {
    const roleIds = sweTeamTemplate.roles.map((r) => r.id)
    expect(roleIds).toContain('lead')
    expect(roleIds).toContain('ui')
    expect(roleIds).toContain('backend')
    expect(roleIds).toContain('reviewer')
  })

  it('research team has required roles', () => {
    const roleIds = researchTeamTemplate.roles.map((r) => r.id)
    expect(roleIds).toContain('lead')
    expect(roleIds).toContain('analyst')
    expect(roleIds).toContain('scout')
  })

  it('content team has required roles', () => {
    const roleIds = contentTeamTemplate.roles.map((r) => r.id)
    expect(roleIds).toContain('lead')
    expect(roleIds).toContain('writer')
    expect(roleIds).toContain('editor')
  })

  it('all roles have system prompt templates', () => {
    for (const t of builtInTemplates) {
      for (const role of t.roles) {
        expect(role.systemPromptTemplate.length).toBeGreaterThan(10)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Specialist catalog
// ---------------------------------------------------------------------------

describe('Specialist catalog', () => {
  it('matches mobile-related tasks to mobile specialist', () => {
    const matches = findMatchingSpecialists('Build an iOS app with React Native')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].id).toBe('mobile-ui')
  })

  it('matches web tasks to web specialist', () => {
    const specialist = findSpecialistForRole('ui', 'Build a React web dashboard')
    expect(specialist?.id).toBe('web-ui')
  })

  it('matches database tasks to database specialist', () => {
    const specialist = findSpecialistForRole('backend', 'Create PostgreSQL schema')
    expect(specialist?.id).toBe('db-backend')
  })

  it('returns null for no match', () => {
    const specialist = findSpecialistForRole('reviewer', 'just review')
    expect(specialist).toBeNull()
  })

  it('framework keywords score higher', () => {
    const matches = findMatchingSpecialists('Build with Vue')
    const webUi = matches.find((m) => m.id === 'web-ui')
    expect(webUi).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// TemplateStore
// ---------------------------------------------------------------------------

describe('TemplateStore', () => {
  it('lists built-in templates', () => {
    const store = new TemplateStore(new JSONStore())
    const all = store.listAll()
    expect(all.length).toBeGreaterThanOrEqual(3)
  })

  it('gets built-in by ID', () => {
    const store = new TemplateStore(new JSONStore())
    const swe = store.getById('swe-team')
    expect(swe?.name).toBe('SWE Team')
  })

  it('returns null for unknown ID', () => {
    const store = new TemplateStore(new JSONStore())
    expect(store.getById('nonexistent')).toBeNull()
  })

  it('custom template overrides built-in', () => {
    const store = new TemplateStore(new JSONStore())
    const custom = { ...sweTeamTemplate, name: 'My Custom SWE' }
    store.save(custom)

    const result = store.getById('swe-team')
    expect(result?.name).toBe('My Custom SWE')
  })
})

// ---------------------------------------------------------------------------
// TeamFactory
// ---------------------------------------------------------------------------

describe('TeamFactory', () => {
  it('creates team instance from template', () => {
    const cal = createDefaultCalibration()
    const team = createTeamInstance(sweTeamTemplate, 'Build a web app', cal)

    expect(team.id).toBeDefined()
    expect(team.templateId).toBe('swe-team')
    expect(team.status).toBe('idle')
    expect(team.roles.length).toBe(sweTeamTemplate.roles.length)
  })

  it('swaps specialists based on task keywords', () => {
    const cal = createDefaultCalibration()
    cal.workspace.type = 'mobile-app'

    const team = createTeamInstance(sweTeamTemplate, 'Build a mobile app for iOS', cal)
    const uiRole = team.roles.find((r) => r.id === 'ui')
    expect(uiRole?.name).toBe('Mobile UI Developer')
    expect(uiRole?.defaultCalibration.specialization).toBe('mobile')
  })

  it('applies workspace calibrations to roles', () => {
    const cal = createDefaultCalibration()
    cal.agentCalibrations['ui'] = {
      preferences: ['Use Tailwind CSS'],
      constraints: [],
      framework: 'Vue',
    }

    const team = createTeamInstance(sweTeamTemplate, 'Build a web app', cal)
    const uiRole = team.roles.find((r) => r.id === 'ui')
    expect(uiRole?.defaultCalibration.preferences).toContain('Use Tailwind CSS')
    expect(uiRole?.defaultCalibration.framework).toBe('Vue')
  })

  it('preserves non-matched roles unchanged', () => {
    const cal = createDefaultCalibration()
    const team = createTeamInstance(sweTeamTemplate, 'Refactor the code', cal)
    const lead = team.roles.find((r) => r.id === 'lead')
    expect(lead?.name).toBe('Team Lead') // No specialist swap for lead
  })
})
