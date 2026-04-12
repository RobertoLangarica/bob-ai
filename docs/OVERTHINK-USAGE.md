# Overthink Integration — Usage Guide

How to use the overthink-powered PR review system for bob-ai.

**Callsign**: Sentinel (Code Review)

## Overview

The integration automates code reviews for bob-ai pull requests. It runs via:

1. **GitHub Actions** — Automatically on every PR open/push
2. **overthink CLI** — `overthink run pr-reviewer --instance bob-ai --inputs '{"PR_NUMBER":"42"}'`
3. **Scenario runner** — `bash scripts/overthink/run-scenario.sh 42`
4. **Direct script** — `bash scripts/review-pr.sh 42`

```
Agent creates PR → GitHub Action triggers → review-pr.sh runs →
  Posts review comment → Saves to reviews/

OR (local):

overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42 →
  TaskSpec executes review-pr.sh → Results in overthink artifacts
```

## Quick Start

```bash
# 1. Initialize the instance (one-time)
bash scripts/overthink/init-instance.sh

# 2. Run a review
bash scripts/review-pr.sh 42            # direct
bash scripts/overthink/run-scenario.sh 42  # with logging

# 3. Via overthink CLI (if installed)
overthink run pr-reviewer --instance bob-ai --inputs '{"PR_NUMBER":"42"}'
overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42
overthink show @last --instance bob-ai
```

## Review Pipeline

| Step | Check | Action |
|------|-------|--------|
| 1 | Fetch diff | `gh pr diff` |
| 2 | PR size | Block >600 lines, warn >450 |
| 3 | Conventional commits | Validate `type(scope): desc` |
| 4 | Code scan | console.log, secrets, TODO/FIXME, `: any` |
| 5 | Post comment | `gh pr comment` |
| 6 | Save locally | `reviews/pr-<number>-review.md` |

## File Layout

```
scripts/
├── review-pr.sh                    # Core review script (standalone)
├── task-specs/
│   └── pr-reviewer.v1.json         # Overthink TaskSpec definition
└── overthink/
    ├── instance.json               # Instance configuration
    ├── init-instance.sh            # One-time setup script
    ├── run-scenario.sh             # Scenario runner (no overthink needed)
    └── scenarios/
        └── pr-review.json          # Scenario definition
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
ls reviews/                              # list local reviews
cat reviews/pr-42-review.md              # read a review
ls .overthink/logs/                      # scenario run logs
overthink show @last --instance bob-ai   # via CLI
```

## Prerequisites

- **gh CLI**: `brew install gh` then `gh auth login`
- **overthink CLI**: Optional — bash scripts work without it

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `gh: command not found` | `brew install gh` |
| PR comment not posted | Check `gh auth status` has `repo` scope |
| Review script hangs | Set `GIT_PAGER=cat` |
| overthink not found | Use bash scripts directly |
