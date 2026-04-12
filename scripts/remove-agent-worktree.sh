#!/bin/bash
# remove-agent-worktree.sh — Clean up an agent worktree
#
# Usage:
#   bash scripts/remove-agent-worktree.sh <worktree-dir> [--delete-branch]
#
# Examples:
#   bash scripts/remove-agent-worktree.sh ../bob-ai-feat-chat-ui
#   bash scripts/remove-agent-worktree.sh ../bob-ai-feat-chat-ui --delete-branch

set -e

WORKTREE_DIR="$1"
DELETE_BRANCH="${2:-}"

if [ -z "$WORKTREE_DIR" ]; then
  echo "Usage: $0 <worktree-dir> [--delete-branch]"
  echo ""
  echo "Active worktrees:"
  git worktree list
  exit 1
fi

if [ ! -d "$WORKTREE_DIR" ]; then
  echo "Error: Directory '$WORKTREE_DIR' does not exist."
  echo ""
  echo "Active worktrees:"
  git worktree list
  exit 1
fi

# Get branch name before removing
BRANCH=$(cd "$WORKTREE_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo "Removing worktree: $WORKTREE_DIR (branch: $BRANCH)"

# Remove worktree
git worktree remove "$WORKTREE_DIR" --force 2>&1
echo "✓ Worktree removed"

# Optionally delete the branch
if [ "$DELETE_BRANCH" = "--delete-branch" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "unknown" ]; then
  git branch -D "$BRANCH" 2>&1
  echo "✓ Branch '$BRANCH' deleted"
fi

# Prune stale worktree references
git worktree prune 2>&1
echo "✓ Worktree references pruned"

echo ""
echo "Active worktrees:"
git worktree list
