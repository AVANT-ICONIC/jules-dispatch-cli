# Command Reference

All commands follow this pattern:

```
bun run src/index.ts <group> <subcommand> [options]
```

API and PR workflow commands accept `--json` to output machine-readable JSON with no human-readable formatting. Use this in scripts and agent workflows.

---

## setup

| Command | Description |
|---|---|
| `init` | Interactive API-key setup that validates access by listing sources |
| `config list` | Show whether a default credential is configured |
| `config validate` | Validate the credential with a read-only Jules API request |
| `config env <profile>` | Display profile configuration with secrets redacted |
| `profile list` | List available default and named profiles |
| `profile create <name>` | Create a named profile template |
| `profile show <name>` | Show a named profile with secrets redacted |
| `profile delete <name>` | Delete a named profile |

Use a named credential with `jules --profile <name> <command>`.

---

## sources

### `sources list`

Lists all GitHub repositories connected to your Jules account via the Jules GitHub App.

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts sources list
```

```
acme-org/backend  [public]  default: main
acme-org/frontend  [private]  default: main
my-username/side-project  [public]  default: main
```

**JSON output example:**

```bash
bun run src/index.ts sources list --json
```

```json
[
  { "name": "sources/github/acme-org/backend" },
  { "name": "sources/github/acme-org/frontend" },
  { "name": "sources/github/my-username/side-project" }
]
```

---

## sessions

### `sessions list`

Lists Jules sessions, optionally filtered by repository and/or state.

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | Filter to sessions for this repository |
| `--state STATE` | `ALL` | Filter by current state, including `QUEUED`, `AWAITING_PLAN_APPROVAL`, `AWAITING_USER_FEEDBACK`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `FAILED`, or `ALL` |
| `--archived SCOPE` | `active` | Select `active`, `archived`, or `all` sessions |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts sessions list --repo acme-org/backend --state IN_PROGRESS
```

```
IN_PROGRESS  sess_abc123  sources/github/acme-org/backend  Add input validation to POST /users
```

**JSON output example:**

```bash
bun run src/index.ts sessions list --state IN_PROGRESS --json
```

```json
[
  {
    "name": "sessions/sess_abc123def456",
    "state": "IN_PROGRESS",
    "title": "Add input validation to POST /users",
    "createTime": "2026-03-28T10:15:00Z",
    "updateTime": "2026-03-28T10:17:30Z"
  }
]
```

---

### `sessions get`

Gets the full details of a single session, including its current state and the last 10 activities.

**Arguments:**

| Argument | Description |
|---|---|
| `<session-id>` | The session ID (e.g. `sess_abc123def456`) |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts sessions get sess_abc123def456
```

```
ID:      sess_abc123def456
Title:   Add input validation to POST /users
State:   COMPLETED
Repo:    sources/github/acme-org/backend
Created: 2026-03-28T10:15:00Z
Updated: 2026-03-28T10:23:45Z
URL:     https://jules.google.com/sessions/sess_abc123def456

--- Outputs ---
Pull Request: https://github.com/acme-org/backend/pull/42

