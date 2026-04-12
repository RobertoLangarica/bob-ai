#!/bin/bash
# review-pr.sh — Agent-powered PR code review
#
# Usage:
#   bash scripts/review-pr.sh <pr-number> [repo] [base-ref]
#
# Can be invoked by:
#   1. GitHub Action (automated on PR creation)
#   2. overthink task (local: overthink run pr-reviewer --inputs '{"PR_NUMBER":"42"}')
#   3. Manually (bash scripts/review-pr.sh 42)
#
# Requires: gh CLI authenticated, git

set -e

PR_NUMBER="$1"
REPO="${2:-$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo '')}"
BASE_REF="${3:-main}"

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <pr-number> [repo] [base-ref]"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Reviewing PR #$PR_NUMBER"
echo "  Repo: $REPO"
echo "  Base: $BASE_REF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Gather PR data ---

echo ""
echo "[1/4] Gathering PR data..."

# Get PR metadata
PR_TITLE=$(gh pr view "$PR_NUMBER" --json title -q '.title' 2>/dev/null || echo "Unknown")
PR_BODY=$(gh pr view "$PR_NUMBER" --json body -q '.body' 2>/dev/null || echo "")
PR_AUTHOR=$(gh pr view "$PR_NUMBER" --json author -q '.author.login' 2>/dev/null || echo "Unknown")
PR_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName -q '.headRefName' 2>/dev/null || echo "Unknown")

echo "  Title: $PR_TITLE"
echo "  Author: $PR_AUTHOR"
echo "  Branch: $PR_BRANCH"

# --- Get diff ---

echo ""
echo "[2/4] Getting diff..."

DIFF=$(gh pr diff "$PR_NUMBER" --no-pager 2>/dev/null || echo "Could not fetch diff")
DIFF_STAT=$(gh pr diff "$PR_NUMBER" --no-pager 2>/dev/null | diffstat 2>/dev/null || echo "")

# Get changed files list
FILES_CHANGED=$(gh pr view "$PR_NUMBER" --json files -q '.files[].path' 2>/dev/null || echo "")
FILE_COUNT=$(echo "$FILES_CHANGED" | grep -c . 2>/dev/null || echo "0")

# Count diff lines
ADD_LINES=$(echo "$DIFF" | grep -c '^+[^+]' 2>/dev/null || echo "0")
DEL_LINES=$(echo "$DIFF" | grep -c '^-[^-]' 2>/dev/null || echo "0")
TOTAL_LINES=$((ADD_LINES + DEL_LINES))

echo "  Files changed: $FILE_COUNT"
echo "  Lines: +$ADD_LINES / -$DEL_LINES (total: $TOTAL_LINES)"

# --- Analyze ---

echo ""
echo "[3/4] Analyzing..."

# Build review report
REVIEW_FILE=$(mktemp)

cat > "$REVIEW_FILE" << 'REVIEW_HEADER'
## 🔍 Automated Code Review

REVIEW_HEADER

# PR Size Assessment
if [ "$TOTAL_LINES" -gt 600 ]; then
  echo "### ⛔ PR Size: Too Large ($TOTAL_LINES lines)" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
  echo "This PR exceeds the 600-line limit. Please split into smaller PRs." >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
elif [ "$TOTAL_LINES" -gt 450 ]; then
  echo "### ⚠️ PR Size: Large ($TOTAL_LINES lines)" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
  echo "Approaching the 600-line limit. Consider if this can be split." >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
else
  echo "### ✅ PR Size: Good ($TOTAL_LINES lines)" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
fi

# File breakdown
echo "### 📁 Files Changed ($FILE_COUNT)" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"
echo '```' >> "$REVIEW_FILE"
echo "$FILES_CHANGED" >> "$REVIEW_FILE"
echo '```' >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

# Commit message check
echo "### 📝 Commit Convention Check" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

COMMITS=$(gh pr view "$PR_NUMBER" --json commits -q '.commits[].messageHeadline' 2>/dev/null || echo "")
CONVENTIONAL_PATTERN='^(feat|fix|refactor|docs|test|chore|perf|ci)(\(.+\))?: .+'
BAD_COMMITS=""

while IFS= read -r commit; do
  if [ -n "$commit" ] && ! echo "$commit" | grep -qE "$CONVENTIONAL_PATTERN"; then
    BAD_COMMITS="$BAD_COMMITS\n- ❌ \`$commit\`"
  fi
done <<< "$COMMITS"

if [ -n "$BAD_COMMITS" ]; then
  echo "Some commits don't follow conventional format:" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
  echo -e "$BAD_COMMITS" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
  echo "Expected: \`type(scope): description\`" >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
else
  echo "✅ All commits follow conventional format." >> "$REVIEW_FILE"
  echo "" >> "$REVIEW_FILE"
fi

