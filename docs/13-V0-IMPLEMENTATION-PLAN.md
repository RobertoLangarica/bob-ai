# V0 Implementation Plan

> Comprehensive implementation guide for bob-ai V0. This document is self-contained — a developer should be able to work from it without reading the full conversation history that produced it. It covers the architectural vision, every major component (what it does, how it's structured, why it needs to work that way), data flows, storage decisions, agent workflows, and ordered implementation phases described in enough detail to code from.
>
> **How to read this document:** Sections 1–8 are the "what and why" — deep explanations of each component. Section 9 is the "how and when" — the ordered build plan. Section 10 is worked examples showing all the pieces in concert. If you're wondering _what_ something is, read sections 1–8. If you're wondering _when_ to build it, read section 9.

---

## Table of Contents

1. [Architectural Vision](#1-architectural-vision)
2. [Activity Hub — Event System](#2-activity-hub--event-system)
3. [Agent Workflow & Debrief](#3-agent-workflow--debrief)
4. [Calibration System](#4-calibration-system)
5. [Storage Layer](#5-storage-layer)
6. [Team Templates & Specialist Catalog](#6-team-templates--specialist-catalog)
7. [Timeline & Chat](#7-timeline--chat)
8. [Non-Coding Agents](#8-non-coding-agents)
9. [Implementation Phases](#9-implementation-phases)
10. [Patterns & Examples](#10-patterns--examples)

---

## 1. Architectural Vision

### What bob-ai Is

bob-ai is a desktop application for orchestrating teams of AI agents. The user talks to **BoB** — a single AI assistant who creates, calibrates, and manages agent teams. Agents are hidden implementation details; the user never addresses them directly. Everything happens through conversation.

The app is built on the **Cline SDK** (`@clinebot/agents`, `@clinebot/core`, `@clinebot/llms`) which handles agent spawning, tool execution, and LLM communication. bob-ai's job is the layer above: team management, calibration persistence, activity monitoring, and the user-facing chat interface.

### Core Principles

1. **Chat-first**: No forms, no wizards, no dashboards. The user types natural language and BoB acts on it.
2. **Agent transparency**: Users talk to BoB, not to individual agents. Agents are the engine; BoB is the driver.
3. **Workspace memory**: Calibrations, team configs, and preferences persist in the workspace (`.bob/` directory). BoB reads these on every session so the user never repeats themselves.
4. **Event-driven activity**: Agents communicate through a central Activity Hub by emitting structured events. The UI subscribes to events — any UI can consume them.
5. **UI-agnostic data**: All agent output, metrics, and state are expressed as data structures and events, not visual components. The current Vue/Naive UI frontend is one possible consumer; the system should support swapping to any UI framework.
6. **Goal-driven agents**: Agents work toward explicit goals with success criteria, not open-ended instructions. This applies equally to coding agents, research agents, writing agents, or any other specialty.

### System Architecture

```
┌──────────────────────────────────────────────────┐
│                    bob-ai App                     │
│                                                   │
│  ┌─────────┐   ┌──────────────┐   ┌───────────┐ │
│  │   UI    │◄──│ Activity Hub │◄──│  Agents   │ │
│  │ (Vue 3) │   │  (EventBus)  │   │(Cline SDK)│ │
│  └────┬────┘   └──────┬───────┘   └─────┬─────┘ │
│       │               │                  │       │
│       │         ┌─────┴──────┐    ┌──────┴─────┐ │
│       │         │  SQLite    │    │    BoB     │ │
│       │         │ (history)  │    │(orchestr.) │ │
│       │         └────────────┘    └──────┬─────┘ │
│       │                                  │       │
│       │         ┌────────────────────────┘       │
│       │         │                                │
│  ┌────┴─────────┴────┐                           │
│  │   .bob/ directory  │                           │
│  │  (calibrations,    │                           │
│  │   templates, config)│                          │
│  └────────────────────┘                           │
└──────────────────────────────────────────────────┘
```

**Data flow:**

1. User types a message in the UI
2. UI sends it to BoB (the orchestrator agent)
3. BoB reads `.bob/calibrations.json` to understand workspace context
4. BoB selects/spawns a team of agents based on the task + calibrations
5. Each agent receives calibration rules injected into its system prompt
6. Agents work, emitting events to the Activity Hub via `emit(type, payload)`
7. Activity Hub stores all events in SQLite and applies visibility filtering
8. UI subscribes to Activity Hub and renders timeline/activity views
9. When work completes, agents emit milestone events
10. Calibration changes (learned from work patterns) get written back to `.bob/`

### What V0 Delivers

A working system where:

- User converses with BoB to create and calibrate teams
- Teams execute tasks with agents working in parallel (via git worktrees for code agents)
- All agent activity flows through the Activity Hub as structured events
- The chat timeline shows filtered, scannable work progress
- Team calibrations persist per workspace and auto-load on restart
- The system works for **any agent type** — coding, research, writing, design — through the same event-driven patterns

### What V0 Does NOT Deliver

- Visual workflow builder (drag-drop hooks)
- Multi-user collaboration
- Cloud sync or remote storage
- Advanced analytics/dashboards
- Command palette or keyboard shortcuts
- Desktop notifications or system tray

---

## 2. Activity Hub — Event System

### Purpose

The Activity Hub is the **central nervous system** of bob-ai. Every agent action — reading a file, writing code, searching the web, delegating to another agent, completing a milestone — is expressed as a structured event emitted to the hub. The hub stores everything, filters by visibility, and pushes relevant events to whatever UI is listening.

This design means the UI never talks to agents directly. It subscribes to the hub. If you swap Vue for React, or replace the desktop app with a CLI, the agent layer doesn't change — only the subscriber changes.

### Why This Matters

Without a hub, each agent would need to know about the UI. With a hub:

- Agents just emit data (they don't care who's listening)
- The UI just subscribes (it doesn't care who's emitting)
- Storage is centralized (one place to query history)
- Filtering is configurable (user controls verbosity)
- New event types can be added without changing existing code

### Base Event Schema

Every event flowing through the system has this shape:

```typescript
interface ActivityEvent {
  id: string; // UUID, generated by the hub on receipt
  timestamp: number; // Unix milliseconds
  teamId: string; // Which team this belongs to
  agentId: string; // Which agent emitted it (e.g., "ui", "backend", "lead")
  type: string; // Dot-separated namespace (e.g., "tool.invoke", "milestone.achieved")
  payload: Record<string, any>; // Event-specific data
  visibility: "timeline" | "activity" | "internal" | "debug"; // Assigned by hub
}
```

**Key design decisions:**

- `type` uses dot-separated namespaces so you can filter by prefix (all `tool.*` events, all `agent.*` events)
- `visibility` is assigned by the hub based on rules, not by the agent. Agents don't decide what the user sees.
- `payload` is intentionally untyped at this level — each event type defines its own payload shape (see below)
- `teamId` allows querying events per team, which maps directly to chat history per team in the UI

### Core Event Types

These are the event types that ship with bob-ai V0. They form the vocabulary that all agents inherit.

#### Agent Lifecycle Events

These track an agent from spawn to completion:

```typescript
"agent.spawned"     → { role: string, task: string, calibration: object }
"agent.debriefed"   → { context: string, plan: string, subgoals: string[] }
"agent.thinking"    → { step: number, reasoning: string }
"agent.completed"   → { result: string, artifacts: string[] }
"agent.error"       → { error: string, recoverable: boolean }
"agent.paused"      → { reason: string }
"agent.resumed"     → { }
```

**Why these exist:** The UI needs to know when agents start, what they're planning, and when they finish. The "debriefed" event is particularly important — it captures the agent's plan after reading workspace context and calibrations, which helps the user understand what's about to happen.

#### Communication Events

These track coordination between agents:

```typescript
"delegation.sent"   → { from: string, to: string, task: string, context?: string }
"message.sent"      → { from: string, to: string, content: string }
```

**Why these exist:** `delegation.sent` is the primary way users see the Team Lead assigning work. It appears in the timeline as a compact breadcrumb. `message.sent` captures inter-agent chatter but is hidden by default (visibility: "internal") because it's noisy.

#### Tool Use Events

These track agents using tools (file operations, terminal commands, etc.):

```typescript
"tool.invoke"       → { tool: string, args: any, context?: string }
"tool.result"       → { tool: string, output: any, duration: number }
"tool.error"        → { tool: string, error: string }
```

**Why these exist:** Tool use is the most frequent event type. Agents constantly read files, write code, run commands. These events power the compact `⚡ Agent › tool › args` chips in the timeline.

#### Code Work Events

These track code-specific actions (only relevant for coding agents, but the schema is universal):

```typescript
"code.changed"      → { files: Array<{path: string, additions: number, deletions: number, status: "new" | "modified" | "deleted"}> }
"code.reviewed"     → { files: string[], issues: string[], approved: boolean }
"test.run"          → { command: string, passed: number, failed: number, total: number }
"test.passed"       → { name: string, duration: number }
"test.failed"       → { name: string, error: string }
```

#### Research Events

These track information-gathering actions (common for research agents, but any agent can emit them):

```typescript
"web.search"        → { query: string, results: Array<{title: string, url: string, snippet: string}> }
"web.scrape"        → { url: string, summary: string, wordCount: number }
"knowledge.read"    → { document: string, relevant: string }
```

#### Progress Events

These track high-level progress and achievements:

```typescript
"milestone.achieved" → { title: string, description?: string, stats: Record<string, number> }
"goal.completed"     → { goalId: string, result: string }
"goal.progress"      → { goalId: string, progress: number, current: string }
```

**Why milestones matter:** Milestones are the anchors of the timeline. When hours of tool invocations and code changes scroll by, milestones are the moments that stick. They get special visual treatment — full-width banners with green accent — and they never collapse.

### Dynamic Event Type Extension

Agents can emit custom event types beyond the core set. This is important for non-coding agents that may have domain-specific actions.

**How it works:**

1. Agent emits an event with a new type: `emit("design.mockup.created", { name: "login-v2", format: "figma" })`
2. Activity Hub receives it, doesn't recognize the type
3. Hub stores it with `visibility: "activity"` (default for unknown types)
4. UI renders it as a generic event card (type name + JSON payload)
5. Optionally, agent can register a schema for better rendering (V1+ feature)

**V0 scope:** Unknown types get stored and rendered generically. No schema registration in V0.

### Visibility Filtering

The hub assigns visibility to each event based on type-to-visibility rules:

```typescript
const visibilityRules: Record<string, ActivityEvent["visibility"]> = {
  // TIMELINE — shown in the main chat view
  "delegation.sent": "timeline",
  "milestone.achieved": "timeline",
  "goal.completed": "timeline",
  "code.changed": "timeline",
  "test.run": "timeline",
  "agent.error": "timeline",

  // ACTIVITY — shown in the activity view only
  "agent.spawned": "activity",
  "agent.debriefed": "activity",
  "agent.thinking": "activity",
  "agent.completed": "activity",
  "tool.invoke": "activity",
  "goal.progress": "activity",
  "web.search": "activity",
  "web.scrape": "activity",

  // INTERNAL — stored but never shown by default
  "message.sent": "internal",
  "tool.result": "internal",
  "tool.error": "internal",
  "test.passed": "internal",
  "test.failed": "internal",
  "agent.paused": "internal",
  "agent.resumed": "internal",
  "knowledge.read": "internal",
};
```

**User-controllable verbosity (future enhancement):**

| Level            | What's shown                            |
| ---------------- | --------------------------------------- |
| Minimal          | Timeline events only                    |
| Normal (default) | Timeline + activity events              |
| Detailed         | Timeline + activity + selected internal |
| Debug            | Everything                              |

### Event Aggregation

Some events are noisy when consecutive. The hub groups them:

**Rule:** If 3+ `tool.invoke` events from the same agent arrive within 10 seconds, aggregate into a single `tool.batch` event:

```typescript
// Individual events (stored in DB):
{ type: "tool.invoke", agentId: "ui", payload: { tool: "read_file", args: "a.vue" } }
{ type: "tool.invoke", agentId: "ui", payload: { tool: "read_file", args: "b.vue" } }
{ type: "tool.invoke", agentId: "ui", payload: { tool: "read_file", args: "c.vue" } }

// Aggregated event (pushed to subscribers):
{ type: "tool.batch", agentId: "ui", payload: { tool: "read_file", count: 3, items: ["a.vue", "b.vue", "c.vue"] } }
```

**V0 aggregation rules:**

- Consecutive `tool.invoke` from same agent with same tool → batch
- Consecutive `test.passed` → summarize as count
- Everything else → pass through individually

### Hub Implementation

```typescript
class ActivityHub {
  private db: SQLiteDatabase;
  private subscribers: Map<string, Set<(event: ActivityEvent) => void>>;

  // Called by agents
  emit(
    teamId: string,
    agentId: string,
    type: string,
    payload: object,
  ): ActivityEvent {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      teamId,
      agentId,
      type,
      payload,
      visibility: this.resolveVisibility(type),
    };

    // 1. Always persist
    this.db.insertEvent(event);

    // 2. Apply aggregation rules
    const aggregated = this.maybeAggregate(event);

    // 3. Notify subscribers (UI, logging, etc.)
    const eventToPublish = aggregated || event;
    this.notifySubscribers(eventToPublish);

    return event;
  }

  // Called by UI to listen for events
  subscribe(
    filter: string,
    callback: (event: ActivityEvent) => void,
  ): () => void {
    // filter can be: "*" (all), "timeline" (visibility), "tool.*" (type prefix)
    if (!this.subscribers.has(filter)) {
      this.subscribers.set(filter, new Set());
    }
    this.subscribers.get(filter)!.add(callback);
    return () => this.subscribers.get(filter)?.delete(callback); // unsubscribe
  }

  // Called by UI to load history
  query(opts: {
    teamId?: string;
    type?: string;
    since?: number;
    limit?: number;
  }): ActivityEvent[] {
    return this.db.queryEvents(opts);
  }

  private resolveVisibility(type: string): ActivityEvent["visibility"] {
    return visibilityRules[type] || "activity"; // Unknown types default to activity
  }

  private maybeAggregate(event: ActivityEvent): ActivityEvent | null {
    // Check if recent events from same agent + same tool type should batch
    // Returns aggregated event or null (no aggregation)
    // Implementation: keep a small buffer per agent, flush on type change or timeout
  }

  private notifySubscribers(event: ActivityEvent): void {
    for (const [filter, callbacks] of this.subscribers) {
      if (this.matchesFilter(event, filter)) {
        for (const cb of callbacks) cb(event);
      }
    }
  }

  private matchesFilter(event: ActivityEvent, filter: string): boolean {
    if (filter === "*") return true;
    if (filter === event.visibility) return true;
    if (event.type.startsWith(filter.replace("*", ""))) return true;
    return false;
  }
}
```

### What to Build

1. **`ActivityHub` class** — Core event bus with emit/subscribe/query
2. **`EventStore`** — SQLite wrapper for event persistence
3. **`visibilityRules`** — Type-to-visibility mapping (configurable)
4. **`AggregationEngine`** — Buffering and batching logic
5. **Event type constants** — Typed string constants for all core types

---

## 3. Agent Workflow & Debrief

### Purpose

Every agent in bob-ai — regardless of whether it writes code, researches topics, drafts documents, or reviews designs — follows the same lifecycle. This standardized workflow ensures that BoB can orchestrate any team composition, the Activity Hub receives predictable events, and calibrations are applied consistently.

### The Universal Agent Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  SPAWN   │───►│ DEBRIEF  │───►│   PLAN   │───►│   WORK   │───►│ COMPLETE │
│          │    │          │    │          │    │  (loop)  │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
  emit:           emit:           emit:           emit:           emit:
  agent.        agent.          agent.          tool.*          agent.
  spawned       debriefed       thinking        code.*          completed
                                                milestone.*     goal.completed
```

Each phase is described below.

### Phase 1: Spawn

**What happens:** BoB (or Team Lead) spawns the agent via the Cline SDK. The agent receives:

- Its role definition (from team template)
- Its task assignment (from Team Lead delegation)
- Its calibration rules (from `.bob/calibrations.json`, injected into system prompt)
- A reference to the Activity Hub's `emit()` function

**Event emitted:**

```typescript
emit("agent.spawned", {
  role: "UI Developer",
  task: "Build login form with email/password validation",
  calibration: {
    framework: "React Native",
    styling: "styled-components",
    preferences: ["Functional components", "TypeScript strict"],
  },
});
```

**Implementation note:** The Cline SDK's `spawn_agent` tool creates the agent process. bob-ai wraps this to inject calibration context and the Activity Hub emit function into the agent's tool set.

### Phase 2: Debrief

**What happens:** Before doing any work, the agent reads workspace context and calibrations to understand the environment. This is the "briefing" phase where the agent aligns its plan with project reality.

The agent:

1. Reads `.clinerules/` files (project conventions, architecture docs)
2. Reads `.bob/calibrations.json` (workspace preferences, team goals)
3. Scans relevant project structure (files, directories, existing patterns)
4. Formulates a plan with explicit sub-goals

**Event emitted:**

```typescript
emit("agent.debriefed", {
  context:
    "React Native project with TypeScript, using styled-components and Zustand",
  plan: "Build LoginForm screen with email/password fields, Zod validation, and navigation integration",
  subgoals: [
    "Read existing screen patterns in src/screens/",
    "Create LoginForm component with typed props",
    "Add Zod validation schema",
    "Integrate with React Navigation",
    "Write interaction tests",
  ],
});
```

**Why debrief matters:** Without debrief, agents dive into work based only on their task description and may ignore project conventions. The debrief phase ensures agents "look before they leap." It also gives the Activity Hub a preview of the work plan, which BoB can review and adjust before the agent proceeds.

**Debrief as a tool:** In the Cline SDK, the debrief step is implemented as a required tool call at the start of every agent session. The agent's system prompt includes:

```
Before starting any work, you MUST call the debrief tool to read workspace
context and calibrations. Do not proceed until debrief is complete.
```

### Phase 3: Plan

**What happens:** The agent breaks its task into concrete steps and emits thinking events. This is visible in the Activity View and helps users understand agent reasoning.

**Events emitted:**

```typescript
emit("agent.thinking", {
  step: 1,
  reasoning: "Checking existing screen patterns in src/screens/",
});
emit("agent.thinking", {
  step: 2,
  reasoning: "Found AuthScreen exists but needs refactoring",
});
emit("agent.thinking", {
  step: 3,
  reasoning: "Will create LoginForm as a child component of AuthScreen",
});
```

### Phase 4: Work (Loop)

**What happens:** The agent executes its plan, using tools and emitting events for each action. This is the core work phase — it loops until all sub-goals are achieved.

**Event emissions during work:**

```typescript
// Reading files
emit("tool.invoke", { tool: "read_file", args: "src/screens/AuthScreen.tsx" });

// Writing code
emit("tool.invoke", {
  tool: "write_file",
  args: "src/components/LoginForm.tsx",
});
emit("code.changed", {
  files: [
    {
      path: "src/components/LoginForm.tsx",
      additions: 68,
      deletions: 0,
      status: "new",
    },
  ],
});

// Running tests
emit("tool.invoke", { tool: "terminal", args: "npx jest --filter=LoginForm" });
emit("test.run", {
  command: "jest --filter=LoginForm",
  passed: 3,
  failed: 0,
  total: 3,
});

// Sub-goal achieved
emit("goal.progress", {
  goalId: "login-form",
  progress: 0.6,
  current: "Validation schema complete",
});
```

**Work in isolation (git worktrees):** For coding agents, each agent works in its own git worktree (see `docs/AGENT-WORKTREE-GUIDE.md`). This means agents can write code in parallel without conflicts. The worktree is created by the agent spawning process:

```bash
# BoB spawns UI Developer → creates worktree
bash scripts/create-agent-worktree.sh feat/login-form-ui

# Agent works in ../bob-ai-feat-login-form-ui/
# When done, creates PR
```

For non-coding agents (research, writing), worktrees are optional. The agent works in the main workspace or a designated output directory.

### Phase 5: Complete

**What happens:** The agent finishes all sub-goals and reports results.

**Events emitted:**

```typescript
emit("agent.completed", {
  result: "LoginForm component created with Zod validation and 3 passing tests",
  artifacts: [
    "src/components/LoginForm.tsx",
    "src/schemas/loginSchema.ts",
    "__tests__/LoginForm.test.tsx",
  ],
});

// If this completes a team-level goal, Team Lead emits:
emit("milestone.achieved", {
  title: "Login page complete",
  stats: { files: 4, tests: 8, agents: 2 },
});
```

### Error Handling

When an agent encounters an error:

```typescript
// Recoverable (agent retries)
emit("agent.error", {
  error: "npm install failed: ENOSPC",
  recoverable: true,
});
// Agent retries automatically (up to 3 times per calibration default)

// Non-recoverable (escalates to user)
emit("agent.error", {
  error: "Cannot resolve dependency conflict between react@18 and react@19",
  recoverable: false,
});
// This appears in the timeline (visibility: "timeline") because user action is needed
```

### The Agent Tools API

Each agent receives these tools (in addition to standard Cline SDK tools):

```typescript
interface BobAgentTools {
  // Activity Hub emission
  emit(type: string, payload: object): void;

  // Debrief (required first call)
  debrief(): { context: string; calibration: object; teamGoals: string[] };

  // Progress reporting
  report_progress(goalId: string, progress: number, current: string): void;
  report_milestone(title: string, stats: object): void;

  // Calibration reading
  read_calibration(): object;

  // Communication with Team Lead
  ask_lead(question: string): string;
  report_to_lead(result: string, artifacts: string[]): void;
}
```

**Note:** Agents don't get `report_to_user` — they report to the Team Lead, who reports to BoB, who reports to the user. This maintains the chain of command and keeps the user-facing timeline clean.

### What to Build

1. **Agent wrapper** — Wraps Cline SDK's `spawn_agent` to inject bob-ai tools and calibration
2. **Debrief tool** — Reads `.clinerules/`, `.bob/calibrations.json`, and workspace structure
3. **Progress/milestone helpers** — Convenience methods that call `emit()` with correct types
4. **Error retry logic** — Auto-retry with configurable limits from calibration
5. **Team Lead coordination** — `ask_lead` and `report_to_lead` for agent-to-lead communication

---

## 4. Calibration System

### Purpose

Calibration is how the user makes agents behave the way they want — consistently, across sessions, without repeating instructions. It's the "workspace memory" that turns generic agents into project-specific specialists.

The key insight is that calibration happens **conversationally** through BoB, but persists as **structured data** in the workspace. This means:

- Users never write JSON or config files
- BoB translates natural language preferences into deterministic rules
- Rules are stored locally, loaded automatically on every session
- Rules can be committed to git for team sharing

### The Calibration Hierarchy

Calibrations are layered. Lower layers override higher ones:

```
1. Global defaults       (shipped with bob-ai — sensible out-of-box behavior)
      ↓
2. Template defaults     (SWE team template has different defaults than Research team)
      ↓
3. Workspace calibrations (.bob/calibrations.json — persisted per project)
      ↓
4. Session overrides     (user says "just for this task, use X" — not persisted)
```

**Example:**

- Global default: "Use whatever test framework the project has"
- Template default (SWE): "Prefer Jest for JavaScript projects"
- Workspace calibration: "Use Vitest, not Jest"
- Session override: "Skip tests for this quick fix"

The agent receives the merged result: Vitest, but skip tests for this task.

### Calibration File Structure

```
.bob/
  calibrations.json        # Workspace calibrations (committed to git)
  teams/
    swe-mobile.json        # Custom team template (cloned + calibrated)
    swe-web.json           # Another custom template
  .gitignore               # Ignore history.db and temp files
```

### `calibrations.json` Schema

This is the primary calibration file. BoB reads it at the start of every session.

```typescript
interface WorkspaceCalibration {
  // Workspace identity
  workspace: {
    name: string; // Project name
    type: string; // "web-app" | "mobile-app" | "library" | "api" | "monorepo" | string
    description?: string; // Brief project description
  };

  // Team-level defaults (apply to all agents)
  teamDefaults: {
    template: string; // Base template ID (e.g., "swe-team")
    goals: {
      platform?: string; // "web" | "mobile" | "desktop" | "cross-platform"
      framework?: string; // "React" | "Vue" | "React Native" | etc.
      language?: string; // "TypeScript" | "Python" | "Go" | etc.
      testing?: string; // "Jest" | "Vitest" | "pytest" | etc.
      deployment?: string; // "Vercel" | "AWS" | "Expo" | etc.
    };
    constraints: string[]; // Rules that apply to all agents
    escalationRules: string[]; // When agents must ask the user
  };

  // Per-agent calibrations
  agentCalibrations: Record<string, AgentCalibration>;

  // Work history (auto-updated by BoB)
  history: {
    milestonesAchieved: string[];
    lastActiveTeam: string;
    totalTasks: number;
    lastSessionDate: string;
  };
}

interface AgentCalibration {
  // Specialization overrides
  specialization?: string; // e.g., "mobile" overrides generic "ui"
  framework?: string; // Agent-specific framework preference

  // Behavioral rules (deterministic)
  preferences: string[]; // Positive rules ("always do X")
  constraints: string[]; // Negative rules ("never do Y")

  // Decision-making calibration
  decisionStyle?: "autonomous" | "ask-first" | "ask-on-major";

  // Error handling
  retryLimit?: number; // How many times to retry on error (default: 3)
  errorEscalation?: "auto-fix" | "report-and-continue" | "stop-and-ask";

  // Communication style
  progressReporting?: "verbose" | "milestone-based" | "completion-only";
}
```

### How BoB Reads Calibrations

On every user message to a team:

```typescript
async function handleUserMessage(teamId: string, message: string) {
  // 1. Load calibrations
  const calibration = await readCalibrationFile();

  // 2. Determine which team template to use
  const teamConfig = await loadTeamConfig(teamId);

  // 3. Merge calibrations with template defaults
  const mergedConfig = mergeCalibrations(
    globalDefaults,
    teamConfig.templateDefaults,
    calibration,
    currentSessionOverrides,
  );

  // 4. Analyze user intent
  const taskAnalysis = await bobAnalyzeTask(message, mergedConfig);

  // 5. Check if current team composition fits
  if (taskAnalysis.needsSpecialistSwap) {
    // BoB suggests swapping an agent for a specialist
    // e.g., "For mobile checkout, I'll bring in a Payments specialist"
  }

  // 6. Spawn/delegate to team with calibrations injected
  await delegateToTeam(teamId, message, mergedConfig);
}
```

### Conversational Calibration Flow

The user calibrates through conversation, not forms. BoB asks **structured questions** with discrete options to ensure deterministic outcomes.

**Example: New project setup**

```
User: "Create a SWE team for my project"

BoB: "What kind of project?"
→ [Web app / Mobile app / API / Library / Other]
User: "Mobile app"

BoB: "Which framework?"
→ [React Native / Flutter / Swift/Kotlin / Other]
User: "React Native"

BoB: "State management?"
→ [Redux / Zustand / MobX / Context only / Let agent decide]
User: "Zustand"

BoB: "Testing approach?"
→ [Full coverage / Critical paths only / Interaction tests / None]
User: "Interaction tests"

BoB: "How should agents handle new dependencies?"
→ [Always ask first / Auto-add if popular / Never add without asking]
User: "Always ask first"

BoB: "Got it. Saving these as your workspace calibrations."
→ Writes .bob/calibrations.json
```

**Why structured questions:** Free-form instructions like "write clean code" are ambiguous — every LLM interprets them differently. Structured questions produce deterministic rules: `preferences: ["Zustand for state", "Interaction tests only"]`. These get injected verbatim into agent system prompts, leaving no room for interpretation.

### Calibration Categories

When calibrating an agent, BoB asks structured questions organized by category:

| Category            | Example Questions                                    | Why It Matters                    |
| ------------------- | ---------------------------------------------------- | --------------------------------- |
| **Code Style**      | Max file length? Naming convention? Comment density? | Ensures consistency across agents |
| **Dependencies**    | How to handle new packages? Approval needed?         | Prevents unexpected additions     |
| **Testing**         | Coverage target? What to test? Framework?            | Defines quality bar               |
| **Error Handling**  | Retry strategy? When to escalate?                    | Prevents silent failures          |
| **Communication**   | How often to report? What level of detail?           | Controls timeline noise           |
| **Decision Making** | Auto-proceed or ask permission? For what?            | Balances autonomy vs control      |
| **Architecture**    | File organization? Design patterns?                  | Maintains project structure       |

### BoB Intelligence: Specialist Swapping

BoB doesn't just load calibrations — it actively uses them to adapt team composition.

**Scenario:** User's workspace is calibrated as a React Native mobile app. User asks: "Build a web admin dashboard."

```typescript
// BoB reads calibration
const cal = readCalibration()
// cal.workspace.type = "mobile-app"
// cal.agentCalibrations.ui.framework = "React Native"

// BoB analyzes task: "web admin dashboard"
// Detects mismatch: mobile specialist needed for web task

// BoB asks user:
"Your workspace is set up for mobile (React Native).
The admin dashboard sounds like a web project. Should I:
1. Bring in a Web UI specialist for this task (keeps mobile as default)
2. Create a separate web team with its own calibrations
3. Build it in React Native Web"
```

This intelligence comes from BoB comparing `task requirements` against `workspace calibrations` and flagging mismatches.

### Calibration Evolution

BoB can learn from work patterns and suggest calibration updates:

```typescript
// After 5 tasks where user always adds TypeScript strict mode
bobNotice: "I've noticed you always prefer TypeScript strict mode.
Want me to save this as a workspace default?"

// User: "Yes"
// BoB updates .bob/calibrations.json:
// agentCalibrations.*.preferences += "TypeScript strict mode"
```

**V0 scope:** Basic pattern detection (repeated corrections) with user confirmation before persisting. No unsupervised calibration changes.

### What to Build

1. **`CalibrationStore`** — Read/write `.bob/calibrations.json` with validation
2. **`CalibrationMerger`** — Merge global → template → workspace → session layers
3. **`CalibrationInjector`** — Convert calibration rules into system prompt segments
4. **Structured question engine** — BoB's calibration conversation flow (question → options → persist)
5. **Specialist matching** — Compare task requirements vs calibration to suggest swaps
6. **Pattern detector** — Track repeated user corrections and suggest calibration updates

---

## 5. Storage Layer

### Purpose

bob-ai uses a **hybrid storage strategy** — different data types get different storage formats based on their access patterns, portability needs, and queryability requirements. This isn't a compromise; it's intentional. Config files that humans might read or commit to git use JSON. High-volume event data that needs filtering and search uses SQLite.

### Storage Decision Matrix

| Data Type              | Format           | Git-committed? | Why This Format                                 |
| ---------------------- | ---------------- | -------------- | ----------------------------------------------- |
| Workspace calibrations | JSON             | ✅ Yes         | Human-readable, diffable, shareable via repo    |
| Team templates         | JSON             | ✅ Yes         | Shareable, forkable, human-inspectable          |
| App settings           | JSON             | ✅ Yes         | Simple key-value, rarely changes                |
| Chat/timeline events   | SQLite           | ❌ No          | High volume, needs filtering/search/aggregation |
| Agent metrics          | SQLite           | ❌ No          | Needs aggregation queries (counts, averages)    |
| Milestone summaries    | JSON (extracted) | ✅ Yes         | Git-commit achievements for team visibility     |

### Directory Structure

```
project-root/
  .bob/
    calibrations.json      # Workspace calibrations
    config.json            # App-level settings (API keys, preferences)
    teams/
      swe-mobile.json      # Custom team template
      swe-web.json         # Another custom template
    milestones.json        # Extracted milestone log (human-readable summary)
    history.db             # SQLite: chat events, timeline, metrics
    .gitignore             # Ignores: history.db, *.db-journal, temp/
```

### `.bob/.gitignore`

```gitignore
# SQLite databases (local history, not shared)
*.db
*.db-journal
*.db-wal

# Temp files
temp/
```

### SQLite Schema

```sql
-- Timeline events (core storage for Activity Hub)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON string
  visibility TEXT NOT NULL,     -- 'timeline' | 'activity' | 'internal' | 'debug'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_events_team ON events(team_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_visibility ON events(visibility);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_team_visibility ON events(team_id, visibility);

-- Chat messages (user ↔ BoB conversation, separate from agent events)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,       -- 'bob' for BoB chat, team ID for team chats
  sender TEXT NOT NULL,        -- 'user' | 'bob'
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT,               -- JSON: attached card data, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_team ON messages(team_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- Agent metrics (aggregated stats per session)
CREATE TABLE agent_metrics (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,    -- Groups metrics per work session
  metric TEXT NOT NULL,        -- 'tool_calls' | 'files_changed' | 'tests_run' | etc.
  value REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_metrics_team_agent ON agent_metrics(team_id, agent_id);
CREATE INDEX idx_metrics_session ON agent_metrics(session_id);
```

### Common Queries

```sql
-- Get timeline events for a team (what the UI renders in chat)
SELECT * FROM events
WHERE team_id = ? AND visibility IN ('timeline')
ORDER BY timestamp ASC;

-- Get all visible events (timeline + activity) for activity view
SELECT * FROM events
WHERE team_id = ? AND visibility IN ('timeline', 'activity')
ORDER BY timestamp ASC;

-- Count agent communication turns (inter-agent messages)
SELECT agent_id, COUNT(*) as turns
FROM events
WHERE team_id = ? AND type = 'message.sent'
GROUP BY agent_id;

-- Get milestones for a team
SELECT * FROM events
WHERE team_id = ? AND type = 'milestone.achieved'
ORDER BY timestamp ASC;

-- Agent activity summary (for activity view metrics)
SELECT agent_id,
  COUNT(CASE WHEN type LIKE 'tool.%' THEN 1 END) as tool_calls,
  COUNT(CASE WHEN type LIKE 'code.%' THEN 1 END) as code_changes,
  COUNT(CASE WHEN type = 'agent.error' THEN 1 END) as errors,
  MAX(timestamp) as last_active
FROM events
WHERE team_id = ?
GROUP BY agent_id;

-- Full-text search across events (V1 enhancement with FTS5)
-- CREATE VIRTUAL TABLE events_fts USING fts5(type, payload, content=events);
```

### JSON File Schemas

#### `config.json` (App Settings)

```typescript
interface AppConfig {
  // API configuration
  api: {
    defaultProvider: "anthropic" | "openai" | "local";
    keys: Record<string, string>; // provider → encrypted key
  };

  // UI preferences
  ui: {
    verbosityLevel: "minimal" | "normal" | "detailed" | "debug";
    compactMode: boolean;
    theme: "dark"; // Only dark in V0
  };

  // Agent defaults
  agents: {
    defaultModel: string; // e.g., "claude-sonnet-4-20250514"
    maxConcurrentAgents: number; // Default: 4
    defaultRetryLimit: number; // Default: 3
  };
}
```

#### `milestones.json` (Extracted Summary)

This is auto-generated by BoB after each milestone, providing a git-committable record of achievements:

```typescript
interface MilestoneSummary {
  milestones: Array<{
    title: string;
    team: string;
    date: string; // ISO 8601
    stats: Record<string, number>;
    agents: string[]; // Which agents contributed
    relatedFiles?: string[]; // Key files created/modified
  }>;
}
```

### Data Flow: Write Paths

```
User sends message → messages table (SQLite)
                   → BoB processes
                   → Agent spawned → events table (SQLite)
                   → Agent works → events table (SQLite)
                   → Milestone achieved → events table (SQLite)
                                        → milestones.json (JSON, git-friendly)
                   → Calibration changed → calibrations.json (JSON, git-friendly)
```

### What to Build

1. **`SQLiteStore`** — Wrapper with typed query methods for events, messages, metrics
2. **`JSONStore`** — Read/write/validate JSON config files in `.bob/`
3. **`StorageInit`** — Creates `.bob/` directory and initializes SQLite schema on first run
4. **`MilestoneExtractor`** — Listens for milestone events and updates `milestones.json`
5. **Migration system** — Schema versioning for SQLite (simple version table + migration scripts)

---

## 6. Team Templates & Specialist Catalog

### Purpose

Teams are the unit of work in bob-ai. A team template defines: which agent roles are included, what each role does, and what default calibrations apply. Users create teams by cloning templates and calibrating them for their specific workspace.

BoB's intelligence comes from knowing the **specialist catalog** — the full menu of agent roles it can draw from — and matching specialists to task requirements.

### What Is a Team Template?

A team template is a JSON file that defines a reusable agent composition:

```typescript
interface TeamTemplate {
  id: string; // Unique identifier (e.g., "swe-team")
  name: string; // Display name (e.g., "SWE Team")
  description: string; // What this team is for
  version: string; // Template version

  roles: AgentRole[]; // The agents in this team

  defaults: {
    goals: Record<string, string>; // Default team goals
    constraints: string[]; // Default constraints
    escalationRules: string[]; // Default escalation rules
  };

  // Which calibration questions to ask when creating from this template
  calibrationFlow: CalibrationQuestion[];
}

interface AgentRole {
  id: string; // Role identifier (e.g., "ui", "backend")
  name: string; // Display name (e.g., "UI Developer")
  role: string; // Role category (e.g., "Frontend")
  description: string; // What this agent does
  systemPromptTemplate: string; // Base system prompt (calibrations get injected)

  // Specialist metadata
  specializations: string[]; // What this role can be specialized for (e.g., ["web", "mobile", "desktop"])
  tools: string[]; // Which tools this agent gets (e.g., ["read_file", "write_file", "terminal"])

  // Default calibration for this role
  defaultCalibration: AgentCalibration;
}

interface CalibrationQuestion {
  id: string;
  question: string;
  category: string; // "code-style" | "dependencies" | "testing" | etc.
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
  appliesTo: string[] | "*"; // Which agent roles this affects ("*" = all)
  defaultOption?: string; // Pre-selected if user skips
}
```

### Built-in Templates (Shipped with V0)

#### SWE Team

```json
{
  "id": "swe-team",
  "name": "SWE Team",
  "description": "Software engineering team for building features, fixing bugs, and maintaining code quality.",
  "roles": [
    {
      "id": "lead",
      "name": "Team Lead",
      "role": "Coordinator",
      "description": "Breaks down tasks, delegates to specialists, reviews results, reports milestones.",
      "specializations": ["project-management"],
      "tools": ["emit", "debrief", "spawn_agent", "read_file", "ask_lead"]
    },
    {
      "id": "ui",
      "name": "UI Developer",
      "role": "Frontend",
      "description": "Builds user-facing components, screens, and visual features.",
      "specializations": ["web", "mobile", "desktop"],
      "tools": [
        "emit",
        "debrief",
        "read_file",
        "write_file",
        "terminal",
        "web_search"
      ]
    },
    {
      "id": "backend",
      "name": "Backend Developer",
      "role": "Backend",
      "description": "Builds APIs, databases, server logic, and infrastructure.",
      "specializations": ["api", "database", "serverless", "microservices"],
      "tools": ["emit", "debrief", "read_file", "write_file", "terminal"]
    },
    {
      "id": "reviewer",
      "name": "Code Reviewer",
      "role": "Quality",
      "description": "Reviews code changes for quality, security, and consistency.",
      "specializations": ["security", "performance", "accessibility"],
      "tools": ["emit", "debrief", "read_file", "terminal"]
    }
  ]
}
```

#### Research Team

```json
{
  "id": "research-team",
  "name": "Research Team",
  "description": "Information gathering, analysis, and synthesis team.",
  "roles": [
    {
      "id": "lead",
      "name": "Research Lead",
      "role": "Coordinator",
      "description": "Plans research strategy, delegates queries, synthesizes findings."
    },
    {
      "id": "analyst",
      "name": "Analyst",
      "role": "Analysis",
      "description": "Deep-dives into topics, reads documentation, extracts insights."
    },
    {
      "id": "scout",
      "name": "Scout",
      "role": "Discovery",
      "description": "Searches the web, finds relevant sources, summarizes content."
    }
  ]
}
```

### The Specialist Catalog

The catalog is the full list of agent specializations that BoB knows about. When creating a team, BoB uses the catalog to match the right specialist to the task.

```typescript
interface SpecialistEntry {
  id: string; // e.g., "mobile-ui"
  baseRole: string; // e.g., "ui" (which template role this specializes)
  name: string; // e.g., "Mobile UI Developer"
  description: string;
  keywords: string[]; // Task keywords that trigger this specialist
  frameworks: string[]; // Associated frameworks
  calibrationDefaults: Partial<AgentCalibration>; // Pre-set calibration for this specialty
}

// V0 Specialist Catalog
const specialists: SpecialistEntry[] = [
  // UI Specialists
  {
    id: "web-ui",
    baseRole: "ui",
    name: "Web UI Developer",
    keywords: ["web", "browser", "spa"],
    frameworks: ["React", "Vue", "Svelte", "Next.js"],
  },
  {
    id: "mobile-ui",
    baseRole: "ui",
    name: "Mobile UI Developer",
    keywords: ["mobile", "ios", "android", "app"],
    frameworks: ["React Native", "Flutter", "Swift", "Kotlin"],
  },
  {
    id: "desktop-ui",
    baseRole: "ui",
    name: "Desktop UI Developer",
    keywords: ["desktop", "electron", "tauri"],
    frameworks: ["Electron", "Tauri"],
  },

  // Backend Specialists
  {
    id: "api-backend",
    baseRole: "backend",
    name: "API Developer",
    keywords: ["api", "rest", "graphql"],
    frameworks: ["Express", "Fastify", "NestJS", "Django", "FastAPI"],
  },
  {
    id: "db-backend",
    baseRole: "backend",
    name: "Database Engineer",
    keywords: ["database", "schema", "migration", "sql"],
    frameworks: ["PostgreSQL", "MongoDB", "Prisma"],
  },
  {
    id: "infra-backend",
    baseRole: "backend",
    name: "Infrastructure Engineer",
    keywords: ["deploy", "ci/cd", "docker", "kubernetes"],
    frameworks: ["Docker", "K8s", "Terraform"],
  },

  // Non-Coding Specialists
  {
    id: "researcher",
    baseRole: "analyst",
    name: "Research Analyst",
    keywords: ["research", "analyze", "compare", "evaluate"],
  },
  {
    id: "writer",
    baseRole: "analyst",
    name: "Technical Writer",
    keywords: ["document", "write", "readme", "guide"],
  },
  {
    id: "designer",
    baseRole: "analyst",
    name: "UX Designer",
    keywords: ["design", "wireframe", "ux", "user flow"],
  },
];
```

### Team Creation Flow: Clone → Calibrate

```
1. User: "Create a team for my React Native app"
2. BoB selects template: swe-team (keywords match "app")
3. BoB checks specialist catalog: "React Native" → mobile-ui specialist
4. BoB swaps generic "UI Developer" for "Mobile UI Developer"
5. BoB asks calibration questions (from template's calibrationFlow)
6. User answers
7. BoB creates .bob/teams/swe-mobile.json (cloned + calibrated template)
8. Team ready
```

### What to Build

1. **`TemplateStore`** — Load/save team templates from `.bob/teams/`
2. **`SpecialistCatalog`** — Match task keywords → specialist entries
3. **`TeamFactory`** — Clone template + apply specialist swaps + calibration
4. **Built-in templates** — Ship SWE team + Research team as defaults
5. **Calibration flow engine** — Walk through template's calibrationFlow questions

---

## 7. Timeline & Chat

### Purpose

The timeline is the user's window into team activity. It's not a chat app — it's a **work log** rendered as a conversation. User messages and BoB responses live alongside agent activity events, creating a single chronological view of everything that happened.

The timeline consumes events from the Activity Hub and user/BoB messages from the messages table, merging them into one sorted stream.

### Data Sources

The timeline combines two data streams:

```
Timeline = merge(
  messages.where(team_id = currentTeam).sortBy(timestamp),
  events.where(team_id = currentTeam, visibility IN filter).sortBy(timestamp)
)
```

- **Messages** (user ↔ BoB): Stored in the `messages` SQLite table
- **Events** (agent activity): Stored in the `events` SQLite table, filtered by visibility

### Timeline Item Rendering

Each item in the timeline has a type that determines how it renders. The UI maps event types to visual components:

| Data Source | Type                       | Renders As                                 |
| ----------- | -------------------------- | ------------------------------------------ |
| messages    | user message               | Right-aligned bubble with purple tint      |
| messages    | BoB message                | Left-aligned bubble with cyan avatar       |
| events      | `delegation.sent`          | Compact row: Lead → Agent: task            |
| events      | `code.changed`             | Card with file list + diff stats           |
| events      | `test.run`                 | Inline result: ✓ N passed, ✗ N failed      |
| events      | `milestone.achieved`       | Full-width banner, green accent, no avatar |
| events      | `agent.error`              | Red-tinted card with error details         |
| events      | `tool.invoke` (if verbose) | Compact chip: ⚡ Agent › tool › args       |
| events      | `web.search` (if verbose)  | Card with query + results                  |
| events      | unknown type               | Generic card: type name + JSON payload     |

### The "Speaking to BoB" Contract

A critical UX requirement: the user must always feel they're talking to **BoB**, not to individual agents.

**How this works in the timeline:**

1. User sends a message → stored as `messages.sender = "user"`
2. BoB always responds first → stored as `messages.sender = "bob"`
3. BoB's response may be brief: "On it. Delegating to the team."
4. Agent events appear below BoB's message (delegations, tool use, etc.)
5. When work completes, BoB summarizes: "Done. Here's what happened."

**Visual reinforcement:**

- Input area shows `👻 BoB` label (always visible)
- In team view: `👻 BoB · SWE Team` shows BoB is the bridge
- Input placeholder: "Tell BoB what you need..."
- BoB's messages use cyan accent (his signature color)
- Agent events use their respective colors but are clearly nested under BoB's response

### Timeline Implementation

```typescript
interface TimelineItem {
  id: string;
  timestamp: number;
  source: "message" | "event";

  // If source = "message"
  message?: {
    sender: "user" | "bob";
    content: string;
    metadata?: any;
  };

  // If source = "event"
  event?: ActivityEvent;
}

class TimelineManager {
  private hub: ActivityHub;
  private db: SQLiteStore;

  // Load initial timeline for a team
  async loadTimeline(
    teamId: string,
    verbosity: string,
  ): Promise<TimelineItem[]> {
    const messages = await this.db.getMessages(teamId);
    const visibilityFilter = this.getVisibilityFilter(verbosity);
    const events = await this.hub.query({
      teamId,
      visibility: visibilityFilter,
    });

    return this.mergeAndSort(messages, events);
  }

  // Subscribe to real-time updates
  subscribeToUpdates(
    teamId: string,
    callback: (item: TimelineItem) => void,
  ): () => void {
    // Subscribe to new messages
    const unsubMsg = this.db.onNewMessage(teamId, (msg) => {
      callback({
        id: msg.id,
        timestamp: msg.timestamp,
        source: "message",
        message: msg,
      });
    });

    // Subscribe to new events
    const unsubEvent = this.hub.subscribe("timeline", (event) => {
      if (event.teamId === teamId) {
        callback({
          id: event.id,
          timestamp: event.timestamp,
          source: "event",
          event,
        });
      }
    });

    return () => {
      unsubMsg();
      unsubEvent();
    };
  }
}
```

### Milestone Rendering (Special Treatment)

Milestones get elevated visual treatment to break the timeline rhythm:

**Data:**

```typescript
{
  type: "milestone.achieved",
  payload: {
    title: "Login page complete",
    stats: { files: 4, tests: 8, agents: 2 }
  }
}
```

**Rendering rules:**

- Full-width (no avatar, no left/right alignment)
- Centered text
- Green accent color (success/achievement)
- Horizontal lines above and below
- Subtle gradient background
- Stats line in muted gray below title
- Never collapses — always visible as a timeline anchor

### What to Build

1. **`TimelineManager`** — Merge messages + events into sorted timeline stream
2. **`TimelineRenderer`** — Map event types to UI components (UI-agnostic interface)
3. **Real-time subscription** — Live updates as agents emit events
4. **Verbosity filter** — Control which events appear based on user preference
5. **Milestone rendering** — Special-case handler for milestone events

---

## 8. Non-Coding Agents

### Purpose

bob-ai is not just for software engineering. The same event-driven architecture, calibration system, and team structure must work for **any agent type** — research, writing, design, data analysis, project management, or entirely novel roles.

This section documents how the universal patterns adapt to non-coding workflows, ensuring the system doesn't accidentally assume "agent = code writer."

### What Makes Non-Coding Agents Different?

| Aspect                | Coding Agent                    | Non-Coding Agent                                   |
| --------------------- | ------------------------------- | -------------------------------------------------- |
| **Primary output**    | Files (code)                    | Documents, reports, analyses, recommendations      |
| **Tools**             | read_file, write_file, terminal | web_search, web_scrape, write_file (docs), emit    |
| **Workspace**         | Git worktree                    | Shared output directory or project root            |
| **Isolation**         | Branch per agent                | No branch needed (no merge conflicts on docs)      |
| **Progress tracking** | Tests pass, files changed       | Sections written, sources found, analysis complete |
| **Milestones**        | "Feature complete"              | "Research report done", "All sources reviewed"     |
| **Calibration**       | Framework, testing, code style  | Tone, depth, format, sources, audience             |

### The Universal Contract Still Applies

Non-coding agents follow the exact same lifecycle:

```
SPAWN → DEBRIEF → PLAN → WORK → COMPLETE
```

They use the exact same event types:

```typescript
// Research agent lifecycle
emit("agent.spawned", { role: "Research Analyst", task: "Compare React Native vs Flutter" })
emit("agent.debriefed", { context: "Mobile app project, need framework comparison", plan: "..." })
emit("tool.invoke", { tool: "web_search", args: "React Native vs Flutter 2026 comparison" })
emit("web.search", { query: "...", results: [...] })
emit("tool.invoke", { tool: "web_scrape", args: "https://blog.example.com/rn-vs-flutter" })
emit("web.scrape", { url: "...", summary: "...", wordCount: 2400 })
emit("agent.thinking", { step: 3, reasoning: "Flutter has better performance but smaller ecosystem" })
emit("code.changed", { files: [{ path: "docs/framework-comparison.md", additions: 120, status: "new" }] })
emit("milestone.achieved", { title: "Framework comparison complete", stats: { sources: 8, pages: 3 } })
emit("agent.completed", { result: "Comparison report ready", artifacts: ["docs/framework-comparison.md"] })
```

**Key insight:** The event types are already generic enough. `code.changed` works for any file, not just code. `tool.invoke` works for any tool. The system doesn't need separate "non-coding event types."

### Non-Coding Calibration

Calibration for non-coding agents uses different categories but the same structured question approach:

#### Research Agent Calibration

```
BoB: "Research depth?"
→ [Quick overview / Standard analysis / Deep dive with primary sources]

BoB: "Output format?"
→ [Bullet points / Structured report / Comparison table / Narrative]

BoB: "Source requirements?"
→ [Any sources / Prefer official docs / Academic only / Industry blogs OK]

BoB: "Audience?"
→ [Technical team / Non-technical stakeholders / Mixed]
```

#### Writer Agent Calibration

```
BoB: "Writing tone?"
→ [Technical / Conversational / Formal / Marketing]

BoB: "Document structure?"
→ [Free-form / Templated (intro-body-conclusion) / Q&A format]

BoB: "Length target?"
→ [Brief (< 500 words) / Standard (500-2000) / Comprehensive (2000+)]
```

#### Designer Agent Calibration

```
BoB: "Design deliverables?"
→ [Wireframes / Mockups / User flows / All of the above]

BoB: "Design tool preference?"
→ [Figma / Sketch / Text-based descriptions / ASCII art]

BoB: "Design system?"
→ [Material Design / Apple HIG / Custom / None]
```

### Non-Coding Team Templates

#### Content Team

```json
{
  "id": "content-team",
  "name": "Content Team",
  "description": "Documentation, blog posts, marketing copy, and technical writing.",
  "roles": [
    { "id": "lead", "name": "Content Lead", "role": "Coordinator" },
    { "id": "writer", "name": "Technical Writer", "role": "Writing" },
    { "id": "editor", "name": "Editor", "role": "Review" },
    { "id": "researcher", "name": "Research Assistant", "role": "Research" }
  ]
}
```

#### Analysis Team

```json
{
  "id": "analysis-team",
  "name": "Analysis Team",
  "description": "Data analysis, market research, competitive analysis, and strategic recommendations.",
  "roles": [
    { "id": "lead", "name": "Analysis Lead", "role": "Coordinator" },
    { "id": "analyst", "name": "Data Analyst", "role": "Analysis" },
    { "id": "scout", "name": "Market Scout", "role": "Discovery" }
  ]
}
```

### Custom Event Types for Non-Coding Work

While the core event types cover most scenarios, non-coding agents may emit domain-specific events. These get stored and rendered generically in V0:

```typescript
// Design agent
emit("design.wireframe.created", {
  screen: "login",
  format: "text-description",
});
emit("design.userflow.mapped", { flow: "onboarding", steps: 5 });

// Content agent
emit("content.draft.written", {
  document: "API guide",
  wordCount: 1200,
  sections: 4,
});
emit("content.reviewed", {
  document: "API guide",
  suggestions: 3,
  approved: true,
});

// Analysis agent
emit("analysis.data.collected", {
  source: "competitor-analysis",
  dataPoints: 45,
});
emit("analysis.insight.found", {
  insight: "Competitor X lacks mobile support",
  confidence: 0.8,
});
```

The Activity Hub stores all of these. The UI renders them as generic cards showing the event type + payload. In V1+, agents could register rendering schemas for richer display.

### What to Build

1. **Non-coding templates** — Ship Research, Content, and Analysis team templates
2. **Non-coding calibration flows** — Structured questions for research, writing, design
3. **Generic event renderer** — Fallback UI for unknown event types (type name + formatted payload)
4. **Output directory support** — For agents that produce documents instead of code (configurable per team)
5. **No-worktree agent spawning** — Spawn agents without git worktree for non-code work

---

## 9. Implementation Phases

> This section describes **what to build and in what order**. Each phase produces a working, testable subsystem. Later phases depend on earlier ones, so the ordering matters — but within each phase the individual pieces can often be built in parallel. The descriptions are deliberately verbose: a developer reading a phase should understand not just _what_ to implement, but _why each piece exists_ and _how it connects to the rest of the system_.

---

### Implementation Progress

| Phase                                           | Status                     | Tests       |
| ----------------------------------------------- | -------------------------- | ----------- |
| Phase 1: Foundation (Storage + Event System)    | ✅ Complete                | 16/16       |
| Phase 2: Agent Integration (Workflow + Debrief) | ✅ Complete                | 12/12       |
| Phase 3: Calibration System                     | ✅ Complete                | 19/19       |
| Phase 4: Team Templates                         | ✅ Complete                | 18/18       |
| Phase 5: BoB Orchestrator                       | ✅ Complete                | 17/17       |
| Phase 6: Timeline & UI Integration              | ✅ Complete                | 15/15       |
| Phase 7: Polish & Edge Cases                    | ✅ Complete                | 22/22       |
| **Total**                                       | **✅ All phases complete** | **119/119** |

---

### Phase 1: Foundation (Storage + Event System) ✅

**Why this is first:** Every other component — agents, calibration, timeline, BoB itself — needs somewhere to persist data and something to push events through. Without storage and the event bus, nothing else can be built or tested. This phase creates the skeleton that all future organs attach to.

#### Storage Initialization

The very first thing the app does on launch is ensure the `.bob/` directory exists in the workspace root. If it doesn't, create it along with the full directory structure described in §5: `calibrations.json` (with sensible empty-state defaults), `config.json` (with placeholder API key fields), the `teams/` subdirectory, and a `.gitignore` that excludes SQLite databases and temp files. This initialization must be idempotent — running it on an already-initialized workspace should change nothing.

#### SQLite Store

Implement a `SQLiteStore` class that wraps the SQLite database at `.bob/history.db`. This class owns the schema (the `events`, `messages`, and `agent_metrics` tables described in §5), creates them if they don't exist, and provides typed query methods for each table. The schema should include a `schema_version` table so that future migrations can be applied automatically. Every query method should accept an optional transaction parameter so that callers can group writes atomically when needed — this matters because the Activity Hub may persist an event and update a metric in the same logical operation.

Why SQLite and not a simpler approach: the event table will grow to thousands of rows per session. Filtering by team, type, visibility, and time range requires indexed queries, not full-file scans. JSON files can't provide this without reimplementing a database poorly.

#### JSON Store

Implement a `JSONStore` class for reading and writing the JSON config files in `.bob/`. This is simpler than SQLite — it handles file I/O, JSON parsing, and schema validation. The key design requirement is that writes must be atomic (write to temp file, then rename) to prevent corruption if the app crashes mid-write. The store should validate against TypeScript interfaces on read so that malformed files fail loudly rather than causing mysterious downstream errors.

#### Activity Hub Core

With storage in place, build the `ActivityHub` class — the central event bus described in §2. This is the most important piece in the entire system. Start with three methods:

**`emit(teamId, agentId, type, payload)`** — The write path. Receives a raw event from an agent, assigns it a UUID and timestamp, resolves its visibility using the type-to-visibility rules map, persists it to SQLite, and then pushes it to any active subscribers. The visibility rules map is a simple object mapping event type strings to visibility levels (timeline, activity, internal, debug). Unknown event types default to "activity" — this ensures that custom events from non-coding agents are stored and surfaceable even if no one anticipated them.

**`subscribe(filter, callback)`** — The real-time path. UI components (or any consumer) register a callback with a filter string. The filter can be `"*"` (all events), a visibility level like `"timeline"`, or a type prefix like `"tool.*"`. The subscribe method returns an unsubscribe function. Internally, maintain a `Map<string, Set<callback>>` for efficient dispatch.

**`query(opts)`** — The history path. Loads events from SQLite with filtering by team, type, visibility, and time range. This is how the timeline loads its initial state when the user opens a team chat.

#### Event Aggregation

Build a basic aggregation layer inside the hub. When three or more consecutive `tool.invoke` events arrive from the same agent using the same tool within a 10-second window, batch them into a single `tool.batch` event for subscribers. The individual events are always persisted to SQLite (nothing is lost), but subscribers receive the compact form. This prevents the UI from rendering 15 consecutive "read_file" chips when an agent scans a directory. The aggregation buffer should flush on tool change, agent change, or timeout — whichever comes first.

#### Verification

At the end of Phase 1, the system should pass a round-trip test: emit an event, query it back by team and visibility, and confirm a subscriber received it in real time. The SQLite database should contain the event with correct visibility. The aggregation engine should batch consecutive same-tool events and pass through everything else unchanged.

---

### Phase 2: Agent Integration (Workflow + Debrief)

**Why this is second:** The Activity Hub exists, but nothing is emitting events into it yet. This phase connects the Cline SDK's agent spawning to the bob-ai event system, giving agents the tools they need to participate in the hub's event-driven world. Without this bridge, agents are just standalone LLM sessions with no connection to the rest of the app.

#### Agent Wrapper

The Cline SDK provides `spawn_agent` for creating agent processes. bob-ai needs to wrap this function to inject additional tools and context before the agent starts working. The wrapper takes a role definition (from a team template), a task assignment, and a calibration object, then calls `spawn_agent` with an augmented tool set that includes `emit`, `debrief`, `report_progress`, `report_milestone`, `ask_lead`, and `report_to_lead`. The wrapper also injects calibration rules directly into the agent's system prompt as deterministic instructions (see §4 on CalibrationInjector).

Why a wrapper instead of modifying the SDK: the Cline SDK is a dependency we don't control. Wrapping it keeps our additions separate and upgradeable.

#### The Debrief Tool

Every agent's first action must be calling the `debrief` tool. This tool reads three things: `.clinerules/` files (project conventions), `.bob/calibrations.json` (workspace preferences and team goals), and a scan of the relevant project structure (file listing, key directories). It returns a structured summary that the agent uses to plan its work. The debrief also emits an `agent.debriefed` event to the Activity Hub containing the agent's context assessment and initial plan.

Why debrief is mandatory and not optional: without it, agents operate from their task description alone and may produce work that contradicts project conventions. Debrief is the mechanism that makes calibrations _actually take effect_ — it's where the agent reads the rules and commits to following them. The system prompt should include an explicit instruction: "You MUST call the debrief tool before starting any work. Do not proceed until debrief is complete."

#### Agent-to-Hub Tools

Implement the `emit` tool that agents call to push events to the Activity Hub. This is a thin wrapper — the agent calls `emit("tool.invoke", { tool: "read_file", args: "src/App.vue" })` and the wrapper calls `hub.emit(teamId, agentId, type, payload)` with the correct team and agent IDs (injected at spawn time). Agents should never need to know their team ID or their own agent ID — these are closure variables captured by the wrapper.

Build convenience tools on top: `report_progress(goalId, progress, current)` wraps `emit("goal.progress", ...)`, and `report_milestone(title, stats)` wraps `emit("milestone.achieved", ...)`. These exist because milestone and progress events have specific payload shapes that we want to enforce at the call site rather than relying on agents to get the shape right.

#### Agent Communication Tools

Implement `ask_lead(question)` and `report_to_lead(result, artifacts)`. These allow specialist agents to communicate with their Team Lead — asking clarifying questions or reporting completed work. Under the hood, these emit `message.sent` events (visibility: "internal" by default) and block until the lead responds. The lead-to-agent communication flows through the same mechanism in reverse.

Why agents talk to leads and not to users: this maintains the "Speaking to BoB" contract. If agents could message the user directly, the timeline would become a chaotic multi-party chat. Instead, the chain is always User ↔ BoB ↔ Team Lead ↔ Specialists.

#### Lifecycle Event Emission

Wire the agent wrapper so that lifecycle transitions automatically emit the correct events. When `spawn_agent` is called, emit `agent.spawned`. When debrief completes, emit `agent.debriefed`. The thinking events (`agent.thinking`) are emitted by the agent itself during the PLAN phase. When the agent finishes, emit `agent.completed`. When an error occurs, emit `agent.error` with the `recoverable` flag — the wrapper handles retry logic based on the calibration's `retryLimit` setting (default: 3 retries for recoverable errors).

#### Workspace Isolation

For coding agents, integrate with the existing `scripts/create-agent-worktree.sh` to create a git worktree before the agent starts working. The worktree gives each coding agent its own branch and working directory, so multiple agents can write code simultaneously without merge conflicts. When the agent completes, it creates a PR from its worktree branch.

For non-coding agents (research, writing, analysis), skip the worktree. These agents work in the project root or a designated output directory. They don't need branch isolation because their output (documents, reports) rarely conflicts.

#### Verification

At the end of Phase 2, the system should pass an integration test: spawn an agent through the wrapper, confirm it calls debrief first, confirm lifecycle events appear in the Activity Hub's SQLite store, confirm the agent can emit custom events, and confirm it completes with a milestone event. For coding agents, confirm the worktree was created and the agent worked inside it.

---

### Phase 3: Calibration System

**Why this is third:** Agents can now spawn and emit events, but they don't know anything about the user's project preferences. This phase builds the workspace memory that makes agents context-aware. It also introduces the conversational calibration flow that lets users configure agents through BoB without touching config files.

#### Schema and Validation

Define the `WorkspaceCalibration` and `AgentCalibration` TypeScript interfaces exactly as specified in §4. Build a validation function that checks a parsed JSON object against these interfaces and returns clear error messages for any violations. This validator runs every time calibrations are read, so malformed files are caught immediately rather than causing agent misbehavior.

#### CalibrationStore

Implement the `CalibrationStore` class that reads and writes `.bob/calibrations.json`. Reads are synchronous (the file is small) and return a validated `WorkspaceCalibration` object. Writes are atomic (temp file + rename). The store exposes methods for updating specific sections — `updateTeamDefaults(partial)`, `updateAgentCalibration(agentId, partial)`, `addConstraint(constraint)` — so that BoB can make surgical edits without overwriting the entire file.

#### CalibrationMerger

Build the four-layer merge logic described in §4: global defaults → template defaults → workspace calibrations → session overrides. Each layer can override specific fields from the layer above, but unset fields inherit from the parent. The merger produces a final, flattened calibration object that represents the effective rules for a given agent in a given session. This is the object that gets injected into agent system prompts.

Why four layers: global defaults ensure the system works out of the box. Template defaults let team types have different starting points (a research team has different defaults than a SWE team). Workspace calibrations are the user's persistent preferences. Session overrides let the user say "just for this task, skip tests" without changing their permanent settings.

#### CalibrationInjector

Convert the merged calibration object into text segments that get prepended to an agent's system prompt. This is where structured data becomes natural language instructions: `preferences: ["Zustand for state", "Functional components"]` becomes `"You must use Zustand for state management. You must write functional components, not class components."` The injector should produce deterministic output — the same calibration always produces the same prompt text, so behavior is reproducible.

#### Structured Question Engine

Build the engine that powers BoB's calibration conversations. Given a `CalibrationQuestion[]` array (from a team template), the engine presents questions one at a time, collects the user's choice, and maps the answer to a calibration update. Each question has discrete options (not free text) to ensure deterministic outcomes. The engine supports skipping questions (uses the default option) and going back to revise a previous answer.

#### Session Override Support

Implement a transient calibration layer that lives in memory, not in `.bob/calibrations.json`. When the user says "just for this task, use X," BoB creates a session override that gets merged on top of workspace calibrations. Session overrides are discarded when the team finishes its current task or the app restarts.

#### Verification

At the end of Phase 3, the full calibration pipeline should work: create a calibration file through the question engine, restart the app, confirm the calibrations load, spawn an agent, and confirm the agent's system prompt contains the correct injected rules. Session overrides should take effect immediately and disappear on restart.

---

### Phase 4: Team Templates

**Why this is fourth:** Agents can spawn with calibrations, but there's no structured way to define which agents make up a team or how to create new teams. This phase introduces team templates — the blueprints that BoB uses to assemble the right agents for the job — and the specialist catalog that lets BoB swap generic roles for task-specific experts.

#### Built-in Templates

Ship three templates as JSON files bundled with the app (not in `.bob/`, which is per-workspace). The SWE team template (Lead, UI Developer, Backend Developer, Code Reviewer) covers software engineering tasks. The Research team template (Research Lead, Analyst, Scout) covers information gathering. The Content team template (Content Lead, Technical Writer, Editor, Research Assistant) covers documentation and writing work. Each template includes its role definitions, default calibrations, and a calibration question flow.

Why three templates: they cover the most common use cases (build software, research something, write something) and demonstrate the template pattern for users who want to create custom templates later. The templates are also test fixtures for the template system itself.

#### TemplateStore

Implement the `TemplateStore` class that loads templates from two sources: the built-in templates (shipped with the app) and custom templates in `.bob/teams/`. Custom templates take precedence over built-ins with the same ID, allowing users to fork and modify defaults. The store provides listing, loading by ID, and saving (for new custom templates).

#### Specialist Catalog

Build the keyword-matching system described in §6. The catalog is a static list of specialist entries, each with keywords, frameworks, and calibration defaults. When BoB creates a team, it runs the user's task description and workspace type against the catalog to find matching specialists. For example, a workspace calibrated as "mobile-app" with "React Native" triggers the `mobile-ui` specialist, which replaces the generic `ui` role with a `Mobile UI Developer` that comes pre-calibrated for React Native.

Why keyword matching instead of LLM classification: keyword matching is deterministic, fast, and debuggable. If the wrong specialist is selected, you can inspect the keyword list and fix it. LLM classification would be a black box that might change behavior between model versions.

#### TeamFactory

Implement the `TeamFactory` that takes a template, applies specialist swaps from the catalog, overlays the workspace calibration, and produces a ready-to-use team configuration. The factory also saves the resulting team as a custom template in `.bob/teams/` so it can be reused without re-calibrating. The factory is the assembly line: template in, calibrated team out.

#### Calibration Flow Engine

Build the engine that walks through a template's `calibrationFlow` questions when creating a new team. This is distinct from the generic structured question engine in Phase 3 — it specifically handles the team creation flow where BoB asks what kind of project the user is working on, what frameworks they prefer, and how agents should behave. Answers feed into both the workspace calibration and the agent-specific calibrations.

#### Verification

At the end of Phase 4, the full team creation flow should work: user describes their project to BoB, BoB selects a template from the store, the specialist catalog swaps in the right experts, the calibration flow collects preferences, and a custom team is saved to `.bob/teams/`. Loading that team on a subsequent session should produce agents with the correct roles and calibrations.

---

### Phase 5: BoB Orchestrator

**Why this is fifth:** All the pieces exist — storage, event hub, agents with calibration, team templates — but nobody is driving the car. This phase builds BoB's intelligence: the system prompt that defines his personality and capabilities, the task analysis that determines what to do with a user's request, and the orchestration logic that coordinates the full message-to-milestone flow.

#### BoB's System Prompt

BoB is an LLM agent himself, powered by the Cline SDK. His system prompt is the most important prompt in the system because it defines the user's entire experience. The prompt must establish BoB's identity (friendly team manager, the user's single point of contact), enumerate his capabilities (create teams, calibrate agents, delegate tasks, report results), and inject the current workspace's calibration context. The prompt is partially static (identity, capabilities) and partially dynamic (calibration data, active teams, recent history injected on each message).

Why BoB is an LLM agent and not hard-coded logic: the range of user requests is too wide for rule-based routing. BoB needs to understand natural language intent, handle ambiguity ("make it better"), ask clarifying questions, and adapt his communication style. Only an LLM can do this. The calibration system constrains his behavior so he's not purely generative — he operates within deterministic guardrails.

#### Task Analysis

When the user sends a message, BoB must determine: is this a request to create a team, calibrate settings, execute a task, ask a question, or something else? Implement a task analysis step where BoB's LLM evaluates the message against the current state (active teams, calibrations, recent context) and produces a structured intent. The intent determines which code path runs next — team creation, calibration update, task delegation, or direct response.

#### Specialist Mismatch Detection

Before delegating a task, BoB compares the task requirements against the workspace calibrations. If the task needs a web UI specialist but the workspace is calibrated for mobile, BoB flags the conflict and asks the user how to proceed (swap specialist for this task, create a new team, or adapt). This is the "calibration conflict detection" pattern from §10. The detection logic runs on every task delegation, not just team creation.

#### Orchestration Flow

Wire BoB into the full flow described in §1: user message → calibration load → task analysis → team selection → Team Lead spawning → specialist delegation → event monitoring → milestone detection → summary response. BoB delegates to the Team Lead (not directly to specialists), and the Team Lead handles sub-delegation. This two-layer delegation keeps BoB's scope manageable and lets the Team Lead make tactical decisions about how to split work.

BoB must always respond to the user _before_ agent events start appearing in the timeline. This is the "Speaking to BoB" contract — the user sends a message, BoB acknowledges immediately ("On it. Delegating to the team."), and then agent activity events flow in below BoB's response. When the team finishes, BoB summarizes the results in a final message.

#### Calibration Evolution

Implement basic pattern detection: if BoB observes the user correcting an agent's behavior three or more times with the same correction (e.g., "use strict mode"), BoB suggests persisting this as a workspace calibration. The user must confirm before any calibration file is updated — BoB never writes calibrations silently. In V0, this is limited to detecting repeated corrections; more sophisticated learning (suggesting optimizations, predicting preferences) is deferred to V1.

#### Verification

At the end of Phase 5, the full end-to-end flow should work: user sends a task message, BoB responds immediately, delegates to a team, agents work and emit events through the hub, milestones are achieved, and BoB delivers a summary. The user should feel they're having a conversation with BoB, not operating a multi-agent system.

---

### Phase 6: Timeline & UI Integration

**Why this is sixth:** The entire backend works — BoB orchestrates, agents emit events, storage persists everything — but the user can't see any of it. This phase connects the event system to the visual interface, making agent activity visible and the conversation with BoB tangible. It's deliberately late in the build order because the UI is a consumer of data, not a producer; building it earlier would mean constantly changing it as the data shapes evolved.

#### TimelineManager

Build the `TimelineManager` class that merges two data streams into a single sorted view: chat messages (from the `messages` SQLite table) and activity events (from the `events` table, filtered by the current verbosity level). The manager provides both a `loadTimeline(teamId)` method for initial page load and a `subscribeToUpdates(teamId, callback)` method for real-time streaming. The merge is a simple timestamp sort — messages and events interleave naturally based on when they occurred.

#### Real-Time Updates

When an agent emits an event or BoB sends a message, the timeline should update immediately without polling. The TimelineManager subscribes to both the Activity Hub (for events) and the message store (for new BoB/user messages), wrapping each into a `TimelineItem` and pushing it to the UI callback. The UI appends the new item, auto-scrolls if the user is at the bottom, and does not scroll if the user has scrolled up to read history.

#### Event Type Renderers

Build a renderer for each core event type that will appear in the timeline. Delegation events render as compact breadcrumb rows (Lead → Agent: task). Code change events render as cards with file paths and diff stats. Test run events render inline with pass/fail counts. Milestone events render as full-width banners with green accent — they must visually break the timeline rhythm so users can scan for achievement points. Error events render with red accent and include the error message plus a retry affordance if the error was recoverable.

Build a **generic fallback renderer** for any event type not in the core set. This renderer displays the event type name and a formatted view of the payload JSON. This ensures that custom events from non-coding agents (§8) always have a representation in the timeline, even before dedicated renderers are built for them.

#### The "Speaking to BoB" Visual Contract

Every visual detail of the input area and message display should reinforce that the user is talking to BoB. The input area carries a persistent `👻 BoB` label. In team context, the label extends to `👻 BoB · SWE Team` to show BoB is the bridge between the user and the team. The input placeholder reads "Tell BoB what you need..." BoB's messages use his signature cyan accent. Agent events are visually subordinate — present but clearly not the user's conversational partner.

#### Verbosity Filter

Expose a control (toggle, dropdown, or similar) that lets the user switch between verbosity levels: Minimal (timeline events only — milestones, code changes, errors), Normal (timeline + activity events — tool use, delegations, web searches), Detailed (everything except debug), and Debug (everything including internal agent-to-agent messages). The filter works by changing which visibility levels the TimelineManager includes in its query and subscription filters. Changing verbosity should immediately update the visible timeline without a full reload.

#### Verification

At the end of Phase 6, the user should see a live, updating timeline when agents work. Milestones should be visually prominent. BoB's presence should be unmistakable. Switching verbosity should show/hide event categories instantly. The timeline should feel like a work log, not a chat app.

---

### Phase 7: Polish & Edge Cases

**Why this is last:** Everything works, but software that merely works is not software people trust. This phase handles the unglamorous details that separate a prototype from a product: what happens on restart, what happens when things fail, what happens when there's nothing to show yet. These aren't features — they're the absence of broken experiences.

#### App Restart Resilience

When the app restarts, the system must seamlessly reconnect: reload calibrations from `.bob/calibrations.json`, reopen the SQLite database at `.bob/history.db`, and restore the timeline to its previous state (load the last-viewed team's events). If agents were running when the app closed, their state is lost (Cline SDK agents don't survive process termination), but their emitted events are safe in SQLite. The UI should show a "Session ended — agents were interrupted" notice for any team that had active agents.

#### Graceful Error Handling

Agent errors that are marked `recoverable: true` should trigger automatic retry (up to the calibration's `retryLimit`). Each retry is logged as a new `agent.error` event so the user can see it happened. Non-recoverable errors appear in the timeline with a red accent, a clear description of what went wrong, and an affordance to retry the entire task or dismiss the error. BoB should acknowledge errors in his next message rather than silently moving on.

#### Empty States

A new workspace with no `.bob/` directory, a team with no chat history, a first-time user who hasn't created any teams — all of these need thoughtful empty states. The app should detect these conditions and present guidance: "No teams yet — tell BoB about your project to get started." Empty states are not error states; they're onboarding opportunities.

#### Team Lifecycle Controls

Implement the ability to pause a running team (agents stop emitting, work is suspended), resume it (agents pick up where they left off, or restart if state was lost), and stop it entirely (agents are terminated, worktrees can be cleaned up). These controls exist because long-running tasks need user oversight — a user should be able to walk away and come back without worrying that agents ran amok.

#### Team Switching

When the user switches between team chats, the UI must preserve scroll position for the previous team and load the correct timeline for the new team. This means the TimelineManager needs to support multiple concurrent subscriptions (one per loaded team) or efficiently tear down and rebuild subscriptions on switch.

#### Milestone Extraction

Build the `MilestoneExtractor` that listens for `milestone.achieved` events and appends them to `.bob/milestones.json`. This creates a human-readable, git-committable record of what the team has accomplished. The file is append-only during a session and structured as described in §5.

#### Performance

Limit the initial timeline load to the most recent N events (suggested: 200) with a "load more" pagination mechanism that fetches older events from SQLite on demand. For teams with thousands of events, rendering the entire history on load would cause visible lag. The pagination boundary should be invisible to the user — scrolling up near the top triggers a fetch.

#### API Key Security

Store API keys in `.bob/config.json` using encryption rather than plaintext. Use the operating system's keychain API (macOS Keychain, Windows Credential Manager, Linux Secret Service) where available, falling back to AES encryption with a machine-specific key. This prevents API keys from being accidentally committed to git or exposed in file listings.

#### Verification

At the end of Phase 7, the app should survive all edge cases gracefully: restart without data loss, handle agent failures visibly, guide new users through empty states, let users control running teams, switch between teams smoothly, and protect sensitive credentials. The goal is not just "it works" but "it feels solid."

---

## 10. Patterns & Examples

### Pattern: Full Task Flow (SWE Team)

This shows every event emitted during a complete task, from user message to milestone.

```
USER MESSAGE: "Add a login page with email/password auth"

→ messages.insert(sender: "user", content: "Add a login page...")

BOB RESPONSE: "On it. I'll coordinate the SWE team for this."

→ messages.insert(sender: "bob", content: "On it...")
→ hub.emit("agent.spawned", agentId: "lead", { role: "Team Lead", task: "Login page" })

TEAM LEAD DEBRIEF:
→ hub.emit("agent.debriefed", agentId: "lead", { plan: "Parallel UI + Backend work" })

DELEGATION:
→ hub.emit("delegation.sent", agentId: "lead", { from: "lead", to: "ui", task: "Build LoginForm component" })
→ hub.emit("delegation.sent", agentId: "lead", { from: "lead", to: "backend", task: "Auth API + JWT" })

UI DEVELOPER WORK:
→ hub.emit("agent.spawned", agentId: "ui", { role: "UI Developer" })
→ hub.emit("agent.debriefed", agentId: "ui", { plan: "Create form with validation" })
→ hub.emit("tool.invoke", agentId: "ui", { tool: "read_file", args: "src/components/" })
→ hub.emit("tool.invoke", agentId: "ui", { tool: "write_file", args: "LoginForm.vue" })
→ hub.emit("code.changed", agentId: "ui", { files: [{ path: "LoginForm.vue", additions: 68, status: "new" }] })
→ hub.emit("agent.completed", agentId: "ui", { result: "LoginForm created", artifacts: ["LoginForm.vue"] })

BACKEND DEVELOPER WORK (in parallel):
→ hub.emit("agent.spawned", agentId: "backend", { role: "Backend Dev" })
→ hub.emit("tool.invoke", agentId: "backend", { tool: "write_file", args: "auth.ts" })
→ hub.emit("tool.invoke", agentId: "backend", { tool: "terminal", args: "npm test" })
→ hub.emit("test.run", agentId: "backend", { passed: 5, failed: 0, total: 5 })
→ hub.emit("code.changed", agentId: "backend", { files: [{ path: "auth.ts", additions: 45 }, { path: "middleware.ts", additions: 32 }] })
→ hub.emit("agent.completed", agentId: "backend", { result: "Auth API ready" })

MILESTONE:
→ hub.emit("milestone.achieved", agentId: "lead", { title: "Login page complete", stats: { files: 4, tests: 8, agents: 2 } })

BOB SUMMARY: "Done! Login page with auth is ready. 4 files, 8 tests passing."

→ messages.insert(sender: "bob", content: "Done! Login page with auth is ready...")
```

**What the user sees in timeline (visibility: "timeline"):**

1. User message: "Add a login page..."
2. BoB: "On it."
3. 🐕 Lead → 🦋 UI: Build LoginForm component
4. 🐕 Lead → 🐛 Backend: Auth API + JWT
5. 📝 Code Changes: LoginForm.vue (+68 new)
6. 📝 Code Changes: auth.ts (+45), middleware.ts (+32)
7. ✓ Tests: 5 passed
8. 👑 **Login page complete** — 4 files · 8 tests · 2 agents
9. BoB: "Done! Login page with auth is ready."

---

### Pattern: Full Task Flow (Research Team)

```
USER MESSAGE: "Compare React Native vs Flutter for our mobile app"

BOB: "I'll have the research team analyze this."

RESEARCH LEAD DELEGATION:
→ hub.emit("delegation.sent", { from: "lead", to: "scout", task: "Find recent comparisons and benchmarks" })
→ hub.emit("delegation.sent", { from: "lead", to: "analyst", task: "Analyze framework fit for our project requirements" })

SCOUT WORK:
→ hub.emit("tool.invoke", agentId: "scout", { tool: "web_search", args: "React Native vs Flutter 2026" })
→ hub.emit("web.search", agentId: "scout", { query: "...", results: [{title: "...", url: "..."}] })
→ hub.emit("tool.invoke", agentId: "scout", { tool: "web_scrape", args: "https://blog.example.com/comparison" })
→ hub.emit("web.scrape", agentId: "scout", { url: "...", summary: "...", wordCount: 3200 })
→ hub.emit("agent.completed", agentId: "scout", { result: "8 sources collected", artifacts: [] })

ANALYST WORK:
→ hub.emit("agent.thinking", agentId: "analyst", { reasoning: "Flutter has Dart, RN has JavaScript ecosystem advantage" })
→ hub.emit("tool.invoke", agentId: "analyst", { tool: "write_file", args: "docs/framework-comparison.md" })
→ hub.emit("code.changed", agentId: "analyst", { files: [{ path: "docs/framework-comparison.md", additions: 120, status: "new" }] })
→ hub.emit("agent.completed", agentId: "analyst", { result: "Analysis complete", artifacts: ["docs/framework-comparison.md"] })

MILESTONE:
→ hub.emit("milestone.achieved", { title: "Framework comparison complete", stats: { sources: 8, pages: 3, recommendation: "React Native" } })

BOB: "Research complete. Based on your project's JavaScript codebase, the team recommends React Native. Full comparison is in docs/framework-comparison.md."
```

---

### Pattern: Calibration Conflict Detection

```
EXISTING CALIBRATION:
  workspace.type = "mobile-app"
  agentCalibrations.ui.framework = "React Native"

USER MESSAGE: "Build a web admin dashboard"

BOB ANALYSIS:
  Task requires: web UI
  Calibration has: mobile UI (React Native)
  CONFLICT: mobile specialist assigned to web task

BOB RESPONSE:
  "Your workspace is calibrated for mobile (React Native).
   The admin dashboard sounds like a web project. Should I:
   1. Bring in a Web UI specialist for this task
   2. Create a separate web team
   3. Build it with React Native Web"

USER: "Option 1"

BOB ACTION:
  1. Swap "mobile-ui" specialist for "web-ui" specialist (this session only)
  2. Keep workspace calibration unchanged
  3. Spawn team with web-ui agent
```

---

### Pattern: Calibration Evolution

```
SESSION 1: User corrects agent → "Use TypeScript strict mode"
SESSION 2: User corrects agent → "Use TypeScript strict mode"
SESSION 3: User corrects agent → "Use TypeScript strict mode"

BOB DETECTS PATTERN:
  "I've noticed you always want TypeScript strict mode.
   Want me to save this as a workspace default?"

USER: "Yes"

BOB UPDATES .bob/calibrations.json:
  teamDefaults.goals.language = "TypeScript strict"

BOB: "Done. All agents will use TypeScript strict mode by default now."
```

---

### Anti-Pattern: What NOT to Build

| Don't                          | Why                             | Instead                                       |
| ------------------------------ | ------------------------------- | --------------------------------------------- |
| Agent-specific UI components   | Couples UI to agent types       | Generic event renderers + type-based dispatch |
| Hard-coded team compositions   | Can't adapt to non-coding teams | Template + catalog system                     |
| Chat-based agent communication | Too noisy for timeline          | Event-driven delegation + hidden message.sent |
| Client-side event storage      | Can't query, can't search       | SQLite with structured queries                |
| Monolithic orchestrator        | BoB becomes too complex         | Layered: BoB → Team Lead → Specialists        |
| Per-agent calibration UI       | Too many settings panels        | Conversational calibration through BoB        |

---

## Appendix: Related Documentation

| Document                         | Purpose                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `docs/01-OVERVIEW.md`            | Project overview, first use case, tech stack               |
| `docs/02-ARCHITECTURE.md`        | System architecture, Cline SDK integration                 |
| `docs/03-UX-DESIGN.md`           | Chat-first philosophy, core flows                          |
| `docs/06-AGENT-HOOKS.md`         | Hook system, debrief tool, pre-launch briefing             |
| `docs/08-FEATURES.md`            | Feature hierarchy (must-have / should-have / nice-to-have) |
| `docs/11-UX-DESIGN-DECISIONS.md` | Visual design decisions, color system, icon vocabulary     |
| `docs/12-CHAT-TIMELINE-SPEC.md`  | Timeline item types, visual specs, milestone design        |
| `docs/AGENT-WORKTREE-GUIDE.md`   | Git worktree setup for parallel agent work                 |
