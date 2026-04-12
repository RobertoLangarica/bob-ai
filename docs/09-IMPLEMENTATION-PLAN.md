# bob-ai — Implementation Plan

## Phase 1: Foundation — Working Team with Chat and Control

**Goal**: Create a team, chat with it, see agents work, pause/resume/stop.

### Step 1.1: Project Scaffold

```bash
# Initialize Tauri + Vue project
npm create tauri-app@latest bob-ai -- --template vue-ts
cd bob-ai
npm install naive-ui pinia vue-router @vueuse/core
npm install -D tailwindcss @tailwindcss/vite
```

**Deliverables**:
- Tauri + Vue 3 + TypeScript project structure
- Naive UI + Tailwind configured
- Dark theme applied
- Basic router with placeholder views

### Step 1.2: Node.js SDK Server

Create `sdk-server/` with Express + @clinebot packages.

```bash
mkdir sdk-server
cd sdk-server
npm init -y
npm install express @clinebot/agents @clinebot/core @clinebot/llms ws
npm install -D typescript @types/express @types/ws tsx
```

**Deliverables**:
- Express server with health check endpoint
- WebSocket server for event streaming
- Team management routes (CRUD)
- Chat route (POST /teams/:id/chat)

### Step 1.3: Tauri ↔ Node.js Bridge

**Deliverables**:
- Rust command to spawn Node.js server on app startup
- Rust commands that proxy HTTP to SDK server
- WebSocket relay from SDK server to Vue via Tauri events
- Process cleanup on app close

### Step 1.4: Team Creation UI

**Deliverables**:
- TeamList view (home screen with team cards)
- TeamConfig view (wizard for creating new team)
- Agent configuration cards (name, role, model, API key)
- SWE team template pre-fill
- Save team config to SQLite via Tauri

### Step 1.5: Chat Interface

**Deliverables**:
- ChatInterface view with message list and input
- Send messages to team via Tauri → SDK server
- Display agent responses
- Basic message bubbles (user vs agent)

### Step 1.6: Activity Monitor

**Deliverables**:
- ActivityMonitor view with real-time feed
- WebSocket event listener for agent activities
- Agent status badges (running, waiting, completed)
- Timeline display using NTimeline

### Step 1.7: Lifecycle Control

**Deliverables**:
- Pause button → saves state, aborts runs
- Resume button → restores state, continues
- Stop button → abort with confirmation, final state
- Status indicators in team header and sidebar

---

## Phase 2: Knowledge, Workflows, and Governance

**Goal**: Agents understand your project and follow your rules.

### Step 2.1: Knowledge System

**Deliverables**:
- .clinerules/bob-ai/ directory scanner
- team-briefing.md injection into system prompts
- read_knowledge tool for on-demand access
- Knowledge viewer UI (browse docs, open in editor)

### Step 2.2: Decision Logging

**Deliverables**:
- log_decision tool with structured output
- .bob-ai/decision-log/ directory management
- Decision log viewer in UI
- Link decisions to tasks

### Step 2.3: Visual Workflow Builder

**Deliverables**:
- Vue Flow canvas integration
- Hook library sidebar (draggable nodes)
- Hook configuration panel (agent, prompt, behavior)
- Save/load workflow to team config
- Hook execution engine in SDK server

### Step 2.4: Git Standards

**Deliverables**:
- commit_changes tool with conventional format
- Git standards from .clinerules/bob-ai/git-standards.md
- Commit tagging with bob-ai:{task-id}

---

## Phase 3: Persistence, Customization, Streaming

**Goal**: Production-quality daily driver.

### Step 3.1: Persistence

**Deliverables**:
- Teams persist across app restarts
- Task history with browsable results
- Session state recovery after crashes

### Step 3.2: Agent Customization

**Deliverables**:
- Edit system prompts per agent in UI
- Workspace switching (file picker)
- Team duplication

### Step 3.3: Streaming

**Deliverables**:
- Real-time token streaming in chat
- Agent thinking indicators
- Tool call visualization in activity feed

### Step 3.4: Agent-Generated Hooks

**Deliverables**:
- create_hook tool available to agents
- User approval flow for new hooks
- Hooks appear in workflow builder automatically

---

## Phase 4: Polish and Advanced Features

**Goal**: Delightful experience with advanced capabilities.

### Step 4.1: Advanced UI
- File diff preview
- Command palette (Cmd+K)
- System tray integration
- Desktop notifications

### Step 4.2: Advanced Workflows
- Conditional nodes (if/else)
- Workflow templates library
- Cross-team hook suggestions

### Step 4.3: Scale
- Multi-team parallel execution
- Export conversations
- Performance optimization

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Tauri Rust complexity | Keep Rust layer thin — just process management and proxying |
| SDK version drift | Pin @clinebot/* versions, test on upgrade |
| WebSocket reliability | Reconnect logic, event replay from SDK server |
| SQLite conflicts | Single writer per database file |
| Agent quality | Knowledge base + briefing + hooks reduce hallucination |
