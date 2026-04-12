#!/bin/bash
# init-instance.sh — Initialize the overthink instance for bob-ai
#
# Usage:
#   bash scripts/overthink/init-instance.sh
#
# Prerequisites:
#   - overthink_rust CLI installed and on PATH
#   - gh CLI authenticated (gh auth status)
#   - Run from the bob-ai repo root
#
# Callsign: Sentinel (Code Review)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Initializing overthink instance: bob-ai"
echo "  Repo root: $REPO_ROOT"
echo "  Callsign:  Sentinel (Code Review)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$REPO_ROOT"

# --- Step 1: Check prerequisites ---

echo ""
echo "[1/4] Checking prerequisites..."

if ! command -v overthink &> /dev/null; then
  echo "  ⚠ overthink CLI not found on PATH"
  echo "  Install from: https://github.com/user/overthink_rust"
  echo "  Or add to PATH: export PATH=\$PATH:/path/to/overthink_rust/target/release"
  echo ""
  echo "  Continuing with manual setup (files only)..."
  OVERTHINK_AVAILABLE=false
else
  OVERTHINK_VERSION=$(overthink --version 2>/dev/null || echo "unknown")
  echo "  ✓ overthink CLI found: $OVERTHINK_VERSION"
  OVERTHINK_AVAILABLE=true
fi

if ! command -v gh &> /dev/null; then
  echo "  ✗ gh CLI not found. Install: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "  ✗ gh CLI not authenticated. Run: gh auth login"
  exit 1
fi

echo "  ✓ gh CLI authenticated"

# --- Step 2: Create directory structure ---

echo ""
echo "[2/4] Creating directory structure..."

mkdir -p .overthink/logs
mkdir -p reviews

# Copy instance config
if [ ! -f .overthink/instance.json ]; then
  cp "$SCRIPT_DIR/instance.json" .overthink/instance.json
  echo "  ✓ Instance config: .overthink/instance.json"
else
  echo "  ⏭ Instance config already exists"
fi

echo "  ✓ Directories created"

# --- Step 3: Initialize overthink (if available) ---

echo ""
echo "[3/4] Initializing overthink instance..."

if [ "$OVERTHINK_AVAILABLE" = true ]; then
  # Initialize instance in the repo
  overthink init --here --instance bob-ai 2>&1 || echo "  ⚠ Already initialized"

  # Attach local queue
  overthink queue attach --local --instance bob-ai 2>&1 || echo "  ⚠ Queue already attached"

  # Install the pr-reviewer TaskSpec
  overthink task-spec install \
    --from scripts/task-specs/pr-reviewer.v1.json \
    --instance bob-ai 2>&1 || echo "  ⚠ TaskSpec already installed"

  echo "  ✓ Overthink instance initialized"
else
  echo "  ⏭ Skipping overthink CLI init (not installed)"
  echo "  Manual setup complete — files are in place for when overthink is available"
fi

# --- Step 4: Verify setup ---

echo ""
echo "[4/4] Verifying setup..."

# Check that the TaskSpec is valid JSON
if python3 -c "import json; json.load(open('scripts/task-specs/pr-reviewer.v1.json'))" 2>/dev/null; then
  echo "  ✓ TaskSpec JSON is valid"
else
  echo "  ✗ TaskSpec JSON is invalid!"
  exit 1
fi

# Check that the scenario is valid JSON
if python3 -c "import json; json.load(open('scripts/overthink/scenarios/pr-review.json'))" 2>/dev/null; then
  echo "  ✓ Scenario JSON is valid"
else
  echo "  ✗ Scenario JSON is invalid!"
  exit 1
fi

# Check that the review script exists and is executable
if [ -x scripts/review-pr.sh ]; then
  echo "  ✓ Review script is executable"
else
  chmod +x scripts/review-pr.sh
  echo "  ✓ Review script made executable"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ bob-ai overthink instance ready!"
echo ""
echo "Quick start:"
echo "  # Run a PR review manually"
echo "  bash scripts/review-pr.sh 42"
echo ""
if [ "$OVERTHINK_AVAILABLE" = true ]; then
  echo "  # Run via overthink"
  echo "  overthink run pr-reviewer --instance bob-ai --inputs '{\"PR_NUMBER\":\"42\"}'"
  echo ""
  echo "  # Run via scenario"
  echo "  overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42"
  echo ""
  echo "  # Check last result"
  echo "  overthink show @last --instance bob-ai"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
