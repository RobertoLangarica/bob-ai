# bob-ai — Knowledge System

## Purpose

The Knowledge System gives agents **pre-digested context** about your project. Instead of agents discovering patterns from scratch every time, they can reference knowledge docs that explain architecture, conventions, and decisions upfront.

## Directory Structure

```
my-project/
├── .clinerules/
│   └── bob-ai/
│       ├── team-briefing.md              # Injected before every team launch
│       ├── decision-log-template.md      # Template for decision docs
│       ├── git-standards.md              # Git commit/branch/PR rules
│       ├── knowledge/
│       │   ├── architecture.md           # System architecture overview
│       │   ├── auth-patterns.md          # How auth works in this project
│       │   ├── database-schema.md        # DB conventions and schema
│       │   ├── api-conventions.md        # API naming, error handling
│       │   └── testing-patterns.md       # How we write tests here
│       └── teams/
│           ├── swe-team.rules.md         # SWE team-specific rules
│           └── research-team.rules.md    # Research team-specific rules
└── .bob-ai/                              # Runtime state (gitignored)
    └── decision-log/
        ├── 2026-04-11-auth-approach.md
        └── 2026-04-12-component-library.md
```

## Pre-Launch Briefing

Every time a team starts work, the briefing document is automatically injected into each agent's system prompt. This ensures agents always know the project's ground rules.

### Example: team-briefing.md

```markdown
# Project Briefing

You are working in the **{PROJECT_NAME}** workspace managed by bob-ai.

## Standards

### Decision Logging
- Document significant technical decisions in `.bob-ai/decision-log/`
- Use the `log_decision` tool — include context, options, choice, rationale
- Every architectural choice must be logged

### Git Standards
- Commits: Conventional format `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore
- Branches: `feature/{ticket-id}-{short-desc}`
- Never commit: debug logs, temp files, credentials
- Tag commits with `bob-ai:{task-id}` for traceability

### Persistence & Tracking
- Store work artifacts in `.bob-ai/work/{task-id}/`
- Update decision log when making architecture choices

