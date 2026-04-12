/**
 * Phase 1 Verification Test
 *
 * Tests the foundation: Storage + Event System round-trip.
 * Run with: npx vitest run src/core/__tests__/phase1-verification.test.ts
 *
 * This verifies:
 * 1. Events can be emitted and queried back
 * 2. Visibility rules are applied correctly
 * 3. Subscribers receive events in real time
 * 4. Aggregation batches consecutive same-tool events
 * 5. Storage initialization creates defaults
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EventStore } from '../storage/event-store'
import { ActivityHub } from '../hub/activity-hub'
import { EventTypes } from '../types/events'
import {
  defaultVisibilityRules,
  resolveVisibility,
  getVisibilityFilter,
} from '../hub/visibility-rules'
import type { ActivityEvent } from '../types/events'

// Use in-memory store (no localStorage) for tests
function createTestStore() {
  return new EventStore(false)
}

function createTestHub(store?: EventStore) {
  const s = store ?? createTestStore()
  return { hub: new ActivityHub(s, defaultVisibilityRules), store: s }
}

// ---------------------------------------------------------------------------
// 1. Event emit + query round-trip
// ---------------------------------------------------------------------------

describe('Event round-trip', () => {
  it('emits an event and queries it back by team', () => {
    const { hub } = createTestHub()

    const event = hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, {
      files: [{ path: 'src/App.vue', additions: 10, deletions: 2, status: 'modified' }],
    })

    expect(event.id).toBeDefined()
    expect(event.teamId).toBe('team-1')
    expect(event.agentId).toBe('ui')
    expect(event.type).toBe('code.changed')
    expect(event.visibility).toBe('timeline')

    const results = hub.query({ teamId: 'team-1' })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(event.id)
  })

  it('queries events by visibility', () => {
    const { hub } = createTestHub()

    hub.emit('team-1', 'lead', EventTypes.DELEGATION_SENT, {
      from: 'lead',
      to: 'ui',
      task: 'Build login form',
    })
    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, {
      tool: 'read_file',
      args: 'src/App.vue',
    })
    hub.emit('team-1', 'ui', EventTypes.MESSAGE_SENT, {
      from: 'ui',
      to: 'lead',
      content: 'Done',
    })

    const timeline = hub.query({ teamId: 'team-1', visibility: 'timeline' })
    expect(timeline).toHaveLength(1) // delegation.sent

    const activity = hub.query({ teamId: 'team-1', visibility: 'activity' })
    expect(activity).toHaveLength(1) // tool.invoke

    const internal = hub.query({ teamId: 'team-1', visibility: 'internal' })
    expect(internal).toHaveLength(1) // message.sent
  })

  it('queries events by type prefix', () => {
    const { hub } = createTestHub()

    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, { tool: 'read_file', args: 'a.ts' })
    hub.emit('team-1', 'ui', EventTypes.TOOL_RESULT, {
      tool: 'read_file',
      output: '...',
      duration: 50,
    })
    hub.emit('team-1', 'ui', EventTypes.CODE_CHANGED, { files: [] })

    const toolEvents = hub.query({ teamId: 'team-1', type: 'tool.*' })
    expect(toolEvents).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 2. Visibility rules
// ---------------------------------------------------------------------------

describe('Visibility rules', () => {
  it('resolves known event types correctly', () => {
    expect(resolveVisibility('delegation.sent', defaultVisibilityRules)).toBe('timeline')
    expect(resolveVisibility('tool.invoke', defaultVisibilityRules)).toBe('activity')
    expect(resolveVisibility('message.sent', defaultVisibilityRules)).toBe('internal')
  })

  it('defaults unknown types to activity', () => {
    expect(resolveVisibility('design.mockup.created', defaultVisibilityRules)).toBe('activity')
    expect(resolveVisibility('custom.event', defaultVisibilityRules)).toBe('activity')
  })

  it('verbosity filter returns correct visibility levels', () => {
    expect(getVisibilityFilter('minimal')).toEqual(['timeline'])
    expect(getVisibilityFilter('normal')).toEqual(['timeline', 'activity'])
    expect(getVisibilityFilter('detailed')).toEqual(['timeline', 'activity', 'internal'])
    expect(getVisibilityFilter('debug')).toEqual(['timeline', 'activity', 'internal', 'debug'])
  })
})

// ---------------------------------------------------------------------------
// 3. Subscriber receives events
// ---------------------------------------------------------------------------

describe('Subscriptions', () => {
  it('subscriber receives emitted events', () => {
    const { hub } = createTestHub()
    const received: ActivityEvent[] = []

    // Subscribe to all non-aggregatable events
    hub.subscribe('*', (event) => received.push(event))

    // Emit a non-aggregatable event (milestone goes straight through)
    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Login complete',
      stats: { files: 4 },
    })

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe('milestone.achieved')
  })

  it('filtered subscriber only receives matching events', () => {
    const { hub } = createTestHub()
    const timelineEvents: ActivityEvent[] = []

    hub.subscribe('timeline', (event) => timelineEvents.push(event))

    // Emit a timeline event (non-aggregatable)
    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Done',
      stats: {},
    })

    // Emit an activity event (non-aggregatable)
    hub.emit('team-1', 'ui', EventTypes.AGENT_SPAWNED, {
      role: 'UI Dev',
      task: 'Build form',
      calibration: {},
    })

    expect(timelineEvents).toHaveLength(1)
    expect(timelineEvents[0].type).toBe('milestone.achieved')
  })

  it('unsubscribe stops receiving events', () => {
    const { hub } = createTestHub()
    const received: ActivityEvent[] = []

    const unsub = hub.subscribe('*', (event) => received.push(event))

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'First',
      stats: {},
    })
    expect(received).toHaveLength(1)

    unsub()

    hub.emit('team-1', 'lead', EventTypes.MILESTONE_ACHIEVED, {
      title: 'Second',
      stats: {},
    })
    expect(received).toHaveLength(1) // still 1, unsubscribed
  })
})

// ---------------------------------------------------------------------------
// 4. Event aggregation
// ---------------------------------------------------------------------------

describe('Event aggregation', () => {
  it('individual tool.invoke events are persisted even when batched', () => {
    const store = createTestStore()
    const { hub } = createTestHub(store)

    // Emit 4 consecutive read_file events (should trigger batching)
    const now = Date.now()
    for (let i = 0; i < 4; i++) {
      hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, {
        tool: 'read_file',
        args: `file${i}.ts`,
      })
    }

    // All 4 individual events should be in the store
    const stored = store.queryEvents({ teamId: 'team-1', type: 'tool.invoke' })
    expect(stored).toHaveLength(4)
  })

  it('flush produces batch events for subscribers', () => {
    const { hub } = createTestHub()
    const received: ActivityEvent[] = []

    hub.subscribe('*', (event) => received.push(event))

    // Emit 4 consecutive read_file events
    for (let i = 0; i < 4; i++) {
      hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, {
        tool: 'read_file',
        args: `file${i}.ts`,
      })
    }

    // Force flush to trigger batching
    hub.flush()

    // Subscriber should have received a batch event
    const batchEvents = received.filter((e) => e.type === 'tool.batch')
    expect(batchEvents).toHaveLength(1)
    expect((batchEvents[0].payload as { count: number }).count).toBe(4)
    expect((batchEvents[0].payload as { tool: string }).tool).toBe('read_file')
  })

  it('different tools break the batch', () => {
    const { hub } = createTestHub()
    const received: ActivityEvent[] = []

    hub.subscribe('*', (event) => received.push(event))

    // Emit 2 read_file, then 2 write_file
    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, { tool: 'read_file', args: 'a.ts' })
    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, { tool: 'read_file', args: 'b.ts' })
    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, { tool: 'write_file', args: 'c.ts' })
    hub.emit('team-1', 'ui', EventTypes.TOOL_INVOKE, { tool: 'write_file', args: 'd.ts' })

    hub.flush()

    // Should have individual events (below threshold of 3 per tool)
    // read_file: 2 events (no batch), write_file: 2 events (no batch)
    const nonBatch = received.filter((e) => e.type !== 'tool.batch')
    expect(nonBatch).toHaveLength(4) // all 4 flushed individually
  })
})

// ---------------------------------------------------------------------------
// 5. Storage (EventStore basics)
// ---------------------------------------------------------------------------

describe('EventStore', () => {
  let store: EventStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('stores and retrieves messages', () => {
    store.insertMessage({
      id: 'msg-1',
      teamId: 'team-1',
      sender: 'user',
      content: 'Hello BoB',
      timestamp: Date.now(),
    })
    store.insertMessage({
      id: 'msg-2',
      teamId: 'team-1',
      sender: 'bob',
      content: 'Hi there!',
      timestamp: Date.now() + 1,
    })

    const messages = store.getMessages('team-1')
    expect(messages).toHaveLength(2)
    expect(messages[0].sender).toBe('user')
    expect(messages[1].sender).toBe('bob')
  })

  it('filters messages by team', () => {
    store.insertMessage({
      id: 'msg-1',
      teamId: 'team-1',
      sender: 'user',
      content: 'For team 1',
      timestamp: Date.now(),
    })
    store.insertMessage({
      id: 'msg-2',
      teamId: 'team-2',
      sender: 'user',
      content: 'For team 2',
      timestamp: Date.now(),
    })

    expect(store.getMessages('team-1')).toHaveLength(1)
    expect(store.getMessages('team-2')).toHaveLength(1)
  })

  it('limits message results', () => {
    for (let i = 0; i < 10; i++) {
      store.insertMessage({
        id: `msg-${i}`,
        teamId: 'team-1',
        sender: 'user',
        content: `Message ${i}`,
        timestamp: Date.now() + i,
      })
    }

    const recent = store.getMessages('team-1', 3)
    expect(recent).toHaveLength(3)
    expect(recent[0].content).toBe('Message 7') // last 3
  })

  it('counts events by type', () => {
    const event = (type: string) => ({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      teamId: 'team-1',
      agentId: 'ui',
      type,
      payload: {},
      visibility: 'activity' as const,
    })

    store.insertEvent(event('tool.invoke'))
    store.insertEvent(event('tool.invoke'))
    store.insertEvent(event('tool.invoke'))
    store.insertEvent(event('code.changed'))

    const counts = store.countEventsByType('team-1')
    expect(counts['tool.invoke']).toBe(3)
    expect(counts['code.changed']).toBe(1)
  })
})
