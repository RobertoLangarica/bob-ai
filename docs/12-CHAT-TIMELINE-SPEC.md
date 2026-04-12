# Chat Timeline Spec

Everything that appears in the chat view — item types, visual treatments, verbosity rules, and the "speaking to BoB" contract.

---

## Philosophy

The chat is a **timeline of work**, not a Slack channel. The user talks to BoB, BoB orchestrates agents, and the timeline shows what happened. Think of it as a commit log with personality — scannable, collapsible, with big moments standing out.

**Core rules:**

1. The user always talks to **BoB** — even in a team chat, BoB is the intermediary
2. Agent work is shown as **timeline events**, not chat messages
3. Inter-agent communication is **hidden by default** (delegation cards, not chat bubbles)
4. Milestones get **visual prominence** — they break the rhythm and feel like achievements
5. Everything collapses — the timeline must stay scannable even after hours of work

---

## "Speaking to BoB" Contract

The user must always feel they're talking to BoB, regardless of which team is active.

### Visual Cues

| Element                   | Treatment                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Input area label**      | Tiny `👻 BoB` ghost icon + name above the input, always visible. In team view: `👻 BoB · SWE Team` to show BoB is the bridge      |
| **Input placeholder**     | BoB view: `"Ask BoB anything..."` · Team view: `"Tell BoB what you need..."`                                                      |
| **Input border on focus** | Subtle cyan glow (`box-shadow: 0 0 0 1px ${cyan}30`) — BoB's color                                                                |
| **Send button**           | Stays purple (primary action), but the input context is clearly BoB                                                               |
| **Bot responses**         | BoB always responds first in team chats, then delegates. The first message after a user prompt is always from BoB (even if brief) |

### Why This Matters

Agents are implementation details. The user shouldn't have to think about which agent to talk to — BoB handles routing. This is the "chat-first" philosophy in action: one conversation partner (BoB), many workers behind the scenes.

---

## Timeline Item Types

### Current Types (keeping these)

| Type       | Purpose                      | Visual                                        |
| ---------- | ---------------------------- | --------------------------------------------- |
| `text`     | Simple user/BoB messages     | Chat bubble, purple tint for user             |
| `verbose`  | Agent message with thinking  | Collapsible thinking section + text card      |
| `card`     | Rich content (team proposal) | Card with structured content + action buttons |
| `activity` | Status summary of agent work | Card with per-agent status dots + file chips  |

### New Types

#### 1. `tool-use` — Agent Invoking a Tool

When an agent calls a tool (read file, write file, run command, etc.).

**Visual:** Compact inline chip — one line, agent-colored left border, tool icon + description.

```
⚡ UI Developer › read_file  src/components/LoginForm.vue
⚡ Backend Dev  › terminal    npm test -- --filter=auth
⚡ UI Developer › write_file  src/components/LoginForm.vue  (+42 −3)
```

**Design details:**

- Height: ~24px, no card wrapper — just a tinted row
- Left border: 2px solid in agent color
- Icon: Lightning (⚡) for all tool use — fast, electric
- Agent name in their color, tool name in mono `#707078`, path/args in `#505058`
- If the tool produced output: small `▸` chevron to expand result
- Collapsed by default — one-liner only

**Expandable content (click to show):**

- File read: first 5 lines of content in monospace
- Terminal: command output (truncated, scrollable)
- Write: mini diff (green/red lines)

#### 2. `code-change` — File Modification Result

Summarizes code changes after an agent finishes writing.

**Visual:** Compact card with file chips and diff stats.

```
┌──────────────────────────────────────┐
│  📝 Code Changes                     │
│                                      │
│  🍃 src/components/LoginForm.vue     │
│     +68 −12  ·  new file             │
│  🍃 src/composables/useAuth.ts       │
│     +24 −3   ·  modified             │
│                                      │
│  2 files changed, +92 −15            │
└──────────────────────────────────────┘
```

**Design details:**

- Card with `#161619` bg, agent-colored top border (2px)
- "Code Changes" header with pencil/diff icon
- Each file: leaf icon (🍃, our file icon) + path in agent color + diff stats in green/pink
- Summary line at bottom: total files, total additions/deletions
- Clickable files could expand to show inline diff (future feature)