### Knowledge Base
Before making design decisions, read relevant knowledge docs:
- Architecture: `.clinerules/bob-ai/knowledge/architecture.md`
- Use the `read_knowledge` tool to access these docs
```

## How Briefing Is Injected

```typescript
async function buildTeamSystemPrompt(teamConfig, workspace) {
  // 1. Load base briefing
  const briefingPath = path.join(workspace, '.clinerules/bob-ai/team-briefing.md')
  const briefing = await fs.readFile(briefingPath, 'utf-8')

  // 2. Load team-specific rules
  const teamRulesPath = path.join(
    workspace,
    `.clinerules/bob-ai/teams/${teamConfig.name}.rules.md`
  )
  const teamRules = await tryReadFile(teamRulesPath, '')

  // 3. Load relevant knowledge based on task keywords
  const knowledgeDocs = await loadRelevantKnowledge(workspace, teamConfig.currentTask)

  // 4. Compose into system prompt
  return `
${teamConfig.baseSystemPrompt}

## PROJECT CONTEXT
${briefing}

## TEAM RULES
${teamRules}

## RELEVANT KNOWLEDGE
${knowledgeDocs.map(doc => `### ${doc.title}\n${doc.content}`).join('\n\n')}
`
}
```

## Knowledge Query Tool

Agents can access knowledge docs on-demand during work:

```typescript
const readKnowledgeTool = createTool({
  name: 'read_knowledge',
  description: 'Read a knowledge document from the project knowledge base',
  inputSchema: z.object({
    topic: z.string().describe('Knowledge topic to read (e.g., "architecture", "auth-patterns")'),
  }),
  async execute({ topic }, context) {
    const knowledgeDir = path.join(context.cwd, '.clinerules/bob-ai/knowledge')
    const files = await fs.readdir(knowledgeDir)
    const match = files.find(f => f.includes(topic))

    if (!match) {
      return { found: false, available: files.map(f => f.replace('.md', '')) }
    }

    const content = await fs.readFile(path.join(knowledgeDir, match), 'utf-8')
    return { found: true, topic, content }
  },
})
```

**Agent usage example**:
```
Agent: I need to implement authentication. Let me check the project's auth patterns.
[Calls read_knowledge with topic="auth-patterns"]
Agent: According to the knowledge base, this project uses JWT with refresh tokens...
```

## Decision Log Tool

Enforces decision tracking through a structured tool:

```typescript
const logDecisionTool = createTool({
  name: 'log_decision',
  description: 'Log a significant technical decision to the project decision log',
  inputSchema: z.object({
    title: z.string().describe('Short title for the decision'),
    context: z.string().describe('Why this decision was needed'),
    optionsConsidered: z.array(z.string()).describe('Options evaluated'),
    chosenOption: z.string().describe('The chosen option'),
    rationale: z.string().describe('Why this option was best'),
  }),
  async execute(input, context) {
    const date = new Date().toISOString().split('T')[0]
    const slug = input.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const filename = `${date}-${slug}.md`
    const logDir = path.join(context.cwd, '.bob-ai/decision-log')
    await fs.mkdir(logDir, { recursive: true })

    const content = `# ${input.title}

**Date**: ${date}
**Status**: Accepted

## Context
${input.context}

## Options Considered
${input.optionsConsidered.map((o, i) => `${i + 1}. ${o}`).join('\n')}

## Decision
${input.chosenOption}

## Rationale
${input.rationale}
`

    await fs.writeFile(path.join(logDir, filename), content)
    return { logged: true, path: `.bob-ai/decision-log/${filename}` }
  },
})
```

## Git Standards Tool

Enforces commit conventions:

```typescript
const commitChangesTool = createTool({
  name: 'commit_changes',
  description: 'Commit changes following project git standards',
  inputSchema: z.object({
    type: z.enum(['feat', 'fix', 'refactor', 'docs', 'test', 'chore']),
    scope: z.string().optional(),
    description: z.string(),
    taskId: z.string().optional(),
  }),
  async execute(input, context) {
    const message = input.scope
      ? `${input.type}(${input.scope}): ${input.description}`
      : `${input.type}: ${input.description}`

    const fullMessage = input.taskId
      ? `${message}\n\nbob-ai:${input.taskId}`
      : message

    // Execute git commit via shell
    return { committed: true, message: fullMessage }
  },
})
```

## Team-Specific Rules Example

```markdown
# SWE Team Rules (.clinerules/bob-ai/teams/swe-team.rules.md)

## Role Distribution
- UX Agent: Research, user flows, wireframes
- UI Agent: Component implementation, styling
- Backend Agent: API endpoints, database logic
- Code Reviewer: Standards enforcement, quality checks

## Collaboration Protocol
1. UX completes research → saves to .bob-ai/work/{task-id}/ux-spec.md
2. UI reads UX spec → implements components
3. Backend reads UX spec → implements API
4. All code reviewed before commit

## Required Artifacts Per Task
- UX specification document
- Component documentation (if UI changes)
- API documentation update (if backend changes)
- Unit tests for all new code
- Decision log entry (if architectural choice made)
```

## UI: Knowledge Viewer

The Knowledge view in bob-ai shows:

```
┌─ Knowledge Base ──────────────────────────────────┐
│                                                    │
│ 📂 .clinerules/bob-ai/knowledge/                  │
│                                                    │
│  📄 architecture.md          Last edited: Apr 10  │
│  📄 auth-patterns.md         Last edited: Apr 8   │
│  📄 database-schema.md       Last edited: Apr 5   │
│  📄 api-conventions.md       Last edited: Apr 3   │
│  📄 testing-patterns.md      Last edited: Mar 28  │
│                                                    │
│ [+ Add Knowledge Doc]  [Open in Editor]           │
│                                                    │
│ 📂 .bob-ai/decision-log/                          │
│                                                    │
│  📋 2026-04-11 — Auth approach: JWT tokens        │
│  📋 2026-04-12 — Component library: Naive UI      │
│                                                    │
└────────────────────────────────────────────────────┘
```

Users can:
- Browse knowledge docs and decision logs
- Add new knowledge docs through the UI
- Open docs in their default editor for editing
- See which docs agents have recently accessed
