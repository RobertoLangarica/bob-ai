#!/bin/bash
# init-instance.sh — Initialize the overthink instance for bob-ai
#
# Usage:
#   bash scripts/overthink/init-instance.sh
#
# What this does:
#   1. Builds overthink from source (if not already built)
#   2. Registers the Sentinel agent for code review
#   3. Creates the instance directory structure
#   4. Installs the pr-reviewer TaskSpec
#
# Prerequisites:
#   - Rust toolchain (cargo): curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#   - gh CLI authenticated: gh auth login
#   - Run from the bob-ai repo root
#
# Callsign: Sentinel (Code Review)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OVERTHINK_REPO="/Users/Roberto/Documents/Work/Cline.bot/overthink_rust"
OVERTHINK_BIN="$OVERTHINK_REPO/overthink/target/debug/overthink"
AGENTCTL_BIN="$OVERTHINK_REPO/agentic_layer/target/debug/agentctl"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Initializing overthink instance: bob-ai"
echo "  Repo root:     $REPO_ROOT"
echo "  Overthink src: $OVERTHINK_REPO"
echo "  Callsign:      Sentinel (Code Review)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$REPO_ROOT"

# --- Step 1: Check prerequisites ---

echo ""
echo "[1/5] Checking prerequisites..."

# Check gh CLI
if ! command -v gh &> /dev/null; then
  echo "  ✗ gh CLI not found. Install: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "  ✗ gh CLI not authenticated. Run: gh auth login"
  exit 1
fi
echo "  ✓ gh CLI authenticated"

# Check Rust toolchain
if ! command -v cargo &> /dev/null; then
  echo "  ✗ Rust toolchain not found."
  echo "  Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi
echo "  ✓ Rust toolchain: $(cargo --version)"

# Check overthink source exists
if [ ! -d "$OVERTHINK_REPO" ]; then
  echo "  ✗ Overthink source not found at: $OVERTHINK_REPO"
  echo "  Clone it or update the OVERTHINK_REPO path in this script."
  exit 1
fi
echo "  ✓ Overthink source found"

# --- Step 2: Build overthink CLI ---

echo ""
echo "[2/5] Building overthink CLI..."

if [ -f "$OVERTHINK_BIN" ]; then
  echo "  ⏭ overthink binary already built"
else
  echo "  Building overthink (this takes a moment on first build)..."
  (cd "$OVERTHINK_REPO" && cargo build --manifest-path overthink/Cargo.toml 2>&1)
  echo "  ✓ overthink built: $OVERTHINK_BIN"
fi

if [ -f "$AGENTCTL_BIN" ]; then
  echo "  ⏭ agentctl binary already built"
else
  echo "  Building agentctl..."
  (cd "$OVERTHINK_REPO" && cargo build --manifest-path agentic_layer/Cargo.toml 2>&1)
  echo "  ✓ agentctl built: $AGENTCTL_BIN"
fi

# Add to PATH for this session
export PATH="$PATH:$(dirname "$OVERTHINK_BIN"):$(dirname "$AGENTCTL_BIN")"

# --- Step 3: Create directory structure ---

echo ""
echo "[3/5] Creating directory structure..."

mkdir -p .overthink/logs
mkdir -p reviews

if [ ! -f .overthink/instance.json ]; then
  cp "$SCRIPT_DIR/instance.json" .overthink/instance.json
  echo "  ✓ Instance config: .overthink/instance.json"
else
  echo "  ⏭ Instance config already exists"
fi

echo "  ✓ Directories created"

# --- Step 4: Initialize overthink instance ---

echo ""
echo "[4/5] Initializing overthink instance..."

# Initialize the cell (SQLite-backed local instance)
overthink init --here --instance bob-ai 2>&1 || echo "  ⚠ Already initialized"

# Attach local job queue
overthink queue attach --local --instance bob-ai 2>&1 || echo "  ⚠ Queue already attached"

# Install the pr-reviewer TaskSpec
overthink task-spec install \
  --from scripts/task-specs/pr-reviewer.v1.json \
  --instance bob-ai 2>&1 || echo "  ⚠ TaskSpec already installed"

echo "  ✓ Overthink instance initialized"

# --- Step 5: Register the Sentinel agent ---

echo ""
echo "[5/5] Registering Sentinel agent..."

agentctl agent register \
  --agent-key sentinel.code-review \
  --charter-json '{"mission":"pr_code_review","scope":"bob-ai","callsign":"Sentinel (Code Review)","capabilities":["diff_analysis","convention_check","architecture_review","security_scan"]}' \
  2>&1 || echo "  ⚠ Agent already registered"

echo "  ✓ Agent registered: Sentinel (Code Review)"

# --- Verify ---

echo ""
echo "Verifying setup..."

python3 -c "import json; json.load(open('scripts/task-specs/pr-reviewer.v1.json'))" 2>/dev/null && \
  echo "  ✓ TaskSpec JSON valid" || echo "  ✗ TaskSpec JSON invalid!"

python3 -c "import json; json.load(open('scripts/overthink/scenarios/pr-review.json'))" 2>/dev/null && \
  echo "  ✓ Scenario JSON valid" || echo "  ✗ Scenario JSON invalid!"

[ -x scripts/review-pr.sh ] && echo "  ✓ Review script executable" || chmod +x scripts/review-pr.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ bob-ai overthink instance ready!"
echo ""
echo "  # Add to PATH (or add to ~/.zshrc):"
echo "  export PATH=\"\$PATH:$(dirname "$OVERTHINK_BIN"):$(dirname "$AGENTCTL_BIN")\""
echo ""
echo "  # Run a PR review"
echo "  bash scripts/review-pr.sh 42                    # automated checks only"
echo "  bash scripts/overthink/run-scenario.sh 42        # full scenario with logging"
echo "  overthink run pr-reviewer --instance bob-ai --inputs '{\"PR_NUMBER\":\"42\"}'"
echo ""
echo "  # Check results"
echo "  overthink show @last --instance bob-ai"
echo "  overthink status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