# Quick checks
echo "### 🔎 Quick Checks" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

# Check for console.log
if echo "$DIFF" | grep -q '^\+.*console\.log'; then
  CONSOLE_COUNT=$(echo "$DIFF" | grep -c '^\+.*console\.log' || echo "0")
  echo "- ⚠️ Found **$CONSOLE_COUNT** \`console.log\` statements in added lines" >> "$REVIEW_FILE"
else
  echo "- ✅ No \`console.log\` statements" >> "$REVIEW_FILE"
fi

# Check for TODO/FIXME
if echo "$DIFF" | grep -q '^\+.*\(TODO\|FIXME\|HACK\|XXX\)'; then
  TODO_COUNT=$(echo "$DIFF" | grep -c '^\+.*\(TODO\|FIXME\|HACK\|XXX\)' || echo "0")
  echo "- ⚠️ Found **$TODO_COUNT** TODO/FIXME markers" >> "$REVIEW_FILE"
else
  echo "- ✅ No TODO/FIXME markers" >> "$REVIEW_FILE"
fi

# Check for .env or secrets
if echo "$DIFF" | grep -qi '^\+.*(api_key\|secret\|password\|token\|\.env)'; then
  echo "- 🔴 **Possible secrets or credentials detected!** Please review carefully." >> "$REVIEW_FILE"
else
  echo "- ✅ No obvious secrets or credentials" >> "$REVIEW_FILE"
fi

# Check for large files
if echo "$DIFF" | grep -q '^\+.*Binary file'; then
  echo "- ⚠️ Binary files included in diff" >> "$REVIEW_FILE"
else
  echo "- ✅ No binary files" >> "$REVIEW_FILE"
fi

# Check for type safety
if echo "$FILES_CHANGED" | grep -q '\.ts$\|\.vue$'; then
  if echo "$DIFF" | grep -q '^\+.*: any'; then
    ANY_COUNT=$(echo "$DIFF" | grep -c '^\+.*: any' || echo "0")
    echo "- ⚠️ Found **$ANY_COUNT** uses of \`: any\` type" >> "$REVIEW_FILE"
  else
    echo "- ✅ No \`: any\` types" >> "$REVIEW_FILE"
  fi
fi

echo "" >> "$REVIEW_FILE"

# Scope analysis
echo "### 🎯 Scope Analysis" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

VUE_FILES=$(echo "$FILES_CHANGED" | grep -c '\.vue$' 2>/dev/null || echo "0")
TS_FILES=$(echo "$FILES_CHANGED" | grep -c '\.ts$' 2>/dev/null || echo "0")
CSS_FILES=$(echo "$FILES_CHANGED" | grep -c '\.css$' 2>/dev/null || echo "0")
MD_FILES=$(echo "$FILES_CHANGED" | grep -c '\.md$' 2>/dev/null || echo "0")
CONFIG_FILES=$(echo "$FILES_CHANGED" | grep -c '\.\(json\|yaml\|yml\|toml\)$' 2>/dev/null || echo "0")

echo "| Type | Count |" >> "$REVIEW_FILE"
echo "|------|-------|" >> "$REVIEW_FILE"
[ "$VUE_FILES" -gt 0 ] && echo "| Vue components | $VUE_FILES |" >> "$REVIEW_FILE"
[ "$TS_FILES" -gt 0 ] && echo "| TypeScript | $TS_FILES |" >> "$REVIEW_FILE"
[ "$CSS_FILES" -gt 0 ] && echo "| CSS | $CSS_FILES |" >> "$REVIEW_FILE"
[ "$MD_FILES" -gt 0 ] && echo "| Documentation | $MD_FILES |" >> "$REVIEW_FILE"
[ "$CONFIG_FILES" -gt 0 ] && echo "| Config | $CONFIG_FILES |" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

# Footer
echo "---" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"
echo "*Automated review by bob-ai PR reviewer. Human review still required.*" >> "$REVIEW_FILE"

# --- Post review ---

echo ""
echo "[4/4] Posting review..."

REVIEW_CONTENT=$(cat "$REVIEW_FILE")

# Post as PR comment
if [ -n "$REPO" ]; then
  gh pr comment "$PR_NUMBER" --body "$REVIEW_CONTENT" 2>/dev/null && \
    echo "  ✓ Review posted to PR #$PR_NUMBER" || \
    echo "  ⚠ Could not post to PR (offline mode? saving locally)"
fi

# Always save locally
REVIEW_DIR="reviews"
mkdir -p "$REVIEW_DIR"
cp "$REVIEW_FILE" "$REVIEW_DIR/pr-$PR_NUMBER-review.md"
echo "  ✓ Review saved to $REVIEW_DIR/pr-$PR_NUMBER-review.md"

# Cleanup
rm -f "$REVIEW_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Review complete for PR #$PR_NUMBER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
