# bob-ai — Architecture

## System Overview

bob-ai is a three-layer architecture: a Vue frontend in a Tauri desktop shell, a thin Rust orchestration layer, and a Node.js SDK server that does all agent work.

```
┌──────────────────────────────────────────────┐
│  Vue 3 Frontend (Tauri WebView)              │
│  ├── Team Configuration                      │
│  ├── Visual Workflow Builder                 │
│  ├── Chat Interface                          │
│  ├── Activity Monitor                        │
│  └── Knowledge / Decision Log Viewer         │
└──────────────────┬───────────────────────────┘
                   │ Tauri Commands (IPC)
┌──────────────────▼───────────────────────────┐
│  Tauri Rust Backend (Thin Orchestrator)       │
│  ├── Spawns Node.js SDK server on startup    │
│  ├── SQLite for team configs & UI state      │
│  ├── File system integration (pickers, watchers)│
│  ├── Proxies agent requests to Node server   │
│  └── Process lifecycle management            │
└──────────────────┬───────────────────────────┘
                   │ HTTP + WebSocket (localhost)
┌──────────────────▼───────────────────────────┐
│  Node.js SDK Server (Background Process)     │
│  ├── @clinebot/agents — Runtime loop, tools  │
│  ├── @clinebot/core — Sessions, storage      │
│  ├── @clinebot/llms — Provider handlers      │
│  ├── AgentTeamsRuntime — Team coordination   │
│  ├── Workflow engine — Hook execution        │
│  └── WebSocket for streaming events          │
└──────────────────────────────────────────────┘
```

## Why Three Layers?

### Tauri (Rust) — Desktop Shell
- Native file pickers and directory dialogs
- System tray integration and notifications
- Small bundle size (~5MB)
- Process lifecycle management (spawn/kill Node server)
- SQLite for lightweight UI state (team configs, recent projects)

### Node.js SDK Server — Agent Brain
- Direct TypeScript imports of `@clinebot/*` packages
- No language impedance mismatch — SDK is TypeScript, server is TypeScript
- HTTP REST API for team/task management
- WebSocket for real-time streaming (agent events, chat messages)
- SQLite via `@clinebot/core` for session persistence

### Vue Frontend — User Interface
- Reactive UI with Vue 3 Composition API
- Naive UI for desktop-native components
- Tailwind CSS for layout and custom styling
- Communicates with Rust backend via Tauri commands

## Data Flow: Assigning a Task

```
1. User types "Add a login page" in Chat Interface (Vue)
2. Vue calls Tauri command: invoke('send_message', { teamId, message })
3. Tauri Rust proxies to Node SDK server: POST http://localhost:{port}/teams/{id}/chat
4. Node SDK server:
   a. Loads team config (agents, roles, models, API keys)
   b. Loads knowledge base from .clinerules/bob-ai/knowledge/
   c. Injects team briefing + knowledge into system prompt
   d. Creates AgentTeamsRuntime with configured agents
   e. Starts team lead agent with user message
   f. Team lead delegates to specialists via spawn_agent tool
   g. Streams events over WebSocket
5. Tauri relays WebSocket events to Vue via Tauri events
6. Vue renders real-time updates in Activity Monitor
```

## Data Flow: Pause/Resume

```
Pause:
1. User clicks ⏸ Pause in Vue
2. Tauri → POST /teams/{id}/pause
3. Node SDK server:
   a. Aborts active agent runs (AbortController)
   b. Persists current state (messages, team state, active runs)
   c. Marks team status as "paused"
4. Vue updates UI to show paused state

Resume:
1. User clicks ▶ Resume in Vue
2. Tauri → POST /teams/{id}/resume
3. Node SDK server:
   a. Loads persisted state
   b. Restores agent conversation (agent.restore(messages))
   c. Creates new AbortController
   d. Continues with agent.continue("Resume your work")
4. Vue updates UI to show running state
```

## Data Flow: Visual Workflow Hook Execution

```
1. User drags "Before Code Write" hook in Workflow Builder
2. Connects it to "Code Reviewer" agent with a prompt
3. Saves workflow → stored in team config (SQLite)

At runtime:
1. Working agent is about to write code
2. SDK intercepts via registered hook (before_file_write)
3. Hook spawns the assigned "Code Reviewer" agent with:
   - The configured prompt
   - The code about to be written
   - Knowledge base context (if selected)
4. Reviewer agent analyzes and returns pass/fail
5. If fail → block the write, send feedback to working agent
6. If pass → allow the write to proceed
```

## Communication Protocols

### Tauri ↔ Vue (IPC)

