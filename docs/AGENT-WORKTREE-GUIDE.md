# Agent Worktree Guide

How agents work on bob-ai using git worktrees for isolation, with shared dependencies and non-interactive git.

## Quick Start

```bash
# From the main bob-ai repo
cd bob-ai

# Create a worktree for your task
bash scripts/create-agent-worktree.sh feat/my-feature

# Work in the worktree
cd ../bob-ai-feat-my-feature
pnpm run dev      # Start dev server
pnpm test         # Run tests
```

## What the Script Does

`scripts/create-agent-worktree.sh` automates everything:

1. **Creates a git worktree** on a new branch
2. **Enables sparse checkout** — only downloads needed files (app/src, docs, scripts, config)
3. **Configures git** — disables pagers and interactive prompts
4. **Installs dependencies** — via pnpm (shared global store) or npm

## Sparse Checkout

Worktrees only include essential paths to keep things fast and focused:

```
✅ Included:
  app/src/              # Vue source code
  app/public/           # Static assets
  app/package.json      # App dependencies
  app/vite.config.ts    # Vite config
  app/tsconfig*.json    # TypeScript configs
  app/eslint.config.ts  # Linter config
  docs/                 # Documentation
  scripts/              # Helper scripts
  .github/              # CI/CD workflows
  package.json          # Root config
  pnpm-workspace.yaml   # Workspace config

❌ Excluded:
  app/node_modules/     # Installed fresh via pnpm
  .git/                 # Main git history (worktree has its own ref)
```

## Non-Interactive Git

All git commands in worktrees are configured to never block:

```bash
# These all work without pagers or prompts
git status        # Prints inline
git diff          # Prints inline (no less/more)
git log           # Prints inline
git show HEAD     # Prints inline

# Aliases for common operations
git st            # Short status
git df            # Diff with stats
git lg            # Last 20 commits, one line each
```

## pnpm: Shared Dependencies

When using pnpm, dependencies are stored in a global content-addressable store:

- **First worktree**: Downloads packages to global store (~/.local/share/pnpm)
- **Subsequent worktrees**: Hardlinks from store (instant, no disk waste)

```bash
# Install pnpm if not available
npm install -g pnpm

# In any worktree, install is nearly instant
pnpm install
```

### Fallback to npm

If pnpm is not installed, the script falls back to npm. This works but:

- Each worktree gets its own `node_modules/` copy
- Slower install times
- More disk usage

## Running Dev Server

```bash
# Each worktree can run its own dev server
pnpm run dev        # Vite picks a random free port

# Or specify a port
pnpm run dev -- --port 5174
```

No port conflicts between worktrees — Vite auto-selects.

## Creating a PR from a Worktree

```bash
# Stage and commit (conventional commits enforced)
git add .
git commit -m "feat(chat): add message input component"

# Push and create PR
git push origin feat/my-feature
gh pr create --title "feat(chat): add message input" --body "Description..."
```

## Cleanup

```bash
# From main repo
bash scripts/remove-agent-worktree.sh ../bob-ai-feat-my-feature

# Also delete the branch
bash scripts/remove-agent-worktree.sh ../bob-ai-feat-my-feature --delete-branch

# List all worktrees
git worktree list
```

## PR Size Guide

- **Target**: <375 lines per PR
- **Warning**: 375-500 lines
- **Blocked**: >500 lines (CI will fail)

If your changes exceed 500 lines, split into multiple worktrees/PRs:

```bash
# Split work across worktrees
bash scripts/create-agent-worktree.sh feat/chat-data-model
bash scripts/create-agent-worktree.sh feat/chat-ui-components
bash scripts/create-agent-worktree.sh feat/chat-websocket
```

## pnpm Migration

The repo is transitioning from npm to pnpm. To complete the migration:

```bash
# In the main worktree (when no other agents are working)
npm install -g pnpm
pnpm import                          # Convert package-lock.json → pnpm-lock.yaml
rm -rf node_modules package-lock.json
rm -rf app/node_modules app/package-lock.json
pnpm install                         # Install via global store
```

After migration, all worktrees will automatically use pnpm.
