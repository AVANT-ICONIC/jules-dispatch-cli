# Agent Guide

This guide is for AI agents - Claude Code, Codex, Gemini, or any orchestration script - that want to use `jules-dispatch` to delegate coding tasks to Google Jules without human intervention.

---

## Core Principles

1. **Always use `--json` for workflow commands** - human-readable output contains formatting noise that is expensive to parse. JSON output is clean, typed, and stable.

2. **Never poll faster than 30 seconds** - Jules is an async agent. It runs in the cloud and typically takes 2–10 minutes per job. Polling faster does not speed it up and wastes tokens reading identical state.

3. **Jules is async** - `sessions create` returns immediately. The session starts `IN_PROGRESS`. You must poll `sessions get` to track progress.

4. **Save the session ID** - it is the primary key for all subsequent operations. Extract it from the `sessions create` JSON response: `.name` contains `sessions/SESS_ID`; many commands also expose `.id` directly.

---

## The Full Workflow

```
┌──────────────────────────────────────────────────────┐
│ 1. sources list --json                               │
│    → pick a repo name, e.g. "acme-org/backend"       │
└──────────────────────────────┬───────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────┐
│ 2. sessions create --repo … --prompt "…" --json      │
│    → save session ID from response                   │
└──────────────────────────────┬───────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────┐
│ 3. POLL: sessions get SESSION_ID --json              │
│    every 30s                                         │
│    → read .session.state                             │
└──────────┬────────┬──────────┬────────────┬──────────┘
           │        │          │            │
     IN_PROGRESS  AWAITING_   AWAITING_  COMPLETED / FAILED
     (wait)       PLAN_       USER_      (see step 4)
                  APPROVAL    FEEDBACK
                  (approve)   (message)
┌──────────────────────────────▼───────────────────────┐
│ 4. COMPLETED:                                        │
│    → read .session.outputs[].pullRequest.url         │
│    → prs view PR_NUMBER --repo … --json              │
│    → prs merge PR_NUMBER --repo … --json             │
│                                                      │
│    FAILED:                                           │
│    → sessions activities SESSION_ID --json           │
│    → report to user / retry with revised prompt      │
└──────────────────────────────────────────────────────┘
```

---

## State Machine

| State | Meaning | What to Do |
|---|---|---|
| `QUEUED` | Jules accepted the work | Wait 30s, poll again |
| `IN_PROGRESS` | Jules is actively working | Wait 30s, poll again |
| `AWAITING_PLAN_APPROVAL` | Jules has generated a plan and is waiting for approval | Read activities, then call `sessions approve` |
| `AWAITING_USER_FEEDBACK` | Jules has a question and cannot proceed | Read activities, then call `sessions message` |
| `PAUSED` | Jules has paused work | Read activities and determine the required action |
| `COMPLETED` | Jules finished successfully | Read `session.outputs` for PR URL, then review/merge |
| `FAILED` | Jules encountered an error it could not recover from | Read activities for the error message; consider retrying with a more specific prompt |

Plan approval sessions use `AWAITING_PLAN_APPROVAL`. A session needing additional instructions uses `AWAITING_USER_FEEDBACK`.

---

## Token Efficiency Tips

### Cache `sources list`

The list of connected repos changes rarely. Call it once per agent session and store the result. Do not call it before every `sessions create`.

```bash
# Run once, save result
SOURCES=$(bun run src/index.ts sources list --json)
```

### Get the PR URL from `sessions get`, not `prs list`

When a session completes, `sessions get SESSION_ID --json` already contains the PR URL in `.session.outputs`:

```json
{
  "session": {
    "outputs": [
      {
        "pullRequest": {
          "url": "https://github.com/acme-org/backend/pull/42"
        }
      }
    ]
  }
}
```

Extract it directly:

```bash
PR_URL=$(bun run src/index.ts sessions get "$SESSION" --json | \
  jq -r '.session.outputs[]? | select(.pullRequest) | .pullRequest.url')
```

Only call `prs list` if you need to find PRs from sessions you did not create in the current run.

### Limit activities

The `--limit` flag on `sessions activities` keeps responses small. The default is 20. If you only want to read Jules's last message, use `--limit 5`.

```bash
bun run src/index.ts sessions activities "$SESSION" --limit 5 --json
```