#### 3. `web-search` — Web Search Query + Results

When an agent searches the web.

**Visual:** Compact card with search query and result links.

```
┌──────────────────────────────────────┐
│  🔭 Web Search                       │
│  "vue 3 form validation best prac…"  │
│                                      │
│  → VeeValidate docs — vee-validate…  │
│  → Zod + Vue 3 — dev.to/article…     │
│  → Form validation patterns — vue…   │
│                                      │
│  3 results · Research                │
└──────────────────────────────────────┘
```

**Design details:**

- Card with subtle green tint (Research agent color) or agent-colored border
- Binoculars icon (🔭) — scouting the web
- Query string in italic monospace, slightly dimmed
- Results: arrow prefix + title + truncated URL in `#505058`
- Max 3-4 results shown, rest collapsed
- Agent attribution at bottom right

#### 4. `web-scrape` — URL Fetch + Content Summary

When an agent fetches and reads a web page.

**Visual:** Compact card with URL and extracted summary.

```
┌──────────────────────────────────────┐
│  🕷️ Web Fetch                        │
│  vee-validate.logaretm.com/v4/guide  │
│                                      │
│  "VeeValidate provides composition   │
│   API hooks for form validation…"    │
│                                      │
│  ~2,400 words · Research             │
└──────────────────────────────────────┘
```

**Design details:**

- Spider icon (🕷️) — crawling the web (personality!)
- URL displayed as a muted link-style text
- Content summary: 2-3 line excerpt in regular text
- Word count / content size at bottom
- Expandable to show full extracted text (scrollable, max-height)

#### 5. `milestone` — Major Goal Achieved

When the team completes a significant objective.

**Visual:** Full-width banner that breaks the timeline rhythm. This is the **celebration moment**.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👑  Login page complete

   4 files · 8 tests passing · 2 agents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Design details:**

- **No avatar** — centered, full-width, breaks the left-aligned flow
- Crown icon (👑) in neon green — achievement royalty
- Title text: larger (14px instead of 13px), white (`#e0e0e4`), bold
- Stats line below: muted gray, summarizing the work done
- Background: subtle horizontal gradient, green tint fading to transparent
  - `background: linear-gradient(90deg, transparent, ${green}08, transparent)`
- Top and bottom: thin green line (1px solid `${green}20`)
- Padding: more generous than regular items (16px vertical)
- **No collapse** — milestones are always visible, they anchor the timeline

**When to show milestones:**

- Feature completion (team lead reports "done")
- All tests passing after a code change
- Deployment successful
- Major task in a multi-step plan completed
- User explicitly marks something as a milestone

#### 6. `delegation` — Agent-to-Agent Handoff

When the Team Lead assigns work to a specialist. This replaces showing full agent-to-agent chat messages.

**Visual:** Thin inline entry, similar to `tool-use` but for coordination.

```
🐕 Team Lead → 🦋 UI Developer: Build login form with validation
🐕 Team Lead → 🐛 Backend Dev: Set up auth API endpoints
```

**Design details:**

- Single line, compact (same as tool-use height ~24px)
- Lead icon + name in orange → agent icon + name in their color
- Colon + task description in `#808088`
- Arrow (`→`) in `#404048`
- No expand, no collapse — just a visible breadcrumb of coordination
- Groups consecutive delegations into a single block with no extra spacing

---

## Agent-to-Agent Communication

### Decision: Hide by Default

The user expressed concern that "showing messages between the agents can be too much." The solution:

**Agent chatter is NOT shown as chat messages.** Instead:

1. **Delegation** events show the Team Lead assigning tasks (see above)
2. **Verbose/thinking** sections capture agent reasoning (already exists)
3. **Tool-use** events show agents working (new)
4. **Activity** cards summarize progress snapshots

If a user wants to see the full agent conversation, the **Activity view** (Orbital + Tasks) provides that deeper visibility. The chat timeline stays clean.

### What This Means in Practice

A typical task flow in the timeline:

