# bob-ai — Visual Workflow Builder

## Concept

The Visual Workflow Builder lets users configure automation hooks by **dragging and dropping** components — no code required. Each hook is a "lego block" that connects a trigger event to an agent action with a natural language prompt.

## How It Works

### 1. The Canvas

The workflow canvas shows a visual timeline of hooks that run before, during, and after team work.

```
┌─ Workflow Builder ─────────────────────────────────┐
│                                                     │
│  HOOK LIBRARY          CANVAS                      │
│                                                     │
│  📝 Before:            ┌─ Before Code Write ─────┐ │
│   • Code Write         │ Agent: Code Reviewer     │ │
│   • Git Commit         │ Prompt: "Review for..."  │ │
│   • PR Create          │ On fail: ● Block  ○ Warn │ │
│   • File Delete        └──────────┬───────────────┘ │
│                                   ↓                 │
│  ✅ After:              ┌─ After Code Write ──────┐ │
│   • Code Write         │ Agent: UX Researcher     │ │
│   • Git Commit         │ Prompt: "Validate UX..." │ │
│   • PR Created         │ On fail: ○ Block  ● Warn │ │
│   • Task Complete      └──────────┬───────────────┘ │
│                                   ↓                 │
│  🔄 Continuous:         ┌─ After Task Complete ───┐ │
│   • Every N minutes    │ Agent: Code Reviewer     │ │
│   • On file change     │ Prompt: "Run all tests"  │ │
│   • On git push        │ On fail: ● Block  ○ Warn │ │
│                        └──────────────────────────┘ │
│  🎯 Custom:                                        │
│   • [+ Create]         [Save Workflow] [Test Run]  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. Dragging a Hook

User drags "Before Git Commit" from the library → drops on canvas → hook node appears.

### 3. Configuring a Hook

Click on any hook node to open its configuration panel:

```
┌─ Configure Hook ───────────────────────────────────┐
│                                                     │
│ Trigger: Before Git Commit                         │
│                                                     │
│ Assigned Agent:                                    │
│ [Code Reviewer                              ▼]    │
│                                                     │
│ Prompt (what should the agent do?):                │
│ ┌─────────────────────────────────────────────┐    │
│ │ Review this commit for:                     │    │
│ │                                              │    │
│ │ 1. Conventional commit message format       │    │
│ │ 2. No debug logs or temp files included     │    │
│ │ 3. All changed files have corresponding     │    │
│ │    tests                                     │    │
│ │                                              │    │
│ │ If any issue found, block the commit and    │    │
│ │ explain what needs to be fixed.              │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ On Success: ○ Allow  ● Ask for approval            │
│ On Failure: ● Block  ○ Warn only                   │
│                                                     │
│ Include context:                                   │
│ ☑ Original task description                        │
│ ☑ Project knowledge docs                           │
│ ☑ Recent decision logs                             │
│ ☐ Full conversation history                        │
│                                                     │
│            [Cancel]  [Save Hook]                   │
└─────────────────────────────────────────────────────┘
```

### 4. Running a Workflow

When the team is working, hooks execute automatically at their trigger points. The Activity Monitor shows hook execution in real-time:

```
Activity Monitor:
│ ● Backend Agent writing src/api/auth.ts...
│ ↳ 🔗 Hook triggered: Before Code Write
│ ↳ ● Code Reviewer analyzing code...
│ ↳ ✅ Hook passed — allowing write
│ ● Backend Agent file written successfully
```

## Hook Library

### Before Actions (Interceptors)

| Hook | Trigger | Common Use |
|---|---|---|
| Before Code Write | Agent is about to write a file | Code review, standards validation |
| Before Git Commit | Agent is about to commit | Commit message format, test coverage |
| Before PR Create | Agent is about to open a PR | Requirements check, lint |
| Before File Delete | Agent is about to delete a file | Safety check, confirmation |
| Before API Call | Agent is about to call external API | Rate limit check, auth validation |

### After Actions (Reactors)

| Hook | Trigger | Common Use |
|---|---|---|
| After Code Write | File was written | Run tests, update docs |
| After Git Commit | Commit was made | Notify, log, trigger CI |
| After PR Created | PR was opened | Auto-assign reviewers |
| After Task Complete | Agent finished its task | Quality check, summary |
| After Agent Response | Agent produced output | Validate, enrich |

### Continuous (Watchers)

| Hook | Trigger | Common Use |
|---|---|---|
| Every N Minutes | Timer-based | Polling PRs, checking status |
| On File Change | File system event | Auto-lint, auto-test |
| On Git Push | New push detected | Trigger review pipeline |

### Custom Hooks

Users can create hooks with:
- Custom trigger name
- Custom prompt template
- Assignable to any agent

## Non-Technical User Flow

**Scenario: Research team lead wants citation validation**

1. Create team with "Researcher" and "Citation Validator" agents
2. Open Workflow Builder
3. Drag "After Agent Response" hook to canvas
4. Click to configure:
   - Assign to "Citation Validator"
   - Prompt: "Check if this research has proper citations and sources. If any claims are unsupported, flag them."
   - On Failure: Warn
5. Save workflow
6. Now every research output is automatically validated

**No code written. No YAML edited. Just drag, prompt, save.**

## Workflow Data Model

```typescript
interface Workflow {
  id: string
  teamId: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
}

interface WorkflowNode {
  id: string
  type: 'hook' | 'agent' | 'condition'
  position: { x: number, y: number }
  config: {
    hookType?: string          // 'before_code_write', etc.
    agentId?: string           // Which agent executes
    prompt?: string            // Natural language instructions
    onSuccess?: 'allow' | 'approve' | 'continue'
    onFailure?: 'block' | 'warn' | 'retry'
    contextSources?: string[]  // 'task', 'knowledge', 'decisions'
  }
}

interface WorkflowConnection {
  from: string  // node ID
  to: string    // node ID
}
```

## Future: Conditional Logic

Visual "if/else" nodes for branching workflows:

```
Before PR Create
       ↓
   [If: has tests?]
   ├── Yes → Allow PR
   └── No → Block PR + feedback
```

This is a future feature — Phase 1 focuses on linear hook chains.

## Future: Workflow Templates

Pre-built workflows that users can install:

- **SWE Quality Gate** — Code review + test validation + commit standards
- **Research Pipeline** — Citation check + fact validation + summary
- **Content Review** — Brand voice + grammar + SEO check
- **PR Monitor** — Watch for new PRs + auto-review + summarize
