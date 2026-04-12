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

We tried a sidebar and rejected it. Reasons:

- Takes too much horizontal space in a compact window.
- Creates a two-panel mental model when we want single-focus.
- The sidebar was replaced by a **horizontal tab strip** at the top.

**Current layout:**

```
[👻 BoB] | [⚙ SWE Team ●] [👽 Research Team] [✨ New]  ...  [Orbital|Tasks] [💓 Activity] [🍪]
```

- **Left side**: BoB + team tabs (click to switch chat)
- **Right side**: Activity toggle + sub-view switcher + settings
- Active tab gets a `#1e1e22` background pill
- Running teams show a green status dot

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

### Four-panel 2×2 Grid

- Showed all 4 visualizations simultaneously
- User preferred full-screen single views for the compact window

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
- [ ] How do we handle many teams in the top nav? Overflow? Scrollable? Dropdown?