--- Recent Activities ---
[10:22 AM] Jules messaged: "Done! Pull request is ready for review."
```

**JSON output example:**

```bash
bun run src/index.ts sessions get sess_abc123def456 --json
```

```json
{
  "session": {
    "name": "sessions/sess_abc123def456",
    "state": "COMPLETED",
    "title": "Add input validation to POST /users",
    "createTime": "2026-03-28T10:15:00Z",
    "updateTime": "2026-03-28T10:23:45Z",
    "outputs": [
      {
        "pullRequest": {
          "url": "https://github.com/acme-org/backend/pull/42"
        }
      }
    ]
  },
  "activities": [
    {
      "agentMessaged": {
        "agentMessage": "I've added email validation using a regex and username validation that rejects special characters. Tests are included."
      },
      "createTime": "2026-03-28T10:22:10Z"
    }
  ]
}
```

---

### `sessions create`

Creates a new Jules session and dispatches a job.

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | Target repository. **Omit for repoless sessions** — spawns a serverless cloud dev environment |
| `--prompt "..."` | - | **Required.** The task description for Jules |
| `--branch BRANCH` | `main` | The branch Jules should start from (ignored in repoless mode) |
| `--title "..."` | - | Optional short title for the session |
| `--automation-mode AUTO_CREATE_PR` | - | Auto-create a PR when the session completes |
| `--approve-plan` | false | Require plan approval before Jules executes (see below) |
| `--env-vars` | false | Make repository environment variables available to Jules |
| `--json` | false | Output raw JSON |

**Execution modes:**

- **Instant mode** (default, no `--approve-plan`): Jules reads your prompt, generates a plan internally, and immediately begins executing. You skip the review step. Use this when you trust Jules to make straightforward changes.

- **Plan review mode** (`--approve-plan`): Jules pauses after generating a plan and waits for you to call `sessions approve`. The session enters `AWAITING_PLAN_APPROVAL` state. Use this when you want to verify Jules's approach before it touches any code.

**Human output example (instant mode):**

```bash
bun run src/index.ts sessions create \
  --repo acme-org/backend \
  --prompt "Add input validation to the POST /users endpoint" \
  --title "Add input validation"
```

```
Session created:

  ID:    sess_abc123def456
  State: IN_PROGRESS
  Repo:  acme-org/backend
  Title: Add input validation
  URL:   https://jules.google.com/sessions/sess_abc123def456
```

**Repoless example (no --repo):**

```bash
bun run src/index.ts sessions create \
  --prompt "Create a Python script that validates IPv6 addresses" \
  --title "IPv6 validator"
```

```
Session created:

  ID:    sess_repoless_abc
  State: IN_PROGRESS
  Repo:  (repoless)
  Title: IPv6 validator
  URL:   https://jules.google.com/sessions/sess_repoless_abc
```

**Human output example (plan review mode):**

```bash
bun run src/index.ts sessions create \
  --repo acme-org/backend \
  --prompt "Refactor the auth middleware to use JWT RS256 instead of HS256" \
  --approve-plan
```

```
Session created:

  ID:    sess_xyz789ghi012
  State: IN_PROGRESS
  Repo:  acme-org/backend
  Title: (no title)
  URL:   https://jules.google.com/sessions/sess_xyz789ghi012

  Note: Plan approval required. Jules will pause at AWAITING_PLAN_APPROVAL state.
        Run: bun run src/index.ts sessions approve sess_xyz789ghi012
```

**JSON output example:**

```bash
bun run src/index.ts sessions create \
  --repo acme-org/backend \
  --prompt "Fix typo in README" \
  --json
```

```json
{
  "id": "sess_abc123def456",
  "state": "IN_PROGRESS",
  "url": "https://jules.google.com/sessions/sess_abc123def456"
}
```

---

### `sessions message`

Sends a message to Jules using the official `:sendMessage` API endpoint. **Preferred over `reply` for new integrations.**

**Arguments:**

| Argument | Description |
|---|---|
| `<session-id>` | The session ID |
| `<prompt>` | Your message or follow-up prompt to Jules |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts sessions message sess_abc123def456 "Please use the dark theme."
```

```
Message sent to session sess_abc123def456.
```

**JSON output example:**

```bash
bun run src/index.ts sessions message sess_abc123def456 "Please use the dark theme." --json
```

```json
{
  "ok": true,
  "sessionId": "sess_abc123def456"
}
```

---

### `sessions reply`

Alias for `sessions message`. Both commands use the official `:sendMessage`
endpoint; use `message` in new scripts for clarity.



**Arguments:**

| Argument | Description |
|---|---|
| `<session-id>` | The session ID |
| `<message>` | Your reply to Jules |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--json` | false | Output raw JSON |

**When to use:** Jules asks a clarifying question mid-task. Run `sessions activities` to read what Jules said, then use `sessions reply` to respond.

**Human output example:**

```bash
bun run src/index.ts sessions reply sess_abc123def456 "Use the existing UserValidator class in src/validators/user.ts"
```

```
Reply sent. Jules is back in progress.
```

**JSON output example:**

```bash
bun run src/index.ts sessions reply sess_abc123def456 "Use the existing validator" --json
```

```json