```rust
// Tauri command definition
#[tauri::command]
async fn send_message(team_id: String, message: String) -> Result<String, String> {
    let response = reqwest::post(
        format!("http://localhost:{}/teams/{}/chat", SDK_PORT, team_id)
    )
    .json(&json!({ "message": message }))
    .send()
    .await
    .map_err(|e| e.to_string())?;

    Ok(response.text().await.map_err(|e| e.to_string())?)
}
```

```typescript
// Vue calling Tauri
import { invoke } from '@tauri-apps/api/core'

const response = await invoke('send_message', {
  teamId: 'swe-team-1',
  message: 'Add a login page'
})
```

### Tauri ↔ Node.js SDK Server (HTTP + WebSocket)

**REST endpoints** for commands:
- `POST /teams` — Create team
- `GET /teams` — List teams
- `GET /teams/:id` — Get team details
- `POST /teams/:id/chat` — Send message to team
- `POST /teams/:id/pause` — Pause team
- `POST /teams/:id/resume` — Resume team
- `POST /teams/:id/stop` — Stop team
- `PUT /teams/:id/workflow` — Update team workflow

**WebSocket** for streaming:
- `ws://localhost:{port}/teams/:id/events` — Real-time agent events
- Events: `agent_start`, `agent_thinking`, `tool_call`, `agent_response`, `task_complete`, `error`

## Storage Architecture

### Tauri SQLite (UI State)

```sql
-- Team configurations
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workspace TEXT NOT NULL,
    status TEXT DEFAULT 'created',  -- created, running, paused, stopped, completed
    config_json TEXT NOT NULL,       -- Full team config (agents, models, keys)
    workflow_json TEXT,              -- Visual workflow definition
    created_at INTEGER,
    updated_at INTEGER
);

-- Recent projects
CREATE TABLE recent_projects (
    workspace TEXT PRIMARY KEY,
    last_opened INTEGER,
    team_id TEXT
);
```

### Node.js SQLite (SDK State via @clinebot/core)

- `~/.cline/data/sessions/sessions.db` — Session metadata
- `~/.cline/data/teams/teams.db` — Team events and state projections
- Artifact store — Append-only logs, messages, tool results

### Workspace State (Per-Project)

```
.clinerules/bob-ai/         — Knowledge, rules, hooks (version controlled)
.bob-ai/                    — Runtime state (gitignored)
  ├── decision-log/         — Decision documents
  ├── work/{task-id}/       — Task artifacts
  └── state.json            — Last known team state
```

## Project Structure

```
bob-ai/
├── src/                        # Vue 3 frontend
│   ├── App.vue
│   ├── main.ts
│   ├── views/
│   │   ├── TeamList.vue        # Home — list of teams
│   │   ├── TeamConfig.vue      # Create/edit team
│   │   ├── WorkflowBuilder.vue # Visual workflow editor
│   │   ├── ChatInterface.vue   # Chat with team
│   │   └── ActivityMonitor.vue # Agent activity feed
│   ├── components/
│   │   ├── agents/             # Agent config cards
│   │   ├── workflow/           # Drag-drop hook nodes
│   │   ├── chat/               # Message bubbles, input
│   │   └── common/             # Shared UI components
│   ├── stores/                 # Pinia stores
│   │   ├── teams.ts
│   │   ├── tasks.ts
│   │   └── workflow.ts
│   ├── composables/            # Vue composables
│   │   ├── useTauriCommand.ts
│   │   └── useWebSocket.ts
│   └── types/
│       └── index.ts
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── team.rs         # Team CRUD commands
│   │   │   ├── chat.rs         # Chat proxy commands
│   │   │   └── workflow.rs     # Workflow save/load
│   │   ├── sdk_server.rs       # Node.js process manager
│   │   ├── db.rs               # SQLite team store
│   │   └── events.rs           # WebSocket relay
│   ├── Cargo.toml
│   └── tauri.conf.json
├── sdk-server/                 # Node.js backend
│   ├── src/
│   │   ├── index.ts            # Express server entrypoint
│   │   ├── routes/
│   │   │   ├── teams.ts        # Team management routes
│   │   │   └── chat.ts         # Chat/streaming routes
│   │   ├── runtime/
│   │   │   ├── team-builder.ts # Build team runtimes
│   │   │   ├── workflow-engine.ts # Execute hook workflows
│   │   │   └── knowledge.ts    # Knowledge base loader
│   │   └── tools/
│   │       ├── decision-log.ts # Decision logging tool
│   │       ├── knowledge.ts    # Knowledge query tool
│   │       └── git-commit.ts   # Git standards tool
│   ├── package.json
│   └── tsconfig.json
├── docs/                       # This documentation
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Security Considerations

- Node SDK server binds to `localhost` only — no network exposure
- API keys stored in team config SQLite (encrypted at rest via Tauri secure store)
- Agent-generated hooks run in the same Node.js process — sandboxing is a future consideration
- File system access scoped to configured workspace
