# Jules Dispatch CLI — Design Spec
**Date:** 2026-03-28
**Status:** Approved
**Owner:** AVANT-ICONIC

---

## Overview

`jules-dispatch` is a TypeScript/Bun CLI that gives AI agents (Claude Code, Codex, Gemini CLI, etc.) and humans full control over Google Jules without ever touching the Jules web UI.

Jules only operates on GitHub repositories and always produces a Pull Request as output. This CLI wraps the Jules REST API and the `gh` CLI to manage the full lifecycle: dispatch jobs, monitor sessions, answer Jules' questions, approve plans, and handle PRs.

The CLI is agent-first: every command supports `--json` for machine-readable output, uses exit codes correctly, and produces minimal noise. It is also designed as an open-source tool usable by anyone with a Jules API key and a connected GitHub account.

---

## Architecture

```
jules-dispatch/
├── .env                          # Local secrets — git-ignored
├── .env.example                  # Safe placeholder — committed
├── .gitignore
├── LICENSE                       # MIT
├── README.md                     # Human setup + usage guide
├── AGENTS.md                     # Agent integration contract
├── package.json                  # bin: jules
├── tsconfig.json
└── src/
    ├── index.ts                  # CLI entry point, command routing
    ├── client.ts                 # Jules REST API client (typed)
    ├── github.ts                 # gh CLI wrapper for PR operations
    ├── config.ts                 # .env loading and validation
    ├── output.ts                 # --json vs human-readable formatting
    ├── types.ts                  # Jules API response types (typed)
    └── commands/
        ├── sources.ts            # jules sources list
        ├── sessions.ts           # jules sessions list/get/create/reply/approve/activities
        └── prs.ts                # jules prs list/view/merge/comment
```

---

## Real API Shape (discovered from live API)

### Sessions

Session object fields: `name`, `title`, `createTime`, `updateTime`, `state`, `sourceContext`, `prompt`, `url`, `id`, `outputs?`

**States observed:** `COMPLETED`, `IN_PROGRESS`
**States expected (from docs):** `WAITING_FOR_INPUT`, `PLAN_READY`, `FAILED`

**Outputs** (present on completed sessions, contains both):
```json
[
  { "changeSet": { "source": "...", "gitPatch": { "unidiffPatch": "...", "baseCommitId": "...", "suggestedCommitMessage": "..." } } },
  { "pullRequest": { "url": "...", "title": "...", "description": "...", "baseRef": "main", "headRef": "branch-name" } }
]
```

**Session create payload:** FLAT object — do NOT wrap in `{ "session": { ... } }`. The wrapped form returns `400 INVALID_ARGUMENT`. Confirmed against live API 2026-03-28.

### Activities

Activities use a **discriminated union** — no `type` field. Identify by which key is present:
- `agentMessaged` → Jules is speaking (may be asking a question)
- `userMessaged` → a user/agent replied

### Schedules / Cron

The `/v1alpha/scheduledSessions` endpoint returns 404 — cron is web UI only as of 2026-03-28. The CLI stubs `jules schedules` with a clear "not yet supported by Jules API" message, ready for future implementation.

---

## Command Surface

### Sources
```bash
jules sources list [--json]
```
Lists all Jules-connected GitHub repositories. Agents should call this once per session and cache the result.

### Sessions
```bash
jules sessions list [--repo owner/repo] [--state IN_PROGRESS|COMPLETED|ALL] [--json]
jules sessions get <session-id> [--json]
jules sessions create --repo owner/repo --prompt "..." [--branch main] [--title "..."] [--approve-plan] [--json]
jules sessions reply <session-id> "message" [--json]
jules sessions approve <session-id> [--json]
jules sessions activities <session-id> [--limit 20] [--json]
```

`--approve-plan` causes Jules to pause after generating a plan and wait for `sessions approve` before executing. Without it, Jules executes immediately (instant mode).

