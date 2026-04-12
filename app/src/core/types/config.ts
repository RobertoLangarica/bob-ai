/**
 * App configuration and storage types.
 */

// ---------------------------------------------------------------------------
// App config (.bob/config.json)
// ---------------------------------------------------------------------------

export interface AppConfig {
  /** API configuration */
  api: {
    defaultProvider: 'anthropic' | 'openai' | 'local'
    keys: Record<string, string>
  }

  /** UI preferences */
  ui: {
    verbosityLevel: 'minimal' | 'normal' | 'detailed' | 'debug'
    compactMode: boolean
    theme: 'dark'
  }

  /** Agent defaults */
  agents: {
    defaultModel: string
    maxConcurrentAgents: number
    defaultRetryLimit: number
  }
}

// ---------------------------------------------------------------------------
// Chat message (user ↔ BoB conversation)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  /** 'bob' for BoB chat, team ID for team chats */
  teamId: string
  /** 'user' | 'bob' */
  sender: 'user' | 'bob'
  content: string
  timestamp: number
  /** Optional attached card data */
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Agent metrics (aggregated stats per session)
// ---------------------------------------------------------------------------

export interface AgentMetric {
  id: string
  teamId: string
  agentId: string
  sessionId: string
  metric: string // 'tool_calls' | 'files_changed' | 'tests_run' | etc.
  value: number
  timestamp: number
}

// ---------------------------------------------------------------------------
// Milestone summary (.bob/milestones.json)
// ---------------------------------------------------------------------------

export interface MilestoneSummary {
  milestones: Array<{
    title: string
    team: string
    date: string // ISO 8601
    stats: Record<string, number>
    agents: string[]
    relatedFiles?: string[]
  }>
}

// ---------------------------------------------------------------------------
// Factory: default config
// ---------------------------------------------------------------------------

export function createDefaultConfig(): AppConfig {
  return {
    api: {
      defaultProvider: 'anthropic',
      keys: {},
    },
    ui: {
      verbosityLevel: 'normal',
      compactMode: false,
      theme: 'dark',
    },
    agents: {
      defaultModel: 'claude-sonnet-4-20250514',
      maxConcurrentAgents: 4,
      defaultRetryLimit: 3,
    },
  }
}

export function createDefaultMilestones(): MilestoneSummary {
  return { milestones: [] }
}
