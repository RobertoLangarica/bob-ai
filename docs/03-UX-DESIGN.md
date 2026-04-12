# bob-ai — UX Design

## Core Concept: Chat-First, Minimal

The entire interface is **chat**. You talk to bob or to a team. Teams are persisted templates in the sidebar. Agents are an implementation detail — they show up when working, but you don't manage them directly. Configuration happens through conversation.

### Two Chat Modes

| Mode | What You See | Purpose |
|---|---|---|
| **bob** | Chat with the app assistant | Create teams, get help |
| **Team** | Chat with a team | Assign work, see results |

---

## Screen Layout

```
┌──────────────────────────────────────────────────────┐
│ bob-ai                                          [⚙️] │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ 🤖 bob   │         🤖 bob                            │
│ ────     │                                           │
│ 🛠️ SWE   │  Hey! I'm bob. I can set up AI teams     │
│ 🔬 Rsrch │  for your projects. What are you          │
│          │  working on?                              │
│ + New    │                                           │
│          │                                           │
│          │                                           │
│          ├───────────────────────────────────────────┤
│          │ [What are you working on?]         [Send] │
└──────────┴───────────────────────────────────────────┘
```

**Sidebar**: bob + teams + "New Team". That's it.

**Main area**: Always chat. No dashboards, no grids, no tabs.

---

## Mental Model

- **Team** = a persisted configuration you chat with. Has agents behind the scenes.
- **Agents** = hidden specialists. You see their activity in the chat stream when working, but you don't configure them directly (unless you dig into advanced settings).
- **Bob** = the app assistant. Helps you create and configure teams through conversation.
- **Work history** = the chat thread itself. Select a team → see the conversation with summaries of past work.

---

## Core Flows

### Flow 1: First Launch → Create a Team

```
bob: Hey! I'm bob. I can set up AI teams for
     your projects. What are you working on?

You: I'm building a React app

bob: I can set up a team for that. How does
     this look?

     ┌─ SWE Team ──────────────────────┐
     │ 👤 Team Lead — Claude Sonnet     │
     │ 🎨 UI Developer — Claude Sonnet  │
     │ ⚙️  Backend Dev — Claude Sonnet   │
     │                                  │
     │ [Customize]  [Create Team]       │
     └──────────────────────────────────┘

You: Create it

bob: ✅ SWE Team created. Select it from the
     sidebar to start giving it work.
```

Team appears in sidebar. Done.

### Flow 2: Give a Team Work

Click team in sidebar → see its chat history → type a message.

```
You: Add a login page with email/password auth

Team Lead: I'll coordinate this. Starting UI and
           Backend work in parallel.

┌─ ACTIVITY ────────────────────────────────┐
│ ● 🎨 UI Developer                        │
│   Created login form component            │
│   ✅ src/components/LoginForm.vue         │
│                                           │
│ ● ⚙️  Backend Dev                         │
│   Auth API endpoint and middleware        │
│   ✅ src/api/auth.ts                      │
│   ✅ src/middleware/auth.ts               │
│                                           │
└───────────────────────────────────────────┘

Team Lead: ✅ Login page complete.
           • LoginForm.vue with validation
           • POST /api/auth endpoints
           • JWT middleware
           • 8 tests passing
```

**Key**: Work summaries appear as chat messages. Activity cards show which agents did what, with file paths. The Team Lead gives you a summary when done.

### Flow 3: Configure Through Chat

Instead of settings UI for agents, configure via conversation:

```
You: Use GPT-4 for code review instead of Sonnet

Team Lead: Updated. The code reviewer will use
           GPT-4 going forward.

You: Add a UX researcher to this team

Team Lead: Added a UX Researcher agent (Claude
           Sonnet). They'll analyze requirements
           before implementation.
```

### Flow 4: Refine Via Chat

```
You: Actually, use Tailwind for all the styling

Team Lead: Got it — I'll relay that to UI
           Developer. Updating the approach.
```

You can redirect work mid-task, just like talking to a real team.

---

## What Agents Look Like

Agents are **not** shown as cards or grids by default. They surface in two places:

1. **Activity cards in chat** — when the team is working, you see which agent did what. This is informational, not interactive.

2. **Advanced settings** — buried in Settings (⚙️). A list of agents with model/key config. Power users only.

```
⚙️ Settings → SWE Team → Advanced → Agents

┌─ Team Lead ──────────────────────────────┐
│ Model: Claude Sonnet   API Key: default  │
└──────────────────────────────────────────┘
┌─ UI Developer ───────────────────────────┐
│ Model: Claude Sonnet   API Key: default  │
└──────────────────────────────────────────┘
...
```

---

## Sidebar Behavior

- **bob** is always at the top
- Teams listed below, with optional status dot (green = working, yellow = paused)
- **+ New Team** at the bottom, navigates to bob chat
- No task list, no sections, no categories
- Selecting a team shows its chat history

---

## Design Principles

1. **Everything is chat** — no dashboards, no forms, no wizards
2. **Agents are hidden** — the user talks to a team, not to individual agents
3. **Configuration through conversation** — not through settings panels
4. **Show work, not structure** — summaries and file paths, not agent grids
5. **Minimal chrome** — sidebar + chat. That's the whole app.
6. **Dark mode** — developer tool aesthetic