```
┌─ User message ─────────────────────────┐
│ "Add a login page with email/password" │
└────────────────────────────────────────┘

👻 BoB: "On it. Breaking this into frontend and backend work."

🐕 Team Lead → 🦋 UI Developer: Build login form with validation
🐕 Team Lead → 🐛 Backend Dev: Set up auth API + JWT

⚡ UI Developer › read_file  src/components/  (3 files)
⚡ Backend Dev  › read_file  src/api/         (2 files)

⚡ UI Developer › write_file  src/components/LoginForm.vue  (+68)
⚡ Backend Dev  › terminal    npm install bcrypt jsonwebtoken

⚡ Backend Dev  › write_file  src/api/auth.ts  (+45)
⚡ Backend Dev  › write_file  src/middleware/auth.ts  (+32)
⚡ Backend Dev  › terminal    npm test -- --filter=auth  ✓ 5 passed

┌─ Code Changes ──────────────────────────┐
│  LoginForm.vue      +68   new           │
│  useAuth.ts         +24   modified      │
│  auth.ts            +45   new           │
│  auth.ts (mw)       +32   new           │
│  4 files, +169 −3                       │
└─────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👑  Login page complete
   4 files · 8 tests passing · 2 agents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This is a scannable timeline. The user can see the flow without being drowned in agent chatter.

---

## Verbosity Levels (Future Enhancement)

The timeline could support a verbosity slider:

| Level                | What's Shown                                        |
| -------------------- | --------------------------------------------------- |
| **Minimal**          | User messages + BoB responses + milestones only     |
| **Normal** (default) | Above + delegations + code changes + activity cards |
| **Detailed**         | Above + tool-use events + web search/scrape         |
| **Full**             | Everything including expanded thinking sections     |

This could live as a small toggle in the nav bar or as a filter button. Not implementing now, but designing the types to support it.

---

## Timeline Item Summary

| Type          | Icon             | Height          | Collapsible   | Frequency               |
| ------------- | ---------------- | --------------- | ------------- | ----------------------- |
| `text`        | User/BoB avatar  | Variable        | No            | Every interaction       |
| `verbose`     | Agent avatar     | Variable        | Thinking: yes | Per-agent response      |
| `card`        | Content-specific | Variable        | No            | Team proposals, configs |
| `activity`    | Heartbeat        | Medium          | No            | Progress snapshots      |
| `tool-use`    | Lightning ⚡     | Compact (~24px) | Output: yes   | Frequent during work    |
| `code-change` | Pencil/Diff      | Medium card     | Files: yes    | After write batches     |
| `web-search`  | Binoculars 🔭    | Medium card     | Results: yes  | During research         |
| `web-scrape`  | Spider 🕷️        | Medium card     | Content: yes  | During research         |
| `milestone`   | Crown 👑         | Large banner    | Never         | Major completions       |
| `delegation`  | Agent icons      | Compact (~24px) | No            | Team Lead assigns work  |

---

## New Icons Needed

| Icon             | Phosphor       | Export Name     | Metaphor                 |
| ---------------- | -------------- | --------------- | ------------------------ |
| Tool invoke      | PhLightning    | `IconTool`      | ⚡ Fast, electric action |
| Web search       | PhBinoculars   | `IconSearch`    | 🔭 Scouting the web      |
| Web scrape       | PhSpider       | `IconScrape`    | 🕷️ Crawling the web      |
| Milestone        | PhCrown        | `IconMilestone` | 👑 Achievement royalty   |
| Delegation arrow | PhArrowRight   | `IconDelegate`  | → Handoff direction      |
| Code diff        | PhPencilSimple | `IconDiff`      | ✏️ Writing code          |

---

## Open Design Questions

- [ ] Should `tool-use` items auto-group when consecutive? (e.g., "3 tool calls by UI Developer" collapsed)
- [ ] Should milestones have a subtle animation (glow pulse) or stay static?
- [ ] How do we handle errors in the timeline? (e.g., `npm test` fails) — red-tinted tool-use?
- [ ] Should code-change cards link to an in-app diff viewer? (feature #19 in 08-FEATURES.md)
- [ ] Verbosity slider: nav bar toggle or settings panel?
- [ ] Should web-search results be clickable (open in browser)?
