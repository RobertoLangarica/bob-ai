/**
 * Event Aggregation Engine — batches noisy consecutive events.
 *
 * When 3+ tool.invoke events from the same agent with the same tool arrive
 * within a 10-second window, batch them into a single tool.batch event.
 * Individual events are always persisted; subscribers receive the compact form.
 */

import type { ActivityEvent } from '../types/events'
import { EventTypes } from '../types/events'

// ---------------------------------------------------------------------------
// Aggregation buffer
// ---------------------------------------------------------------------------

interface BufferEntry {
  events: ActivityEvent[]
  agentId: string
  tool: string
  firstTimestamp: number
}

const BATCH_THRESHOLD = 3 // minimum events to trigger batching
const BATCH_WINDOW_MS = 10_000 // 10 second window

export class AggregationEngine {
  private buffer: BufferEntry | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private onFlush: (event: ActivityEvent | null) => void

  constructor(onFlush: (event: ActivityEvent | null) => void) {
    this.onFlush = onFlush
  }

  /**
   * Process an incoming event. Returns:
   * - The event itself (pass through, no aggregation)
   * - A batched event (aggregation triggered)
   * - null (event buffered, waiting for more)
   */
  process(event: ActivityEvent): ActivityEvent | null {
    // Only aggregate tool.invoke events
    if (event.type === EventTypes.TOOL_INVOKE) {
      return this.handleToolInvoke(event)
    }

    // Also aggregate consecutive test.passed events
    if (event.type === EventTypes.TEST_PASSED) {
      return this.handleTestPassed(event)
    }

    // Everything else: flush buffer and pass through
    this.flushBuffer()
    return event
  }

  /**
   * Force flush any buffered events (e.g., on timeout or agent change).
   */
  flushBuffer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (!this.buffer) return

    if (this.buffer.events.length >= BATCH_THRESHOLD) {
      // Create batched event
      const batchEvent = this.createBatchEvent(this.buffer)
      this.buffer = null
      this.onFlush(batchEvent)
    } else {
      // Not enough events to batch — flush individually
      const events = this.buffer.events
      this.buffer = null
      for (const e of events) {
        this.onFlush(e)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tool invoke aggregation
  // -------------------------------------------------------------------------

  private handleToolInvoke(event: ActivityEvent): ActivityEvent | null {
    const tool = (event.payload as { tool?: string }).tool ?? ''

    if (this.buffer) {
      const timeDelta = event.timestamp - this.buffer.firstTimestamp
      const sameAgent = event.agentId === this.buffer.agentId
      const sameTool = tool === this.buffer.tool
      const withinWindow = timeDelta <= BATCH_WINDOW_MS

      if (sameAgent && sameTool && withinWindow) {
        // Add to existing buffer
        this.buffer.events.push(event)
        this.resetFlushTimer()
        return null // buffered
      }

      // Different agent/tool/expired window — flush existing buffer
      this.flushBuffer()
    }

    // Start new buffer
    this.buffer = {
      events: [event],
      agentId: event.agentId,
      tool,
      firstTimestamp: event.timestamp,
    }
    this.resetFlushTimer()
    return null // buffered
  }

  private handleTestPassed(event: ActivityEvent): ActivityEvent | null {
    // Reuse the same buffering logic with type "test.passed"
    const tool = '__test_passed__'

    if (this.buffer && this.buffer.tool === tool) {
      const timeDelta = event.timestamp - this.buffer.firstTimestamp
      const sameAgent = event.agentId === this.buffer.agentId

      if (sameAgent && timeDelta <= BATCH_WINDOW_MS) {
        this.buffer.events.push(event)
        this.resetFlushTimer()
        return null
      }

      this.flushBuffer()
    }

    this.buffer = {
      events: [event],
      agentId: event.agentId,
      tool,
      firstTimestamp: event.timestamp,
    }
    this.resetFlushTimer()
    return null
  }

  // -------------------------------------------------------------------------
  // Batch event creation
  // -------------------------------------------------------------------------

  private createBatchEvent(buffer: BufferEntry): ActivityEvent {
    if (buffer.tool === '__test_passed__') {
      return {
        id: crypto.randomUUID(),
        timestamp: buffer.events[buffer.events.length - 1].timestamp,
        teamId: buffer.events[0].teamId,
        agentId: buffer.agentId,
        type: 'test.batch',
        payload: {
          count: buffer.events.length,
          names: buffer.events.map((e) => (e.payload as { name?: string }).name ?? 'unknown'),
        },
        visibility: 'activity',
      }
    }

    // tool.batch
    return {
      id: crypto.randomUUID(),
      timestamp: buffer.events[buffer.events.length - 1].timestamp,
      teamId: buffer.events[0].teamId,
      agentId: buffer.agentId,
      type: EventTypes.TOOL_BATCH,
      payload: {
        tool: buffer.tool,
        count: buffer.events.length,
        items: buffer.events.map((e) => {
          const args = (e.payload as { args?: unknown }).args
          return typeof args === 'string' ? args : JSON.stringify(args)
        }),
      },
      visibility: 'activity',
    }
  }

  // -------------------------------------------------------------------------
  // Timer management
  // -------------------------------------------------------------------------

  private resetFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }
    // Auto-flush after 2 seconds of silence
    this.flushTimer = setTimeout(() => {
      this.flushBuffer()
    }, 2000)
  }

  /**
   * Clean up timers (for disposal).
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.buffer = null
  }
}