{
  "ok": true,
  "sessionId": "sess_abc123def456"
}
```

---

### `sessions approve`

Approves Jules's plan when the session is in `AWAITING_PLAN_APPROVAL` state. Jules will then begin execution.

**Arguments:**

| Argument | Description |
|---|---|
| `<session-id>` | The session ID |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--json` | false | Output raw JSON |

**When to use:** Only valid when you created the session with `--approve-plan` and the session is currently in `AWAITING_PLAN_APPROVAL` state. Run `sessions activities` first to read Jules's proposed plan.

**Human output example:**

```bash
bun run src/index.ts sessions approve sess_xyz789ghi012
```

```
Plan approved. Jules is now executing.

  Session: sess_xyz789ghi012
  State:   IN_PROGRESS
```

**JSON output example:**

```bash
bun run src/index.ts sessions approve sess_xyz789ghi012 --json
```

```json
{
  "ok": true,
  "sessionId": "sess_xyz789ghi012"
}
```

---

### `sessions activities`

Lists the activity log for a session - Jules's messages, your replies, and system events.

**Arguments:**

| Argument | Description |
|---|---|
| `<session-id>` | The session ID |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--limit N` | `20` | Maximum number of activities to return |
| `--create-time ISO_TIMESTAMP` | - | Return activities newer than the timestamp |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts sessions activities sess_abc123def456 --limit 5
```

```
Activities for sess_abc123def456 (5)

  2026-03-28T10:15:30Z  [agent]  I've read the codebase and identified the relevant files.
  2026-03-28T10:16:10Z  [agent]  I have a question: should I add validation at the router level or in the controller?
  2026-03-28T10:18:00Z  [user]   Add it in the controller, not the router.
  2026-03-28T10:18:05Z  [agent]  Got it. Proceeding with controller-level validation.
  2026-03-28T10:22:10Z  [agent]  Done! Pull request is ready for review.
```

**JSON output example:**

```bash
bun run src/index.ts sessions activities sess_abc123def456 --json
```

```json
[
  {
    "agentMessaged": {
      "agentMessage": "I've read the codebase and identified the relevant files."
    },
    "createTime": "2026-03-28T10:15:30Z"
  },
  {
    "userMessaged": {
      "userMessage": "Add it in the controller, not the router."
    },
    "createTime": "2026-03-28T10:18:00Z"
  },
  {
    "agentMessaged": {
      "agentMessage": "Done! Pull request is ready for review."
    },
    "createTime": "2026-03-28T10:22:10Z"
  }
]
```

Activities use a discriminated union - check which key is present (`agentMessaged` vs `userMessaged`) to determine who sent the message.

---

### `sessions outputs`

Returns the output records for a session or writes its first available Git
patch to a file.

```bash
bun run src/index.ts sessions outputs SESSION_ID --json
bun run src/index.ts sessions outputs SESSION_ID --output changes.patch
```

### `sessions run`

Creates a session and polls until it reaches `COMPLETED`, `FAILED`, or a state
that requires action: `AWAITING_PLAN_APPROVAL`, `AWAITING_USER_FEEDBACK`, or
`PAUSED`.

```bash
bun run src/index.ts sessions run \
  --repo acme-org/backend \
  --prompt "Fix typo in README" \
  --json
```

Use `--poll-interval` and `--timeout` to control polling. With `--json`, the
returned object always includes the state so an agent can approve a plan, send
feedback, or inspect a paused session before continuing.

### `sessions archive`, `sessions unarchive`, `sessions delete`

Manage stored sessions using the Jules lifecycle endpoints:

```bash
bun run src/index.ts sessions archive SESSION_ID --json
bun run src/index.ts sessions unarchive SESSION_ID --json
bun run src/index.ts sessions delete SESSION_ID --json
```

`delete` permanently removes the specified session.

---

## prs

Pull request commands work via the `gh` CLI under the hood and are filtered to PRs that Jules created, by cross-referencing session outputs. They do not rely on branch name patterns.

