#!/bin/bash
# run-scenario.sh — Run the pr-review scenario (with logging, without overthink CLI)
#
# Usage:
#   bash scripts/overthink/run-scenario.sh <pr-number> [repo] [base-ref]
#
# Wraps scripts/review-pr.sh with scenario logging and structured output.
# Equivalent to: overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42
#
# Callsign: Sentinel (Code Review)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PR_NUMBER="$1"
REPO="${2:-$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo 'RobertoLangarica/bob-ai')}"
BASE_REF="${3:-main}"

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <pr-number> [repo] [base-ref]"
  echo ""
  echo "Examples:"
  echo "  $0 42"
  echo "  $0 42 RobertoLangarica/bob-ai main"
  exit 1
fi

export GIT_PAGER=cat

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Sentinel (Code Review) — PR Review Scenario"
echo "  PR: #$PR_NUMBER | Repo: $REPO | Base: $BASE_REF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_DIR="$REPO_ROOT/.overthink/logs"
mkdir -p "$LOG_DIR"

# --- Run the review ---
cd "$REPO_ROOT"
bash scripts/review-pr.sh "$PR_NUMBER" "$REPO" "$BASE_REF"
EXIT_CODE=$?

# --- Save scenario log ---
FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCENARIO_LOG="$LOG_DIR/pr-review-${PR_NUMBER}-$(date +%s).json"

cat > "$SCENARIO_LOG" << EOF
{
  "scenario": "pr-review",
  "instance": "bob-ai",
  "callsign": "Sentinel (Code Review)",
  "pr_number": "$PR_NUMBER",
  "repo": "$REPO",
  "base_ref": "$BASE_REF",
  "started_at": "$STARTED_AT",
  "finished_at": "$FINISHED_AT",
  "exit_code": $EXIT_CODE,
  "review_file": "reviews/pr-${PR_NUMBER}-review.md"
}
EOF

echo ""
echo "📋 Scenario log saved: $SCENARIO_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
