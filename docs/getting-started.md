# Getting Started

This guide walks you through installing `jules-dispatch`, connecting it to your Jules account, and dispatching your first job.

---

## Prerequisites

Before you begin, make sure you have the following:

| Requirement | Notes |
|---|---|
| **Bun v1.x** | Install from [bun.sh](https://bun.sh) |
| **gh CLI** | Install from [cli.github.com](https://cli.github.com) and run `gh auth login` |
| **Jules account** | Sign up at [jules.google.com](https://jules.google.com) |
| **Jules GitHub App** | Install it on the repos you want Jules to work on (Settings > Integrations inside Jules) |
| **Jules API key** | Generate one at jules.google.com > Settings > API Keys |

---

## Installation

Clone the repo, install dependencies, and configure your environment:

```bash
git clone https://github.com/AVANT-ICONIC/jules-dispatch
cd jules-dispatch
bun install
cp .env.example .env
```

Open `.env` and fill in your credentials:

```bash
JULES_API_KEY=your_jules_api_key_here
GITHUB_USERNAME=your_github_username
```

---

## Verify Setup

Run the following to confirm everything is wired up correctly:

```bash
bun run src/index.ts sources list
```

Expected output — your connected repositories:

```
Connected sources (2)

  github/acme-org/backend
  github/acme-org/frontend
```

If you see an error instead, check that:
- Your `JULES_API_KEY` in `.env` is valid and not expired
- The Jules GitHub App is installed on at least one of your repos
- Your `gh` CLI is authenticated (`gh auth status`)

---

## Build a Portable Binary (Optional)

If you want to run `jules` as a standalone command without `bun run src/index.ts`:

```bash
bun run build
```

This produces `dist/jules`. You can move it anywhere on your `$PATH`:

```bash
sudo mv dist/jules /usr/local/bin/jules
```

Then all commands become:

```bash
jules sources list
jules sessions list
```

The rest of this documentation uses `bun run src/index.ts` for clarity, but the binary form works identically.

---

## Your First Dispatch

Here is a complete walkthrough from zero to merged PR.

### Step 1: Pick a repo

```bash
bun run src/index.ts sources list
```

Note the repo you want to target, e.g. `acme-org/backend`.

### Step 2: Create a session

Dispatch a job to Jules with a clear, specific prompt:

```bash
bun run src/index.ts sessions create \
  --repo acme-org/backend \
  --prompt "Add input validation to the POST /users endpoint. The email field should be validated as a proper email address and the username field should reject special characters. Return 400 with a descriptive error message on invalid input." \
  --title "Add input validation to POST /users"
```

Jules will respond with a session ID:

```
Session created

  ID:     sess_abc123def456
  State:  IN_PROGRESS
  Repo:   acme-org/backend
  Title:  Add input validation to POST /users
```

Save that session ID.

### Step 3: Monitor progress

Jules works asynchronously — jobs typically take 2–10 minutes. Poll with:

```bash
bun run src/index.ts sessions get sess_abc123def456
```

You will see the current state and recent activity. Wait until state is `COMPLETED`.

Do not poll faster than every 30 seconds — Jules is async and polling faster does not speed things up.

### Step 4: Find the PR

When the session completes:

```bash
bun run src/index.ts sessions get sess_abc123def456
```

The output will include a `Outputs` section with a PR URL. You can also list PRs directly:

```bash
bun run src/index.ts prs list --repo acme-org/backend
```

### Step 5: Review and merge

View the PR:

```bash
bun run src/index.ts prs view 42 --repo acme-org/backend
```

If it looks good:

```bash
bun run src/index.ts prs merge 42 --repo acme-org/backend
```

If you want Jules to revise it, leave a comment:

```bash
bun run src/index.ts prs comment 42 --repo acme-org/backend "Please also add a test for the validation logic."
```

---

## What's Next

- [Command Reference](./command-reference.md) — every flag for every command
- [Agent Guide](./agent-guide.md) — integrate `jules-dispatch` into your AI agent workflows
- [Jules API Notes](./jules-api-notes.md) — raw API behavior for contributors and power users
