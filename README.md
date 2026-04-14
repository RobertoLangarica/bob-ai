# bob-ai

Multi-agent orchestration through a single conversational interface.

## What it is

A desktop app for managing teams of AI agents. The user interacts with **BoB** — an orchestrator agent that creates teams, delegates tasks, and reports results. Individual agents are never exposed directly.

Built on the [Cline SDK](https://github.com/cline/cline) (`@clinebot/agents`, `@clinebot/core`, `@clinebot/llms`) for agent spawning, tool execution, and LLM communication. bob-ai handles the layer above: team composition, calibration persistence, activity monitoring, and the chat interface.

## Architecture

```
User ↔ BoB (orchestrator) ↔ Team Lead ↔ Specialist agents
                                            ↕
                                      Activity Hub (event bus)
                                            ↕
                                   SQLite (events) + .bob/ (config)
```

- **Activity Hub** — Central event bus. Agents emit structured events (`tool.invoke`, `code.changed`, `milestone.achieved`, etc.). UI subscribes. Events are persisted to SQLite and filtered by visibility rules.
- **Calibration system** — Workspace preferences stored in `.bob/calibrations.json`. Four-layer merge: global defaults → template defaults → workspace calibrations → session overrides. Injected into agent system prompts as deterministic rules.
- **Team templates** — JSON definitions of agent compositions. Ships with SWE, Research, and Content teams. Users create custom teams through conversation with BoB.
- **Specialist catalog** — Keyword-matched agent specializations (e.g., "React Native" → Mobile UI Developer). BoB swaps generic roles for task-specific experts.
- **Timeline** — Merged stream of chat messages and activity events, sorted by timestamp. Verbosity-filtered (minimal/normal/detailed/debug).

## Capabilities

- Team creation and calibration through natural language conversation
- Parallel agent execution with git worktree isolation for coding agents
- Structured event system with aggregation (batches consecutive same-tool invocations)
- Persistent workspace memory — calibrations, team configs, milestone history
- Domain-agnostic — same event types and lifecycle work for coding, research, writing, and analysis agents
- Session restore — SQLite events survive app restarts; calibrations are git-committable

## Tech stack

- **Frontend**: Vue 3 + Naive UI + Tailwind CSS
- **Desktop**: Tauri
- **Agent runtime**: Cline SDK (Node.js)
- **Storage**: SQLite (event history, metrics) + JSON (calibrations, templates, config)
- **Isolation**: Git worktrees per coding agent
