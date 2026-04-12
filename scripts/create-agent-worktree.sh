#!/bin/bash
# create-agent-worktree.sh — Create a fully configured worktree for agent use
#
# Usage:
#   bash scripts/create-agent-worktree.sh <branch-name> [worktree-dir]
#
# Examples:
#   bash scripts/create-agent-worktree.sh feat/chat-ui
#   bash scripts/create-agent-worktree.sh fix/auth-bug ../bob-ai-auth-fix
#
# What this does:
#   1. Creates a git worktree on a new branch
#   2. Enables sparse checkout (only app/src, docs, scripts, config)
#   3. Configures git for non-interactive agent use (no pagers)
#   4. Installs dependencies via pnpm (shared global store) or npm
#   5. Ready to run dev server, tests, build immediately

set -e

BRANCH_NAME="$1"
WORKTREE_DIR="${2:-../bob-ai-${BRANCH_NAME//\//-}}"
MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# --- Validation ---

if [ -z "$BRANCH_NAME" ]; then
  echo "Usage: $0 <branch-name> [worktree-dir]"
  echo ""
  echo "Examples:"
  echo "  $0 feat/chat-ui"
  echo "  $0 fix/auth-bug ../bob-ai-auth-fix"
  exit 1
fi

if [ -d "$WORKTREE_DIR" ]; then
  echo "Error: Directory '$WORKTREE_DIR' already exists."
  echo "To remove an existing worktree: git worktree remove $WORKTREE_DIR"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating agent worktree"
echo "  Branch:   $BRANCH_NAME"
echo "  Location: $WORKTREE_DIR"
echo "  Source:   $MAIN_REPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Step 1: Create worktree ---

echo ""
echo "[1/4] Creating git worktree..."
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" 2>&1
echo "  ✓ Worktree created"

cd "$WORKTREE_DIR"

# --- Step 2: Sparse checkout ---

echo ""
echo "[2/4] Configuring sparse checkout..."
git sparse-checkout init --cone
git sparse-checkout set \
  app/src \
  app/public \
  app/package.json \
  app/tsconfig.json \
  app/tsconfig.app.json \
  app/tsconfig.node.json \
  app/vite.config.ts \
  app/index.html \
  app/env.d.ts \
  app/.prettierrc.json \
  app/.oxlintrc.json \
  app/.editorconfig \
  app/eslint.config.ts \
  docs \
  scripts \
  package.json \
  pnpm-workspace.yaml \
  commitlint.config.js \
  .gitignore \
  .github
echo "  ✓ Sparse checkout enabled"
echo "    Included: app/src, app/config, docs, scripts, .github"

# --- Step 3: Non-interactive git ---

echo ""
echo "[3/4] Configuring git for non-interactive use..."

# Disable all pagers
git config core.pager cat
git config pager.diff false
git config pager.log false
git config pager.show false
git config pager.status false
git config pager.branch false

# Disable interactive prompts
git config advice.detachedHead false
git config pull.rebase true

# Agent-friendly aliases
git config alias.st "status --short"
git config alias.df "diff --no-pager --stat"
git config alias.lg "log --oneline -20 --no-pager"

echo "  ✓ Git configured (no pagers, non-interactive)"

# --- Step 4: Install dependencies ---

echo ""
echo "[4/4] Installing dependencies..."

if command -v pnpm &> /dev/null; then
  echo "  Using pnpm (shared global store — fast & no duplication)"
  pnpm install --silent 2>&1
  echo "  ✓ Dependencies installed via pnpm"
elif [ -f "package-lock.json" ] || [ -f "app/package-lock.json" ]; then
  echo "  Using npm (pnpm not found — consider installing: npm i -g pnpm)"
  npm install --silent 2>&1
  if [ -f "app/package.json" ]; then
    (cd app && npm install --silent 2>&1)
  fi
  echo "  ✓ Dependencies installed via npm"
else
  echo "  ⚠ No lock file found. Run 'pnpm install' or 'npm install' manually."
fi

# --- Done ---

WORKTREE_ABS=$(cd "$WORKTREE_DIR" 2>/dev/null && pwd || echo "$WORKTREE_DIR")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Worktree ready!"
echo ""
echo "  cd $WORKTREE_ABS"
echo ""
echo "Available commands:"
echo "  pnpm run dev       # Start dev server (random free port)"
echo "  pnpm test          # Run tests"
echo "  pnpm run build     # Build app"
echo "  pnpm run lint      # Lint code"
echo ""
echo "Git (non-interactive):"
echo "  git st             # Short status"
echo "  git df             # Diff with stats"
echo "  git lg             # Last 20 commits"
echo "  git diff           # Full diff (no pager)"
echo ""
echo "When done:"
echo "  git add . && git commit -m 'feat(scope): description'"
echo "  git push origin $BRANCH_NAME"
echo "  gh pr create --title '...' --body '...'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
