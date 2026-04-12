# bob-ai — Open Questions

Decisions that need your input before or during implementation. Add inline comments directly to this file.

---

## Architecture

### Q1: Tauri vs Electron for Desktop Shell

**Context**: Tauri uses Rust (thin orchestrator), Electron uses Node.js (direct SDK access). We chose Tauri for small bundle and native feel, but the SDK is TypeScript — requiring an HTTP bridge between Rust and Node.js.

**Current decision**: Tauri with Node.js sidecar

**Trade-off**: Slightly more complex architecture in exchange for smaller bundle and native feel.

**Your take?**:
<!-- Add your comment here -->

---

### Q2: Node.js SDK Server — Embedded or Separate Process?

**Option A**: Tauri spawns a separate Node.js process on startup (current plan)
- Pro: Clean separation, easy to debug independently
- Con: Two processes to manage

**Option B**: Use Tauri's sidecar feature to bundle the Node binary
- Pro: Single install, managed lifecycle
- Con: Larger bundle

**Your take?**:
<!-- Add your comment here -->

---

## Knowledge System

### Q3: Knowledge Doc Format

**Options**:
- A) Markdown only (simple, human-readable)
- B) Markdown + JSON (structured data when needed)
- C) Markdown + YAML frontmatter (metadata + content)

**Current lean**: A — Markdown only for simplicity

**Your take?**:
<!-- Add your comment here -->

---

### Q4: Auto-Briefing vs Manual Review

Should the team briefing be injected automatically on every launch, or should users review/confirm it first?

**Options**:
- A) Always auto-inject (faster, less friction)
- B) Show briefing review screen before launch (more control)
- C) Auto-inject by default, with option to review

**Current lean**: C

**Your take?**:
<!-- Add your comment here -->

---

## Hooks & Workflows

### Q5: Hook Approval Flow

When an agent creates a hook, should the user approve it?

**Options**:
- A) Always require approval (safest)
- B) Auto-activate, but show notification (balanced)
- C) Auto-activate silently (fastest iteration)

**Current lean**: B — Auto-activate with notification and ability to disable

**Your take?**:
<!-- Add your comment here -->

---

### Q6: Hook Scope

Should hooks be team-specific or workspace-wide?

**Options**:
- A) Team-specific (each team has its own hooks)
- B) Workspace-wide (all teams in a workspace share hooks)
- C) Both — workspace-wide defaults + team overrides

**Current lean**: C

**Your take?**:
<!-- Add your comment here -->

---

### Q7: Agent-Generated Code Safety

Agent-generated hooks contain prompts (not executable code). But should we allow agents to generate actual executable hooks (TypeScript)?

**Options**:
- A) Prompt-only hooks (agent writes natural language, another agent interprets at runtime) — safe
- B) Code hooks (agent writes TypeScript that runs directly) — powerful but risky
- C) Start with A, graduate to B with sandboxing later

**Current lean**: A for Phase 1, C as roadmap

**Your take?**:
<!-- Add your comment here -->

---

## UX

### Q8: Pause Granularity

Should you be able to pause individual agents, or only the whole team?

**Options**:
- A) Whole team only (simpler)
- B) Individual agents + whole team (more control)

**Current lean**: A for Phase 1, B as enhancement

**Your take?**:
<!-- Add your comment here -->

---

### Q9: Chat vs Structured Task Input

Primary way to assign tasks:

**Options**:
- A) Chat only (natural language, team lead interprets)
- B) Structured form only (explicit agent assignment)
- C) Chat primary, structured form as alternative

**Current lean**: C

**Your take?**:
<!-- Add your comment here -->

---

### Q10: Activity Feed vs Task Board

How to display team progress:

**Options**:
- A) Real-time activity feed (timeline of events)
- B) Kanban-style task board (cards with status columns)
- C) Feed primary, board as alternative view

**Current lean**: A for simplicity, C as enhancement

**Your take?**:
<!-- Add your comment here -->

---

## Teams & Models

### Q11: API Key Strategy

How to manage API keys across teams and agents:

**Options**:
- A) Global API keys (one set shared by all teams/agents)
- B) Per-team keys (each team has its own)
- C) Per-agent keys (maximum flexibility)
- D) Global defaults with per-team/per-agent overrides

**Current lean**: D

**Your take?**:
<!-- Add your comment here -->

---

### Q12: Default Models Per Agent Role

Should agent roles have default model recommendations?

**Example**:
- Team Lead → Claude Sonnet (good at coordination)
- Code Reviewer → GPT-4 (good at analysis)
- UI Developer → Claude Sonnet (good at code generation)

**Options**:
- A) Yes, pre-configured defaults (user can override)
- B) No defaults, user always chooses
- C) Template-specific defaults (SWE template has different defaults than Research)

**Current lean**: C

**Your take?**:
<!-- Add your comment here -->

---

### Q13: Multiple Team Instances on Same Repo

Should multiple teams be able to work on the same repo simultaneously?

**Example**: One SWE team building features, another reviewing open PRs.

**Options**:
- A) Yes, with branch isolation (each team on its own branch)
- B) Yes, no isolation (user manages conflicts)
- C) No, one team per workspace at a time

**Current lean**: B for Phase 1 (simplest), A as enhancement

**Your take?**:
<!-- Add your comment here -->

---

## Persistence

### Q14: Conversation History Depth

How much conversation history to store?

**Options**:
- A) Everything (full message history, tool calls, artifacts)
- B) Summary only (task description + results + decisions)
- C) Configurable retention (e.g., keep last 30 days)

**Current lean**: A — storage is cheap, audit trail is valuable

**Your take?**:
<!-- Add your comment here -->

---

### Q15: Knowledge Doc Versioning

Should we track changes to knowledge docs over time?

**Options**:
- A) No versioning (rely on git)
- B) Track in bob-ai (diff viewer in app)
- C) Just track "last accessed by agent" metadata

**Current lean**: A — git handles versioning naturally

**Your take?**:
<!-- Add your comment here -->