Use `--create-time ISO_TIMESTAMP` to fetch newer activity records through the
Jules `create_time` filter when polling an active session.

### Use `sessions list --state` to triage

Before diving into individual sessions, get an overview of what is active:

```bash
bun run src/index.ts sessions list --state IN_PROGRESS --json
bun run src/index.ts sessions list --state AWAITING_USER_FEEDBACK --json
```

This is more efficient than calling `sessions get` on every session ID you know about.

---

## Error Handling

### JSON error format

When a command fails with `--json`, it writes a JSON object to stderr and exits with code `1`:

```json
{
  "error": "Session not found",
  "code": "NOT_FOUND"
}
```

Always capture stderr separately when using `--json`. In bash:

```bash
RESULT=$(bun run src/index.ts sessions get "$SESSION" --json 2>/tmp/jules_err)
EXIT=$?
if [ $EXIT -ne 0 ]; then
  ERROR=$(cat /tmp/jules_err)
  echo "Error: $ERROR"
fi
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error - check stderr for JSON error object |

### What to do when `FAILED`

1. Read the full activity log to understand what went wrong:
   ```bash
   bun run src/index.ts sessions activities "$SESSION" --json
   ```
2. Look for the last `agentMessaged` entry - it usually describes the failure.
3. Common causes:
   - Prompt was too vague - Jules could not determine what to change
   - The repo has a CI requirement that Jules's change did not satisfy
   - Jules hit a merge conflict on the target branch
   - The GitHub App lacks write access to the repo
4. Create a new session with a revised, more specific prompt. Sessions cannot be restarted.

---

## Example Agent Script

The following bash script dispatches a job to Jules and polls until it completes
or requires operator action, then reports the available outcome.

```bash
#!/usr/bin/env bash
# Usage: ./dispatch.sh OWNER/REPO "Your task description"
set -euo pipefail

REPO="$1"
PROMPT="$2"

SESSION=$(bun run src/index.ts sessions create \
  --repo "$REPO" \
  --prompt "$PROMPT" \
  --json | jq -r '.name | split("/") | last')

echo "Session $SESSION created. Polling every 30s..."

while true; do
  sleep 30

  RESPONSE=$(bun run src/index.ts sessions get "$SESSION" --json)
  STATE=$(echo "$RESPONSE" | jq -r '.session.state')
  echo "State: $STATE"

  case "$STATE" in
    COMPLETED)
      PR=$(echo "$RESPONSE" | \
        jq -r '.session.outputs[]? | select(.pullRequest) | .pullRequest.url')
      echo "Done! PR: $PR"
      break
      ;;
    FAILED)
      echo "Jules failed."
      echo "Check activities: bun run src/index.ts sessions activities $SESSION"
      exit 1
      ;;
    AWAITING_USER_FEEDBACK)
      echo "Jules needs input. Showing recent activities:"
      bun run src/index.ts sessions activities "$SESSION" --limit 5
      echo ""
      echo "Reply with: bun run src/index.ts sessions message $SESSION \"your answer\""
      exit 2
      ;;
    AWAITING_PLAN_APPROVAL)
      echo "Plan ready. Approving automatically..."
      bun run src/index.ts sessions approve "$SESSION" --json
      ;;
    PAUSED)
      echo "Session paused. Review activities before continuing:"
      bun run src/index.ts sessions activities "$SESSION" --limit 5
      exit 2
      ;;
    QUEUED|IN_PROGRESS)
      # Normal - keep polling
      ;;
    *)
      echo "Unknown state: $STATE"
      ;;
  esac
done
```

**Exit codes from this script:**

- `0` - completed successfully, PR URL printed
- `1` - Jules failed
- `2` - Jules needs an approval, feedback, or a resume decision

---

## Notes for Specific Agents

### Claude Code

Use `bun run src/index.ts` directly in Bash tool calls. Parse JSON with `jq`. Store session IDs in bash variables within the same Bash call chain - do not rely on state persisting across Bash tool calls.

### Codex / GPT agents

Same approach. All commands are synchronous from the shell's perspective - they return immediately with JSON. Async behavior is Jules's; your agent just polls.

### CI/CD pipelines

In GitHub Actions or similar, set `JULES_API_KEY` as a repository secret and expose it as an environment variable. The CLI reads it from the environment (no `.env` file needed if the variable is already exported).