### PRs
```bash
jules prs list [--repo owner/repo] [--json]
jules prs view <pr-number> --repo owner/repo [--json]
jules prs merge <pr-number> --repo owner/repo [--json]
jules prs comment <pr-number> --repo owner/repo "message" [--json]
```

PR commands use two sources of truth:
- `prs list`: queries `jules sessions list --state COMPLETED` and extracts `outputs[].pullRequest` entries, then enriches with `gh pr view` for live PR state (open/merged/closed)
- `prs view / merge / comment`: delegate directly to `gh pr` using the PR number and repo — no Jules API call needed

This avoids relying on branch naming patterns (which could change) and gives accurate, live PR status.

### Schedules (stub)
```bash
jules schedules
# Output: "Scheduled sessions are not yet exposed by the Jules API. Use the Jules web UI for now."
```

---

## Output Modes

**`--json` flag (agent mode):**
- Raw JSON to stdout
- Errors as `{ "error": "...", "code": N }` to stderr
- Exit 0 on success, non-zero on failure
- No extra text, no spinners

**Default (human mode):**
- Formatted, readable output
- Status indicators
- Timestamps in local time

---

## Config

Loaded from `.env` (auto-detected, no flags needed):
```
JULES_API_KEY=...       # Required
GITHUB_USERNAME=...     # Required (scopes repo lookups)
```

All API calls include: `X-Goog-Api-Key: $JULES_API_KEY`
Base URL: `https://jules.googleapis.com/v1alpha`

---

## AGENTS.md Contract

The `AGENTS.md` file documents the exact workflow for any AI agent to follow:

1. **Setup check:** `jules sources list --json` — if repos returned, ready to go
2. **Dispatch:** `jules sessions create --repo owner/repo --prompt "detailed task" --json` → save `id`
3. **Monitor:** poll `jules sessions get <id> --json`, check `state` field
   - `IN_PROGRESS` → wait, poll again later
   - `WAITING_FOR_INPUT` → read `jules sessions activities <id> --json`, reply with `jules sessions reply <id> "answer" --json`
   - `PLAN_READY` → review plan via `jules sessions activities <id> --json`, then `jules sessions approve <id> --json`
   - `COMPLETED` → check `outputs` for PR URL
   - `FAILED` → report to user
4. **Handle PR:** `jules prs list --repo owner/repo --json` → `jules prs view <pr> --repo owner/repo --json` → merge or comment
5. **Token efficiency rules:** always `--json`, don't poll faster than 30s intervals, cache `sources list`

---

## Test Plan

End-to-end verification before shipping:

1. Create private test repo `AVANT-ICONIC/jules-dispatch-test` via `gh repo create`
2. Push a minimal TypeScript file with a deliberate TODO comment
3. Run `jules sessions create --repo AVANT-ICONIC/jules-dispatch-test --prompt "..." --approve-plan --json`
4. Poll `jules sessions get` until `PLAN_READY`
5. Inspect plan via `jules sessions activities`
6. Run `jules sessions approve` — Jules executes
7. Poll until `COMPLETED`, inspect `outputs` for PR
8. Run `jules prs view` to verify diff
9. Run `jules prs merge` to close the loop

This verifies: auth, session create, plan approval flow, activity reading, output parsing, and PR merge — the full agent workflow.

---

## Open Source Considerations

- No secrets committed (`.env` in `.gitignore`, `.env.example` with placeholders)
- MIT License
- `README.md` covers: prerequisites, installation, setup, all commands
- `AGENTS.md` is the primary integration doc for agent users
- Zero hardcoded values — all config via environment
- `gh` CLI is a peer dependency (documented in README)
- Bun is required; `bun build --compile` produces a portable single binary for distribution

---

## Out of Scope

- TUI / interactive dashboard (agent-first tool, not human-first)
- Cron/scheduled sessions (Jules API doesn't expose this yet)
- Multi-account / multi-key support (single `.env` config)
- Webhook/event-driven polling (agent handles polling manually)