### `prs list`

Lists Jules-created pull requests, optionally filtered to a specific repository.

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | Filter to PRs in this repository |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts prs list --repo acme-org/backend
```

```
Jules PRs in acme-org/backend (2)

  #42  open    Add input validation to POST /users
  #39  merged  Fix null pointer in UserService.findById
```

**JSON output example:**

```bash
bun run src/index.ts prs list --repo acme-org/backend --json
```

```json
[
  {
    "julesSessionId": "sess_abc123",
    "julesSessionTitle": "Add input validation to POST /users",
    "pr": {
      "url": "https://github.com/acme-org/backend/pull/42",
      "title": "Add input validation to POST /users",
      "description": "Added regex validation for email and username fields",
      "baseRef": "main",
      "headRef": "jules/add-input-validation"
    },
    "ghState": "open"
  }
]
```

---

### `prs view`

Shows the details, description, and file diff summary for a pull request.

**Arguments:**

| Argument | Description |
|---|---|
| `<pr-number>` | The pull request number |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | **Required.** The repository containing the PR |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts prs view 42 --repo acme-org/backend
```

```
PR #42 - Add input validation to POST /users

  State:    open
  Branch:   jules/add-input-validation
  URL:      https://github.com/acme-org/backend/pull/42
  Created:  2026-03-28T10:23:45Z

  This PR adds email and username validation to the POST /users endpoint.
  Invalid input returns HTTP 400 with a descriptive error message.

  Files changed (2):
    src/controllers/users.ts  (+34, -2)
    tests/controllers/users.test.ts  (+45, -0)
```

**JSON output example:**

```bash
bun run src/index.ts prs view 42 --repo acme-org/backend --json
```

```json
{
  "number": 42,
  "title": "Add input validation to POST /users",
  "state": "open",
  "url": "https://github.com/acme-org/backend/pull/42",
  "headRefName": "jules/add-input-validation",
  "body": "This PR adds email and username validation...",
  "createdAt": "2026-03-28T10:23:45Z",
  "files": [
    { "path": "src/controllers/users.ts", "additions": 34, "deletions": 2 },
    { "path": "tests/controllers/users.test.ts", "additions": 45, "deletions": 0 }
  ]
}
```

---

### `prs merge`

Merges a pull request using the `gh` CLI.

**Arguments:**

| Argument | Description |
|---|---|
| `<pr-number>` | The pull request number |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | **Required.** The repository containing the PR |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts prs merge 42 --repo acme-org/backend
```

```
Merged PR #42 into acme-org/backend

  Title:  Add input validation to POST /users
  URL:    https://github.com/acme-org/backend/pull/42
```

**JSON output example:**

```bash
bun run src/index.ts prs merge 42 --repo acme-org/backend --json
```

```json
{
  "ok": true,
  "number": 42,
  "state": "merged",
  "url": "https://github.com/acme-org/backend/pull/42"
}
```

---

### `prs comment`

Posts a comment on a pull request.

**Arguments:**

| Argument | Description |
|---|---|
| `<pr-number>` | The pull request number |
| `<message>` | The comment body |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--repo owner/repo` | - | **Required.** The repository containing the PR |
| `--json` | false | Output raw JSON |

**Human output example:**

```bash
bun run src/index.ts prs comment 42 --repo acme-org/backend "Please also add a test for the 400 response body shape."
```

```
Comment posted on PR #42

  https://github.com/acme-org/backend/pull/42#issuecomment-123456
```

**JSON output example:**

```bash
bun run src/index.ts prs comment 42 --repo acme-org/backend "LGTM" --json
```

```json
{
  "ok": true,
  "commentUrl": "https://github.com/acme-org/backend/pull/42#issuecomment-123456"
}
```

---

## schedules

Scheduled sessions are not yet supported by the Jules API. The `/v1alpha/scheduledSessions` endpoint returns 404.

To schedule recurring jobs, use your own cron or CI scheduler to call `sessions create` on a schedule.

Follow progress at [jules.google.com](https://jules.google.com) - scheduled session support will appear there when it is released.
