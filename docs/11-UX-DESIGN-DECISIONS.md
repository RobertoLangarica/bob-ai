# UX Design Decisions

Living document tracking all design decisions made during the visual mock phase.
Updated as we iterate.

---

## Philosophy

### Chat-First, Minimalist

- Everything happens through conversation. No complex dashboards or settings panels.
- Teams are persisted templates the user creates via BoB (the app assistant).
- Agents are **hidden implementation details** — users talk to teams, not individual agents.
- The UI should feel **invisible** — get out of the way and let the work happen.

### Fast Tool Feel

- The app is intentionally compact: **720×520px** centered window with rounded corners.
- Designed to feel like a fast utility (Raycast, Spotlight) rather than a sprawling IDE.
- Dark background (`#080809`) behind the window creates the floating-panel effect.
- No sidebar — everything is accessible from a slim top nav bar.

---

## Layout

### Top Navigation Bar (no sidebar)

We tried a sidebar and rejected it (see Rejected Ideas). Then tried team tabs in the nav bar — also rejected because the nav got cluttered with many teams.

**Current layout:**

```
[👻 SWE Team ▾]  ...  [Orbital|Tasks] [💓 Activity] [🍪]
 ┊ Research Team       ↑ only when Activity mode
 ┊   ░░░ (fade)
```

- **Left side**: BoB avatar circle + current team name + `▾` caret
  - Avatar: 18px round, `#0D0D0F` bg, `${cyan}40` border
  - Hover opens a dropdown listing **only teams** (no BoB entry)
  - Below the trigger: **stacked team peek** — other teams shown at decreasing opacity (0.3, 0.12) with an alpha gradient mask fading into the nav bg
  - No status dots anywhere (removed — clutters the minimal feel)
- **Right side**: Activity toggle + sub-view switcher + settings
- Dropdown is **naked**: `#131315` bg, `#222226` border, 160px min-width
  - Items: just icon + team name, no backgrounds, no borders
  - Active team: brighter text (`#e0e0e4` vs `#808088`) and icon (`#b0b0b8` vs `#606068`)
  - No BoB entry — BoB is the app brand, not a menu item

### New Team Button

