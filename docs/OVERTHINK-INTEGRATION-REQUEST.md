# Overthink Integration Request

> Copy-paste the prompt below to the dev agent working on overthink_rust.

---

## Prompt for Dev Agent

```
I need you to integrate overthink_rust as the automated PR reviewer for the bob-ai project.

## Context

bob-ai is at /Users/Roberto/Documents/Work/bob-ai/
overthink_rust is at /Users/Roberto/Documents/Work/Cline.bot/overthink_rust/

bob-ai already has:
- A PR review script: scripts/review-pr.sh (uses gh CLI to analyze PRs)
- A TaskSpec template: scripts/task-specs/pr-reviewer.v1.json
- A GitHub Action: .github/workflows/agent-review.yml
- Full documentation in docs/AGENT-WORKTREE-GUIDE.md

## What I Need

1. **Register the bob-ai PR reviewer as an overthink TaskSpec**
   - Use the existing TaskSpec at bob-ai/scripts/task-specs/pr-reviewer.v1.json as reference
   - The entrypoint should invoke bob-ai/scripts/review-pr.sh
   - Inputs: PR_NUMBER (required), REPO (required), BASE_REF (optional, defaults to main)
   - Timeout: 5 minutes, Budget: $2, Retries: 2

2. **Create an overthink scenario for PR review**
   - Similar to the repo-steward scenario but for code review
   - Should be triggerable with: overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42
   - The scenario should:
     a. Fetch the PR diff via gh CLI
     b. Check PR size (block >600 lines)
     c. Validate conventional commits
     d. Scan for console.log, secrets, TODO/FIXME, `: any` types
     e. Post results as a PR comment via gh pr comment
     f. Save review locally to reviews/ directory

3. **Set up overthink instance for bob-ai**
   - Initialize: overthink init --here --instance bob-ai (in the bob-ai repo root)
   - Attach local queue: overthink queue attach --local --instance bob-ai
   - Install the pr-reviewer TaskSpec into the instance

4. **Wire up local webhook trigger (optional)**
   - When a GitHub webhook fires on PR creation, it should trigger the overthink task
   - Can be a simple Express/Bun server that listens for GitHub webhooks and calls overthink
   - Or: a periodic poll that checks for new/updated PRs and runs the review

5. **Document how to use it**
   - How to run manually: overthink run pr-reviewer --instance bob-ai --inputs '{"PR_NUMBER":"42"}'
   - How it auto-triggers via GitHub Actions
   - How to check results: overthink show @last --instance bob-ai

## Important Notes

- The review script (scripts/review-pr.sh) already works standalone — test with: bash scripts/review-pr.sh <pr-number>
- All git commands must be non-interactive (no pagers). Use --no-pager flag or GIT_PAGER=cat
- The gh CLI must be authenticated (gh auth status)
- Keep the overthink integration in bob-ai's scripts/ directory, not in overthink_rust itself
- Use war nicknames for agent identity — this agent's callsign is Sentinel (Code Review)
```

---

## What Already Exists

| File | Purpose |
|------|---------|
| `scripts/review-pr.sh` | Standalone PR review script (works now) |
| `scripts/task-specs/pr-reviewer.v1.json` | Overthink TaskSpec definition |
| `.github/workflows/agent-review.yml` | GitHub Action that runs review on PR events |
| `.github/PULL_REQUEST_TEMPLATE/agent.md` | Agent PR template with callsign format |

## Expected Outcome

After integration, the workflow is:

```
Agent creates PR → GitHub Action triggers → review-pr.sh runs → 
  Posts review comment on PR → Saves locally to reviews/

OR (local):

overthink scenario run pr-review --instance bob-ai --env PR_NUMBER=42 →
  TaskSpec executes review-pr.sh → Results stored in overthink artifacts
```
