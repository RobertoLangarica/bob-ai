/**
 * Phase 6 Verification Test — Timeline & UI Integration
 *
 * Tests the TimelineManager, Pinia stores, and the integration between
 * the core event system and the UI data layer.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EventStore } from '../storage/event-store'
import { ActivityHub } from '../hub/activity-hub'
import { defaultVisibilityRules } from '../hub/visibility-rules'
import { initializeStorage } from '../storage/storage-init'
import { TimelineManager, type TimelineItem } from '../timeline/timeline-manager'
import { EventTypes } from '../types/events'
import type { ChatMessage } from '../types/config'

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
// Helper: create test infrastructure
// ---------------------------------------------------------------------------

function createTestContext() {
  const ctx = initializeStorage()
  const hub = new ActivityHub(ctx.events, defaultVisibilityRules)
  const timeline = new TimelineManager(hub, ctx.events)
  return { ctx, hub, timeline }
}

function insertTestMessage(
  ctx: ReturnType<typeof createTestContext>,
  teamId: string,
  sender: 'user' | 'bob',
  content: string,
  timestamp: number,
): ChatMessage {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    teamId,
    sender,
    content,
    timestamp,
  }
  ctx.ctx.events.insertMessage(msg)
  return msg
}

// ---------------------------------------------------------------------------
// TimelineManager — Core
// ---------------------------------------------------------------------------

describe('TimelineManager', () => {
  it('returns empty timeline for no data', () => {
    const { timeline } = createTestContext()
    const items = timeline.loadTimeline('team-1', 'normal')
    expect(items).toEqual([])
  })

  it('includes chat messages as timeline items', () => {
    const test = createTestContext()
    insertTestMessage(test, 'team-1', 'user', 'Hello', 1000)
    insertTestMessage(test, 'team-1', 'bob', 'Hi!', 2000)

    const items = test.timeline.loadTimeline('team-1', 'normal')
    expect(items).toHaveLength(2)
    expect(items[0].kind).toBe('message')
    expect(items[0].message?.sender).toBe('user')
    expect(items[1].kind).toBe('message')
    expect(items[1].message?.sender).toBe('bob')
  })

  it('includes activity events as timeline items', () => {
    const { hub, timeline } = createTestContext()

    hub.emit('team-1', 'lead', EventTypes.DELEGATION_SENT, {
      from: 'lead',
      to: 'ui',
      task: 'Build form',
    })
    hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'Form.vue', additions: 30, deletions: 0, status: 'new' }],
    })

    const items = timeline.loadTimeline('team-1', 'normal')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.every((i) => i.kind === 'event')).toBe(true)
  })

  it('merges messages and events sorted by timestamp', () => {
    const test = createTestContext()

    // Insert a message at t=1000
    insertTestMessage(test, 'team-1', 'user', 'Build a form', 1000)

    // Insert an event at t=2000 (emit uses Date.now() but we need ordering)
    test.hub.emit('team-1', 'lead', EventTypes.DELEGATION_SENT, {
      from: 'lead',
      to: 'ui',
      task: 'Form',
    })

    // Insert a message at t=3000
    insertTestMessage(test, 'team-1', 'bob', 'Done!', Date.now() + 5000)

    const items = test.timeline.loadTimeline('team-1', 'normal')
    expect(items.length).toBeGreaterThanOrEqual(3)

    // Verify sorted by timestamp
    for (let i = 1; i < items.length; i++) {
      expect(items[i].timestamp).toBeGreaterThanOrEqual(items[i - 1].timestamp)
    }
  })

  it('filters by verbosity — minimal shows only timeline-visibility events', () => {
    const test = createTestContext()

    // timeline-visibility event (delegation)
    test.hub.emit('team-1', 'lead', EventTypes.DELEGATION_SENT, {
      from: 'lead',
      to: 'ui',
      task: 'Form',
    })
    // activity-visibility event (tool invoke)
    test.hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, {
      tool: 'read_file',
      args: 'src/',
    })

    const minimal = test.timeline.loadTimeline('team-1', 'minimal')
    const normal = test.timeline.loadTimeline('team-1', 'normal')

    // Minimal should have fewer items than normal
    expect(minimal.length).toBeLessThan(normal.length)
    // Minimal should only have timeline-visibility events
    for (const item of minimal) {
      if (item.event) {
        expect(item.event.visibility).toBe('timeline')
      }
    }
  })

  it('respects pagination limit', () => {
    const test = createTestContext()

    // Insert 10 messages
    for (let i = 0; i < 10; i++) {
      insertTestMessage(test, 'team-1', 'user', `Message ${i}`, 1000 + i)
    }

    const items = test.timeline.loadTimeline('team-1', 'normal', 5)
    expect(items).toHaveLength(5)
    // Should be the LAST 5 items
    expect(items[0].message?.content).toBe('Message 5')
    expect(items[4].message?.content).toBe('Message 9')
  })

  it('separates teams — team-1 events do not appear in team-2 timeline', () => {
    const test = createTestContext()

    insertTestMessage(test, 'team-1', 'user', 'Team 1 msg', 1000)
    insertTestMessage(test, 'team-2', 'user', 'Team 2 msg', 2000)

    const team1 = test.timeline.loadTimeline('team-1', 'normal')
    const team2 = test.timeline.loadTimeline('team-2', 'normal')

    expect(team1).toHaveLength(1)
    expect(team1[0].message?.content).toBe('Team 1 msg')
    expect(team2).toHaveLength(1)
    expect(team2[0].message?.content).toBe('Team 2 msg')
  })
})

// ---------------------------------------------------------------------------
// TimelineManager — Load Older (pagination)
// ---------------------------------------------------------------------------

describe('TimelineManager — Pagination', () => {
  it('loadOlder returns items before a given timestamp', () => {
    const test = createTestContext()

    for (let i = 0; i < 10; i++) {
      insertTestMessage(test, 'team-1', 'user', `Msg ${i}`, 1000 + i * 100)
    }

    // Load the most recent 5
    const recent = test.timeline.loadTimeline('team-1', 'normal', 5)
    expect(recent).toHaveLength(5)

    // Load older items before the oldest in the recent set
    const older = test.timeline.loadOlder('team-1', 'normal', recent[0].timestamp, 5)
    expect(older).toHaveLength(5)
    expect(older[4].timestamp).toBeLessThan(recent[0].timestamp)
  })

  it('loadOlder returns empty when no older items exist', () => {
    const test = createTestContext()

    insertTestMessage(test, 'team-1', 'user', 'Only message', 1000)

    const items = test.timeline.loadTimeline('team-1', 'normal')
    const older = test.timeline.loadOlder('team-1', 'normal', items[0].timestamp)
    expect(older).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// TimelineManager — Real-Time Subscriptions
// ---------------------------------------------------------------------------

describe('TimelineManager — Real-Time', () => {
  it('streams new events to subscribers', () => {
    const test = createTestContext()
    const received: TimelineItem[] = []

    test.timeline.subscribeToUpdates('team-1', 'normal', (item) => {
      received.push(item)
    })

    // Emit events
    test.hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'test.ts', additions: 10, deletions: 0, status: 'new' }],
    })

    expect(received).toHaveLength(1)
    expect(received[0].kind).toBe('event')
    expect(received[0].event?.type).toBe(EventTypes.CODE_CHANGED)
  })

  it('filters streamed events by team', () => {
    const test = createTestContext()
    const received: TimelineItem[] = []

    test.timeline.subscribeToUpdates('team-1', 'normal', (item) => {
      received.push(item)
    })

    // Event for team-2 should NOT appear
    test.hub.emit('team-2', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'other.ts', additions: 5, deletions: 0, status: 'new' }],
    })

    expect(received).toHaveLength(0)
  })

  it('filters streamed events by verbosity', () => {
    const test = createTestContext()
    const received: TimelineItem[] = []

    // Subscribe at minimal (timeline only)
    test.timeline.subscribeToUpdates('team-1', 'minimal', (item) => {
      received.push(item)
    })

    // tool.invoke has "activity" visibility → should NOT be received at minimal
    test.hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, {
      tool: 'read_file',
      args: 'src/',
    })

    // code.changed has "timeline" visibility → should be received
    test.hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'test.ts', additions: 10, deletions: 0, status: 'new' }],
    })

    expect(received).toHaveLength(1)
    expect(received[0].event?.type).toBe(EventTypes.CODE_CHANGED)
  })

  it('unsubscribes correctly', () => {
    const test = createTestContext()
    const received: TimelineItem[] = []

    const unsub = test.timeline.subscribeToUpdates('team-1', 'normal', (item) => {
      received.push(item)
    })

    // Emit one event
    test.hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'a.ts', additions: 1, deletions: 0, status: 'new' }],
    })
    expect(received).toHaveLength(1)

    // Unsubscribe
    unsub()

    // Emit another — should NOT be received
    test.hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'b.ts', additions: 1, deletions: 0, status: 'new' }],
    })
    expect(received).toHaveLength(1)
  })

  it('destroy cleans up all subscriptions', () => {
    const test = createTestContext()
    const received: TimelineItem[] = []

    test.timeline.subscribeToUpdates('team-1', 'normal', (item) => {
      received.push(item)
    })

    test.timeline.destroy()

    test.hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'test.ts', additions: 1, deletions: 0, status: 'new' }],
    })
    expect(received).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// TimelineManager — Static Helpers
// ---------------------------------------------------------------------------

describe('TimelineManager — Helpers', () => {
  it('messageToTimelineItem converts a ChatMessage to TimelineItem', () => {
    const msg: ChatMessage = {
      id: 'test-id',
      teamId: 'team-1',
      sender: 'bob',
      content: 'Hello!',
      timestamp: 12345,
    }

    const item = TimelineManager.messageToTimelineItem(msg)
    expect(item.id).toBe('test-id')
    expect(item.kind).toBe('message')
    expect(item.timestamp).toBe(12345)
    expect(item.message).toBe(msg)
    expect(item.event).toBeUndefined()
  })
})
