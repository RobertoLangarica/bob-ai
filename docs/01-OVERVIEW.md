# bob-ai — Overview

## What Is bob-ai?

bob-ai is a **desktop application for orchestrating specialized AI agent teams**. It provides a visual interface where you configure teams of agents, assign them tasks, wire up automation hooks, and monitor their work — all powered by the Cline SDK (`@clinebot/*`).

Think of it as a **mission control for AI teams** — you create a team, point it at a repo or project, calibrate each agent's role and model, and let them work while you watch.

## Why Does It Exist?

Today, working with AI agents means:
- One agent at a time, one chat at a time
- No coordination between specialized agents
- No persistent standards or knowledge across sessions
- No visual way to wire automation or review workflows
- No lifecycle control (pause, resume, stop)

bob-ai solves this by providing:
- **Teams of specialized agents** that coordinate work
- **Visual workflow builder** — drag-drop hooks and automation, no code required
- **Knowledge system** — agents understand your project's standards and patterns
- **Lifecycle control** — pause, resume, stop any team at any moment
- **Decision logging** — trackable audit trail of what agents decided and why

## Who Is It For?

**Primary**: Developers who want AI teams working on their codebases (SWE teams with UX, UI, Backend, Reviewer agents).

**Secondary**: Non-technical users who want AI teams for research, content, or analysis — configuring agent workflows visually without writing code.

## First Use Case: SWE Team

The first team template is a **Software Engineering team**:

| Agent | Role | Default Model |
|---|---|---|
| Team Lead | Coordinates work, delegates tasks | Claude Sonnet |
| UX Researcher | Analyzes requirements, user flows | Claude Sonnet |
| UI Developer | Frontend components, styling | Claude Sonnet |
| Backend Developer | API endpoints, database logic | Claude Sonnet |
| Code Reviewer | Reviews code, enforces standards | GPT-4 |

Each agent is configurable: model, API key, system prompt, and tools.

## Key Concepts

### Teams
A named group of specialized agents configured for a workspace. You can have multiple team instances — one reviewing PRs on repo A, another building features on repo B.

### Workflows
Visual pipelines of hooks and automation steps. Drag a "Before Code Write" hook, connect it to a "Code Reviewer" agent, configure a prompt — now every code write gets reviewed automatically.

### Knowledge Base
Markdown documents in `.clinerules/bob-ai/knowledge/` that agents can reference. Pre-digested context about your project's architecture, patterns, and conventions.

### Decision Log
A persistent record of significant technical decisions made by agents. Stored in `.bob-ai/decision-log/` with context, options considered, and rationale.

## Tech Stack

- **Frontend**: Vue 3 + Naive UI + Tailwind CSS
- **Desktop**: Tauri (native wrapper)
- **Agent Runtime**: Node.js sidecar using `@clinebot/agents`, `@clinebot/core`, `@clinebot/llms`
- **Storage**: SQLite (team configs, sessions, state)
- **Communication**: Tauri commands → HTTP → Node.js SDK server

## Repository Dependencies

- `@clinebot/shared` — Common types and helpers
- `@clinebot/llms` — Provider schemas, model catalog (20+ providers)
- `@clinebot/agents` — Agent runtime loop, tools, hooks, team orchestration
- `@clinebot/core` — Stateful orchestration, sessions, storage
- `@clinebot/rpc` — gRPC transport for session management (optional)