- Positioned **above the input area** (bottom of chat), close to where the user types
- Only shown when viewing a team chat (hidden on BoB since you're already there)
- Visual: BoB ghost icon in cyan (60% opacity) + salmon `+` sign positioned to the right of the ghost + "New Team" label in muted gray (`#505058`)
- The salmon pink (`#FA8072`) for the `+` — warmer than the neon pink, more inviting
- Click action: switches to BoB chat (team creation happens through conversation)

**New Team icon evolution:**
| Attempt | Verdict |
|---------|---------|
| MagicWand + "New Team" as floating border bubble | Too clever, border bubble felt detached |
| MagicWand + "New Team" at top of chat messages | Too far from the input, user's first action is to type |
| BoB brand (ghost + "BoB ai") above input | Branding felt wrong as a button |
| Ghost icon in cyan + salmon `+` + "New Team" above input | ✅ Current — clear, branded, positioned for action |

### Two Modes

1. **Chat mode** (default) — full-screen chat for the selected team/BoB
2. **Activity mode** — full-screen visualization of agent work

Switching is via the "Activity" toggle button on the right side of the nav bar.

---

## Color System

### Neon Dark Theme

```
Body:       #0D0D0F
Surfaces:   #161619
Hover:      #1e1e22
Borders:    #2a2a2e
Window bg:  #080809 (behind the floating window)
```

### Neon Accent Palette

```
Cyan:    #00FFDD  — BoB's signature color
Purple:  #BF40FF  — Primary actions, user identity
Green:   #39FF14  — Success, completed
Yellow:  #CCFF00  — Warnings, paused
Pink:    #FF10F0  — Errors, "ai" subtext
Orange:  #FF6B2B  — Activity, working
Salmon:  #FA8072  — Warm accent (New Team "+", friendlier than neon pink)
```

### Agent Color Assignments

Each agent gets a unique neon color for instant visual identification:

```
Team Lead    → orange (#FF6B2B)  — warm, coordinator energy
UI Developer → purple (#BF40FF)  — creative, visual
Backend Dev  → cyan   (#00FFDD)  — technical, precise
Research     → green  (#39FF14)  — exploratory, fresh
```

These colors are used consistently across:

- Chat avatars and agent names
- Thinking section text and borders
- Activity dots and status badges
- Orbital view nodes and connections
- Task stream chips and thinking lines
- File path text

Defined in `agents.ts` as the single source of truth.

---

## Identity & Icons

### BoB

- **Icon**: Ghost (PhGhost) — quirky, friendly, slightly mysterious
- **Color**: Neon cyan (#00FFDD)
- **Name display**: "BoB" with "ai" on a second line in neon pink
- Avatar: dark background with cyan border and cyan ghost

### Icon Vocabulary (Phosphor Icons, light weight)

Rule: **No boring icons.** Every icon should feel like it was picked by someone with personality.

**Agent Roles:**
| Role | Icon | Metaphor |
|------|------|----------|
| Team Lead | Dog | Loyal coordinator |
| UI Dev | Butterfly | Makes pretty things |
| Backend | Bug | Lives in code |
| Research | Alien | Probing the unknown |
| Writer | Bird | Sings beautiful prose |
| Data | Fish | Flows through streams |
| Quality | Diamond | Precision, value |
| Debug | Cat | Curious, finds things |
| Auto | Robot | Automation |
| Tips | Wink | Friendly suggestions |

**Status:**
| Status | Icon | Metaphor |
|--------|------|----------|
| Success | Carrot | Harvest, reward |
| Working | Flower | Growing |
| Error | Skull | Dead |
| Idle | Moon+Stars | Sleeping |

**Actions:**
| Action | Icon | Metaphor |
|--------|------|----------|
| Settings | Cookie | Sweet config |
| New | Sparkle | Fresh |
| New Team | MagicWand | Conjure a team |
| Send | Shooting Star | Launch |
| Create | Rocket | Blast off |
| Customize | Lotus | Bloom |
| File | Leaf | Organic |

All icons use `weight="light"` for the thinnest, most invisible feel.
Icons are centralized in `icons.ts` — never import Phosphor directly in components.

### User Identity

- **Icon**: Smiley (PhSmiley) — not the same as any agent icon
- **Color**: Purple (#BF40FF) at low opacity
- **Avatar**: Dark surface (`#1e1e22`) with subtle purple border (35% opacity)
- **Message bubble**: Very subtle purple tint (15% bg, 25% border) — NOT solid purple
- **Design rule**: User elements should be recessive. The focus is on agent responses.

---

## Chat Design

### Message Types

1. **text** — Simple chat bubble (user or bot)
2. **verbose** — Agent message with collapsible thinking section
3. **card** — Rich card (team proposal with agents listed)
4. **activity** — Status card showing agent work progress

### Verbose Messages (Thinking Sections)

- Collapsed by default showing: `{} thinking · N steps  ▸`
- Click to expand: shows step-by-step reasoning in monospace
- Text color matches the agent's assigned color
- Uses `›` prefix for each thinking line
- Opacity cascade: older lines more transparent, latest line brighter
- Border color shifts when expanded (agent color at 18% opacity)

### User Bubbles

- Subtle purple tint, NOT solid color
- Light text (same as everything else)
- Right-aligned with `flex-row-reverse`
- Small avatar with purple smiley

### Agent Avatars in Chat

- Background: agent color at 12% opacity
- Border: agent color at 40% opacity
- Icon: agent color at full opacity
- Agent name shown in agent color (80% opacity)

---

## Activity Visualizations

### Two Sub-Views (full-screen, switchable)

When Activity mode is on, small "Orbital | Tasks" toggle appears in the nav bar.

### Orbital View

- BoB ghost in center with cyan glow and border
- Agents positioned at angles around BoB (not equally spaced — organic feel)
- Each agent is a small avatar in their assigned color
- Working agents: full opacity, pulsing icon, dashed connection line to BoB
- Completed agents: 70% opacity
- Idle agents: 30% opacity
- Two orbit rings (solid inner, dashed outer) for depth
- SVG connection lines from BoB to working agents (agent color, 20% opacity, dashed)

### Task Stream View (combined Pulse Grid + River Flow)

Per-agent horizontal lanes, stacked vertically:

Each lane contains:

1. **Header row**: status dot + icon + name (in agent color) + current action
2. **Task flow chips**: horizontal row of task pills
   - Completed tasks: agent color border + tinted background
   - Working tasks: same + pulsing dot indicator
   - Pending tasks: gray border, muted text
3. **Thinking stream**: monospace lines with `›` prefix in agent color
   - Working agents get a blinking cursor
   - Latest line is brighter, older lines fade
4. **File chips**: tiny pills at bottom showing affected files
5. **Idle agents**: collapsed with dashed line and "idle" text, 50% opacity

---

## Rejected Ideas

### Sidebar

- Tried it, took too much space for a compact window
- Replaced with top nav tabs

### Solid Purple User Bubbles

- "Looks amateur" — too loud, pulls focus from agent content
- Changed to subtle purple tint (15% opacity)

### Solid Purple User Avatar

- Purple-on-black with white icon was too attention-grabbing
- Changed to dark surface with subtle purple border and purple icon

### Garden View

- 2×2 grid of agent tiles with progress bars
- Nice but didn't add enough value over Task Stream
- Removed

### Team Tabs in Nav Bar

- After replacing the sidebar, we put team tabs directly in the nav bar
- Got cluttered with multiple teams — too many items competing for horizontal space
- Replaced with BoB hover menu (single avatar → dropdown) — much cleaner

### Four-panel 2×2 Grid

- Showed all 4 visualizations simultaneously
- User preferred full-screen single views for the compact window

### Status Dots in Nav / Dropdown

- Green dots for running teams, yellow for paused
- Cluttered the minimal feel — removed entirely
- Status is implicit from the chat content

### Filled Background on Dropdown Hover

- `hover:bg-[#1e1e22]` filled backgrounds on menu items
- Then tried outlined borders (`1px solid #2a2a2e`) on hover
- Both felt too heavy — settled on naked items: just icon + name, active item shown by brighter text only

### BoB Entry in Team Dropdown

- Originally the dropdown listed BoB + all teams
- BoB is the app brand, not a switchable "team" — removed from dropdown
- User navigates to BoB via the "New Team" button above the input

### "BoB ai ·" Prefix in Nav Trigger

- Tried adding filled ghost + "BoB" + "ai" (salmon) + separator dot before team name
- Felt cluttered — the BoB avatar is already the brand. Reverted to avatar + team name only

### New Team as Floating Border Bubble

- Tried a pill embedded in the top border of the chat area (`rounded-b-lg`, no top border)
- Visually clever but felt disconnected from the workflow
- Moved to above the input area where the user naturally starts typing

---

## Technical Stack

- **Vue 3** + `<script setup>` (composition API)
- **Naive UI** (dark theme with custom overrides)
- **Tailwind CSS 4** (with `@theme` design tokens)
- **Phosphor Icons Vue** (light weight)
- **Single App.vue** — no router, no stores, no Pinia (fast mocking)
- **Component extraction** only for visualization views

### File Structure

```
app/src/
  main.ts          — Vue + Naive UI setup
  App.vue          — Everything: nav, chat, mode switching
  theme.ts         — Neon palette + Naive UI overrides
  icons.ts         — Centralized icon vocabulary
  agents.ts        — Agent color assignments
  assets/main.css  — Tailwind + design tokens
  components/
    OrbitalView.vue     — BoB-centric orbital visualization
    TaskStreamView.vue  — Combined task flow + thinking streams
```

---

## Open Questions for Next Session

- [ ] Should the Activity view update in real-time or be a snapshot?
- [ ] How does the user switch between teams in Activity mode? (currently shows mock data for "SWE Team")
- [ ] Should thinking sections auto-expand for the most recent message?
- [ ] Do we need a "minimize to tray" or "always on top" mode for the fast-tool feel?
- [ ] How compact can we go? Could this work at 600×400?
- [ ] Should the orbital view animate (slow orbit rotation)?
- [ ] File chips in task stream — should they be clickable to open in editor?
- [x] ~~How do we handle many teams in the top nav?~~ → Solved: BoB hover menu dropdown. Teams listed vertically in popover, scales naturally.

---

## Chat Timeline Philosophy (Added Session 2)

### Timeline Is a Work Log, Not a Chat

The chat view was reframed from "messages between participants" to a **chronological work log**. User messages and BoB responses sit alongside agent activity events, creating a single scannable timeline.

### Agent-to-Agent Messages: Hidden by Default

**Decision:** Agent-to-agent chatter is NOT shown as chat bubbles. Instead:

- **Delegation events** show Team Lead assigning work (compact one-liners)
- **Thinking sections** capture agent reasoning (collapsible)
- **Tool-use events** show agents working (compact chips)
- **Activity cards** summarize progress snapshots

If users want full agent coordination detail, the Activity View provides that. The chat timeline stays clean and scannable.

### "Speaking to BoB" Contract

**Decision:** The user must always feel they're talking to BoB, regardless of which team is selected.

- Input area shows `👻 BoB` label (always visible)
- In team view: `👻 BoB · [Team Name]` shows BoB is the bridge
- BoB always responds first, then agent events appear below
- When work completes, BoB summarizes results

### Milestone Visual Treatment

**Decision:** Milestones get full-width banners that break the timeline rhythm.

- Crown icon (👑) in neon green
- No avatar — centered, full-width
- Thin green lines above and below
- Subtle gradient background
- Never collapse — always visible as timeline anchors

### New Timeline Item Types

Added 6 new event-driven item types (see `docs/12-CHAT-TIMELINE-SPEC.md`):

- `tool-use` — Compact inline chips for agent tool invocations
- `code-change` — Card with file list + diff stats
- `web-search` — Card with query + results
- `web-scrape` — Card with URL + content summary
- `milestone` — Full-width achievement banner
- `delegation` — Compact agent-to-agent handoff row

### New Icons Added

| Icon      | Phosphor       | Name            | Metaphor                |
| --------- | -------------- | --------------- | ----------------------- |
| Tool      | PhLightning    | `IconTool`      | ⚡ Fast electric action |
| Search    | PhBinoculars   | `IconSearch`    | 🔭 Scouting the web     |
| Scrape    | PhSpider       | `IconScrape`    | 🕷️ Crawling the web     |
| Milestone | PhCrown        | `IconMilestone` | 👑 Achievement royalty  |
| Delegate  | PhArrowRight   | `IconDelegate`  | → Handoff direction     |
| Diff      | PhPencilSimple | `IconDiff`      | ✏️ Writing code         |

---

## Architecture Decisions (Added Session 2)

### Event-Driven Activity Hub

**Decision:** All agent activity flows through a central Activity Hub via `emit(type, payload)`. Agents don't know about the UI; the UI subscribes to the hub. This decouples agents from presentation and allows swapping the UI framework.

### Hybrid Storage: JSON + SQLite

**Decision:** Config files (calibrations, templates) use JSON (git-friendly, human-readable). High-volume data (events, chat history, metrics) uses SQLite (queryable, filterable). SQLite files are gitignored; JSON files are committed.

### Calibration via Structured Questions

**Decision:** Rather than free-form instructions, BoB calibrates agents through structured multiple-choice questions. This produces deterministic rules that get injected verbatim into agent system prompts, eliminating LLM interpretation variance.

### Universal Agent Lifecycle

**Decision:** All agents — coding, research, writing, design — follow the same lifecycle: SPAWN → DEBRIEF → PLAN → WORK → COMPLETE. Non-coding agents use the same event types; the system is agent-type-agnostic.

### Workspace Persistence (.bob/ directory)

**Decision:** All bob-ai state lives in `.bob/` within the project workspace. Calibrations, team templates, and milestones are git-committable. History and metrics are local-only (SQLite, gitignored).
