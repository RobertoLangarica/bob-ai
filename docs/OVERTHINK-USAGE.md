# Overthink Integration — Usage Guide

How to use the overthink-powered PR review system for bob-ai.

**Callsign**: Sentinel (Code Review)

## Overview

bob-ai uses [overthink](file:///Users/Roberto/Documents/Work/Cline.bot/overthink_rust/) as its
local execution substrate for agent-powered code reviews. Overthink is a local-first, SQLite-backed,
event-sourced control plane that orchestrates durable agentic workflows — no cloud services required.

The PR review has **two layers**:

1. **Automated checks** (`scripts/review-pr.sh`) — Fast, deterministic: PR size, conventional commits,
   console.log, secrets, TODO/FIXME, `: any` types. These are the "guardrails."
2. **Agent review** (via overthink) — An AI agent (Sentinel) claims a review mission, analyzes the
   diff with LLM intelligence, and posts a substantive code review covering architecture, patterns,
   edge cases, and suggestions. This is the real review.

Overthink dispatches the agent, tracks the mission lifecycle (claim → plan → verify → complete),
enforces budget/timeout policies, and stores results durably in its SQLite journal.

```
PR opened → GitHub Action → review-pr.sh (fast checks) → posts automated comment

PR opened → overthink mission → Sentinel agent claims review →
  LLM analyzes diff → posts intelligent review comment → mission complete
```

## Installing Overthink

Overthink is a Rust project. Build it locally from source:

```bash
# Prerequisites: Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the overthink CLI
cd /Users/Roberto/Documents/Work/Cline.bot/overthink_rust
cargo build --manifest-path overthink/Cargo.toml

# The binary is at:
# /Users/Roberto/Documents/Work/Cline.bot/overthink_rust/overthink/target/debug/overthink

# Add to PATH (add to ~/.zshrc for persistence)
export PATH="$PATH:/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/overthink/target/debug"

# Verify
overthink --help
```

For the agentic layer (agent registration, missions, collaboration):

```bash
cargo build --manifest-path agentic_layer/Cargo.toml
# Binary: agentic_layer/target/debug/agentctl
export PATH="$PATH:/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/agentic_layer/target/debug"
```

> **Docs**: Full overthink documentation is at
> `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/docs/`
> and the onboarding guide at
> `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/PRINCIPAL_ENGINEER_ONBOARDING.md`

## Quick Start

```bash
# 1. Initialize the overthink instance (one-time)
bash scripts/overthink/init-instance.sh

# 2. Run automated checks only
bash scripts/review-pr.sh 42

# 3. Run full scenario (automated checks + agent review logging)
bash scripts/overthink/run-scenario.sh 42

# 4. Via overthink CLI
overthink run pr-reviewer --instance bob-ai --inputs '{"PR_NUMBER":"42"}'
overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42
overthink show @last --instance bob-ai
```

## How the Agent Review Works

### Architecture

Overthink uses a **mission lifecycle** to manage agent work:

1. **Mission created** — A PR triggers a review mission (via GitHub Action or manual)
2. **Agent claims** — Sentinel (Code Review) claims the mission
3. **Plan** — The agent fetches the PR diff, analyzes changed files
4. **Execute** — LLM-powered analysis: architecture review, pattern checks, edge cases,
   suggestions, risk assessment
5. **Verify** — Results are validated against policies (budget ≤ $2, timeout ≤ 5min)
6. **Complete** — Review posted as PR comment, mission logged in SQLite journal

### What the Agent Reviews (beyond automated checks)

The automated script catches syntax-level issues. The agent review covers:

- **Architecture fit** — Do changes align with bob-ai's architecture (see `docs/02-ARCHITECTURE.md`)?
- **Pattern consistency** — Does the code follow established patterns in the codebase?
- **Edge cases** — Are error states, empty states, loading states handled?
- **Type safety** — Beyond `: any`, are types properly structured?
- **Security** — Deeper than regex: injection risks, auth gaps, data exposure
- **Suggestions** — Concrete improvements with code examples

### Overthink Internals

All state lives in a single SQLite database per "cell" (instance). The journal is append-only
with intent/fact separation — intents are requests ("please review PR #42"), facts are
confirmations ("review completed"). Projections (summary tables) are deterministically
rebuildable from the journal. No long-running daemons — each CLI command is a short-lived
process that reads/writes durable state.

## Review Pipeline

| Step | Layer | What |
|------|-------|------|
| 1 | Automated | Fetch diff via `gh pr diff` |
| 2 | Automated | Check PR size (block >600, warn >450) |
| 3 | Automated | Validate conventional commits |
| 4 | Automated | Scan: console.log, secrets, TODO/FIXME, `: any` |
| 5 | Automated | Post guardrail comment on PR |
| 6 | Agent | Sentinel claims mission, LLM analyzes diff |
| 7 | Agent | Post intelligent review comment on PR |
| 8 | Both | Save results to `reviews/` and `.overthink/logs/` |

## File Layout

```
scripts/
├── review-pr.sh                    # Automated checks (standalone, fast)
├── task-specs/
│   └── pr-reviewer.v1.json         # Overthink TaskSpec definition
└── overthink/
    ├── instance.json               # Instance configuration
    ├── init-instance.sh            # One-time setup (builds + registers)
    ├── run-scenario.sh             # Scenario runner (no overthink needed)
    └── scenarios/
        └── pr-review.json          # Scenario definition (6-step pipeline)
```

## Configuration

### TaskSpec (`scripts/task-specs/pr-reviewer.v1.json`)

- **Timeout**: 5 minutes | **Budget**: $2.00 | **Retries**: 2 | **Backoff**: 30s
- **Inputs**: `PR_NUMBER` (required), `REPO` (required), `BASE_REF` (optional, default: main)

### Instance (`scripts/overthink/instance.json`)

- **Queue**: local, 30s poll interval
- **Defaults**: `REPO=RobertoLangarica/bob-ai`, `BASE_REF=main`, `GIT_PAGER=cat`

## Checking Results

```bash
ls reviews/                              # local review files
cat reviews/pr-42-review.md              # read a review
ls .overthink/logs/                      # scenario run logs
overthink show @last --instance bob-ai   # via CLI
overthink status                         # instance health
```

## Prerequisites

- **Rust toolchain**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **gh CLI**: `brew install gh` then `gh auth login`
- **overthink CLI**: Built from `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `overthink: command not found` | Add to PATH: `export PATH="$PATH:/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/overthink/target/debug"` |
| `cargo build` fails | Run `rustup update` and ensure Rust 2021 edition |
| `gh: command not found` | `brew install gh` |
| PR comment not posted | Check `gh auth status` has `repo` scope |
| Review script hangs | Set `GIT_PAGER=cat` |
