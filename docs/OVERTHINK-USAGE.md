# Overthink // Sentinel Deployment Guide

> Agent-powered PR review for bob-ai, orchestrated by [overthink](file:///Users/Roberto/Documents/Work/Cline.bot/overthink_rust/).

**Callsign**: ◆ Sentinel

---

## What This Is

bob-ai uses overthink as its local execution substrate for durable agentic workflows.
Overthink is a local-first, SQLite-backed, event-sourced control plane -- no cloud
services, no daemons. Every operation is a short-lived CLI command reading/writing
durable state.

PR review runs in **two layers**:

```
Layer 1 -- Guardrails (automated, fast)
  review-pr.sh: PR size, conventional commits, console.log,
  secrets, TODO/FIXME, `: any` types

Layer 2 -- Agent review (LLM-powered, substantive)
  Sentinel claims a mission -> analyzes diff -> posts
  architecture/pattern/security review -> mission complete
```

The automated layer catches syntax-level issues. The agent layer covers
architecture fit, pattern consistency, edge cases, type safety, security
risks, and concrete suggestions.

---

## Installing Overthink

Build from source (Rust project):

```bash
# Prerequisites: Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the overthink CLI
cd /Users/Roberto/Documents/Work/Cline.bot/overthink_rust
cargo build --manifest-path overthink/Cargo.toml

# Build the agentic layer (agent registration, missions)
cargo build --manifest-path agentic_layer/Cargo.toml

# Add to PATH (add to ~/.zshrc for persistence)
export PATH="$PATH:/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/overthink/target/debug"
export PATH="$PATH:/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/agentic_layer/target/debug"

# Verify
overthink --help
agentctl --help
```

> **Docs**: `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/docs/`
> **Onboarding**: `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/PRINCIPAL_ENGINEER_ONBOARDING.md`

---

## Quick Start

```bash
# 1. Initialize instance (one-time -- builds, registers, configures)
bash scripts/overthink/init-instance.sh

# 2. Run automated checks
bash scripts/review-pr.sh 42

# 3. Run full scenario (checks + logging)
bash scripts/overthink/run-scenario.sh 42

# 4. Via overthink CLI
overthink run pr-reviewer --instance bob-ai --inputs '{"PR_NUMBER":"42"}'
overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42
overthink show @last --instance bob-ai
```

---

## Mission Lifecycle

Overthink manages agent work through a durable mission lifecycle:

```
  mission created (PR triggers review)
       |
  [claim] --> Sentinel picks up the mission
       |
  [plan]  --> fetch diff, identify changed files
       |
  [exec]  --> LLM analysis: architecture, patterns, security
       |
  [verify] -> validate against policies (budget <= $2, timeout <= 5min)
       |
  [complete] -> post review comment, log to journal
```

All state lives in a single SQLite database. The journal is append-only with
intent/fact separation. Projections are deterministically rebuildable.
No long-running processes.

---

## Review Pipeline

| # | Layer | What |
|---|-------|------|
| 1 | auto  | Fetch diff via `gh pr diff` |
| 2 | auto  | Check PR size (block >600, warn >450) |
| 3 | auto  | Validate conventional commits |
| 4 | auto  | Scan: console.log, secrets, TODO/FIXME, `: any` |
| 5 | auto  | Post guardrail comment on PR |
| 6 | agent | Sentinel claims mission, LLM analyzes diff |
| 7 | agent | Post intelligent review comment on PR |
| 8 | both  | Save results to `reviews/` and `.overthink/logs/` |

---

## File Layout

```
scripts/
  review-pr.sh                      # automated checks (standalone)
  task-specs/
    pr-reviewer.v1.json              # overthink TaskSpec definition
  overthink/
    instance.json                    # instance configuration
    init-instance.sh                 # one-time setup (build + register)
    run-scenario.sh                  # scenario runner (no CLI needed)
    scenarios/
      pr-review.json                 # scenario definition
```

---

## Configuration

**TaskSpec** (`scripts/task-specs/pr-reviewer.v1.json`)
- timeout: 5min | budget: $2.00 | retries: 2 | backoff: 30s
- inputs: `PR_NUMBER` (required), `REPO` (required), `BASE_REF` (optional)

**Instance** (`scripts/overthink/instance.json`)
- queue: local, 30s poll | defaults: `REPO=RobertoLangarica/bob-ai`, `GIT_PAGER=cat`

---

## Results

```bash
ls reviews/                              # local review files
cat reviews/pr-42-review.md              # read a review
ls .overthink/logs/                      # scenario run logs
overthink show @last --instance bob-ai   # via CLI
overthink status                         # instance health
```

---

## Prerequisites

- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **gh CLI**: `brew install gh` then `gh auth login`
- **overthink**: built from `/Users/Roberto/Documents/Work/Cline.bot/overthink_rust/`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `overthink: command not found` | add to PATH (see Installing section) |
| `cargo build` fails | `rustup update`, ensure edition 2021 |
| `gh: command not found` | `brew install gh` |
| PR comment not posted | `gh auth status` -- needs `repo` scope |
| script hangs | `export GIT_PAGER=cat` |
