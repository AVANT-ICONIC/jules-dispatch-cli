# AGENTS.md - Jules Dispatch CLI Integration Guide

This document tells AI agents (Claude Code, Codex, Gemini, etc.) exactly how to use
the `jules` CLI to manage Google Jules without human intervention.

## Prerequisites

Run this check at the start of every session:

```bash
bun run src/index.ts sources list --json
```

If you get a non-empty array, you are authenticated and ready. If you get an error,
the `.env` file is missing or the API key is invalid - stop and report to the user.

## Dispatching a Job (Repo Mode)

Jules will execute immediately and open a PR when done:

```bash
bun run src/index.ts sessions create \
  --repo OWNER/REPO \
  --prompt "Detailed description of the task. Include: goal, files to touch, constraints, how to verify correctness." \
  --title "Short descriptive title" \
  --json
```

Save the `id` field from the JSON response. You will need it to monitor progress.

### Dispatching a Repoless Job

Omit `--repo` to spawn a serverless cloud dev environment with no source repo.
Jules provides Node, Python, Rust, and Bun preloaded. Useful for prototypes,
scripts, and experiments:

```bash
bun run src/index.ts sessions create \
  --prompt "Create a Python script that validates IPv6 addresses" \
  --title "IPv6 validator" \
  --json
```

### Auto-Creating PRs

Use `--automation-mode AUTO_CREATE_PR` to have Jules automatically open a PR
when the session completes (skip manual review):

```bash
bun run src/index.ts sessions create \
  --repo OWNER/REPO \
  --prompt "..." \
  --automation-mode AUTO_CREATE_PR \
  --json
```

### Enabling Environment Variables

Pass `--env-vars` to make your repository's environment variables available to Jules:

```bash
bun run src/index.ts sessions create \
  --repo OWNER/REPO \
  --prompt "..." \
  --env-vars \
  --json
```

## Dispatching a Job (Plan Review Mode)

Jules will generate a plan and wait for your approval before executing:

```bash
bun run src/index.ts sessions create \
  --repo OWNER/REPO \
  --prompt "..." \
  --approve-plan \
  --json
```

## Monitoring a Session

Poll every 30+ seconds (do not poll faster - Jules is async):

```bash
bun run src/index.ts sessions get SESSION_ID --json
```

Check the `session.state` field:

| State | Meaning | Action |
|-------|---------|--------|
| `IN_PROGRESS` | Jules is working | Wait and poll again |
| `WAITING_FOR_INPUT` | Jules has a question | Read activities, reply |
| `PLAN_READY` | Jules generated a plan | Review and approve |
| `COMPLETED` | Jules finished | Check outputs for PR |
| `FAILED` | Jules failed | Report to user |

## Reading Jules's Messages

When state is `WAITING_FOR_INPUT` or `PLAN_READY`:

```bash
bun run src/index.ts sessions activities SESSION_ID --json
```

Activities use a discriminated union — check which key is present:

| Key | Sender | Description |
|-----|--------|-------------|
| `planGenerated` | Jules | Plan with steps was generated |
| `planApproved` | User | Plan was approved |
| `progressUpdated` | Jules | Step progress update (title, description) |
| `agentMessaged` | Jules | Jules sent a message |
| `userMessaged` | User/Agent | A reply was sent |

### Incremental Polling

Use `--create-time` to only fetch activities since your last poll (avoids re-processing):

```bash
LAST_TIME="2026-01-17T00:03:53.137240Z"
bun run src/index.ts sessions activities SESSION_ID --create-time "$LAST_TIME" --json
```

## Replying to Jules

Prefer the official `message` command (uses `:sendMessage` endpoint):

```bash
bun run src/index.ts sessions message SESSION_ID "Your prompt or answer here" --json
```

Legacy `reply` is still available for backwards compatibility:

```bash
bun run src/index.ts sessions reply SESSION_ID "Your answer here" --json
```

## Approving a Plan

```bash
bun run src/index.ts sessions approve SESSION_ID --json
```

## Handling the PR

When session state is `COMPLETED`:

```bash
# Find the PR from session outputs
bun run src/index.ts sessions get SESSION_ID --json
# Look at: session.outputs[].pullRequest.url

# Or list all Jules PRs for a repo
bun run src/index.ts prs list --repo OWNER/REPO --json

# View the diff and description
bun run src/index.ts prs view PR_NUMBER --repo OWNER/REPO --json

# Merge if satisfied
bun run src/index.ts prs merge PR_NUMBER --repo OWNER/REPO --json

# Or leave feedback
bun run src/index.ts prs comment PR_NUMBER --repo OWNER/REPO "Feedback here" --json
```

## Token Efficiency Rules

1. Always use `--json` - no human-readable noise
2. Never poll faster than 30 second intervals
3. Run `sources list` once per session - cache the result
4. Use `sessions list --state IN_PROGRESS --json` to get an overview before diving into individual sessions
5. Read `session.outputs` from `sessions get` before calling `prs list` - the PR URL is already there
6. Use `--create-time` with incremental polling to avoid re-fetching old activities

## Exit Codes

- `0` - success
- `1` - error (see stderr for JSON error object when using `--json`)
