# bob-ai — Agent-Generated Hooks & Workflows

## Concept

Agents don't just follow hooks — they can **create their own**. When an agent identifies a recurring quality issue or process gap, it can generate a hook or workflow that automates the fix for all future work.

This creates a **self-improving system** where teams get smarter over time.

## How It Works

### The Self-Improvement Loop

```
1. Agent completes task
2. Agent notices a pattern (e.g., "tests were missing again")
3. Agent creates a hook to prevent this in the future
4. Hook becomes part of the team's workflow
5. Future tasks automatically benefit from the new check
```

### Agent Creates a Hook

Agents have access to a `create_hook` tool:

```typescript
const createHookTool = createTool({
  name: 'create_hook',
  description: 'Create a custom hook to automate validation or process steps',
  inputSchema: z.object({
    name: z.string().describe('Hook name (e.g., require-unit-tests)'),
    stage: z.enum([
      'before_file_write',
      'after_file_write',
      'before_git_commit',
      'after_git_commit',
      'before_pr_create',
      'after_task_complete',
    ]),
    description: z.string().describe('What this hook does'),
    prompt: z.string().describe('Natural language instructions for the hook agent'),
    assignedAgent: z.string().describe('Which team agent should execute this hook'),
    onFailure: z.enum(['block', 'warn']).default('warn'),
  }),
  async execute(input, context) {
    // 1. Save hook definition to workspace
    const hookPath = path.join(
      context.cwd,
      `.clinerules/bob-ai/hooks/${input.name}.json`
    )

    const hookDef = {
      name: input.name,
      stage: input.stage,
      description: input.description,
      prompt: input.prompt,
      assignedAgent: input.assignedAgent,
      onFailure: input.onFailure,
      createdBy: context.agentId,
      createdAt: new Date().toISOString(),
    }

    await fs.writeFile(hookPath, JSON.stringify(hookDef, null, 2))

    // 2. Register hook with active runtime
    await registerHookWithRuntime(hookDef)

    return {
      created: true,
      hookPath,
      message: `Hook "${input.name}" registered for ${input.stage}`,
    }
  },
})
```

### Example: Agent Creates Test Enforcement Hook

```
Reviewer Agent: I noticed the last 3 PRs were missing unit tests.
               Let me create a hook to enforce this.

[Calls create_hook with:
  name: "require-unit-tests"
  stage: "before_pr_create"
  description: "Ensures all changed source files have corresponding test files"
  prompt: "Check that every modified .ts file in src/ has a corresponding
           .test.ts file. If any are missing, list them and block the PR."
  assignedAgent: "code-reviewer"
  onFailure: "block"]

Reviewer Agent: ✅ Created hook: require-unit-tests
               Future PRs will be blocked if tests are missing.
```

### Example: Agent Creates Documentation Hook

```
Team Lead: After every feature, I want docs updated automatically.

[Calls create_hook with:
  name: "update-docs-after-feature"
  stage: "after_task_complete"
  description: "Updates README and API docs after feature completion"
  prompt: "Review what was changed in this task. Update the README.md
           and any relevant API documentation to reflect the new feature.
           If the feature adds a new endpoint, update the API reference."
  assignedAgent: "backend-agent"
  onFailure: "warn"]
```

## Agent Creates a Workflow

For multi-step processes, agents can create full workflows:

```typescript
const createWorkflowTool = createTool({
  name: 'create_workflow',
  description: 'Create a multi-step workflow that chains multiple hooks together',
  inputSchema: z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(z.object({
      hookStage: z.string(),
      agentId: z.string(),
      prompt: z.string(),
      onFailure: z.enum(['block', 'warn', 'continue']),
    })),
  }),
  async execute(input, context) {
    const workflowPath = path.join(
      context.cwd,
      `.clinerules/bob-ai/workflows/${input.name}.json`
    )

    await fs.writeFile(workflowPath, JSON.stringify({
      ...input,
      createdBy: context.agentId,
      createdAt: new Date().toISOString(),
    }, null, 2))

    return {
      created: true,
      workflowPath,
      steps: input.steps.length,
    }
  },
})
```

### Example: Agent Creates PR Quality Pipeline

```
Reviewer Agent: I'll set up a full quality pipeline for PRs.

[Calls create_workflow with:
  name: "pr-quality-pipeline"
  description: "Full quality check before PR creation"
  steps: [
    { hookStage: "before_pr_create", agentId: "code-reviewer",
      prompt: "Run linting on all changed files", onFailure: "block" },
    { hookStage: "before_pr_create", agentId: "code-reviewer",
      prompt: "Verify test coverage is above 80%", onFailure: "block" },
    { hookStage: "before_pr_create", agentId: "ux-researcher",
      prompt: "Validate changes meet original requirements", onFailure: "warn" },
    { hookStage: "before_pr_create", agentId: "code-reviewer",
      prompt: "Check for security vulnerabilities", onFailure: "block" },
  ]]
```

## Hook Storage

Agent-generated hooks are stored as JSON in the workspace:

```
.clinerules/bob-ai/hooks/
├── require-unit-tests.json
├── update-docs-after-feature.json
└── validate-commit-format.json

.clinerules/bob-ai/workflows/
├── pr-quality-pipeline.json
└── research-validation.json
```

These files are **version controlled** — you can review, edit, or delete them. They persist across sessions.

## User Approval (Optional)

When an agent creates a hook, bob-ai can optionally ask for user approval:

```
┌─ New Hook Created ────────────────────────────────┐
│                                                    │
│ Code Reviewer wants to create a new hook:         │
│                                                    │
│ Name: require-unit-tests                          │
│ Trigger: Before PR Create                         │
│ Action: Block PR if tests missing                 │
│                                                    │
│ Prompt:                                           │
│ "Check that every modified .ts file in src/       │
│  has a corresponding .test.ts file..."            │
│                                                    │
│ [Approve & Activate]  [Edit First]  [Reject]     │
└────────────────────────────────────────────────────┘
```

## Hooks in the Visual Workflow Builder

Agent-generated hooks automatically appear in the Workflow Builder UI. Users can:
- See all active hooks (both user-created and agent-created)
- Drag agent-created hooks to reorder or reconfigure
- Disable/enable individual hooks
- Edit the prompt or behavior of any hook
- Delete hooks they don't want

## Learning Across Teams

Future feature: Successful hooks from one team can be **suggested** to other teams working on similar projects:

```
💡 The SWE Team on project-A created a "require-unit-tests" hook
   that has caught 12 issues. Would you like to add it to this team?

   [Add Hook]  [Dismiss]
```
