# jules-dispatch

> Agent-first CLI for Google Jules. Dispatch jobs, monitor sessions, and handle PRs — without touching the Jules web UI.

Built for AI agents (Claude Code, Codex, Gemini) and humans who want to control Jules from the terminal or scripts.

## Prerequisites

- [Bun](https://bun.sh) v1.x
- [gh CLI](https://cli.github.com) authenticated (`gh auth login`)
- [Jules](https://jules.google.com) account with GitHub App installed on your repos
- Jules API key (from jules.google.com > Settings > API Keys)

## Setup

```bash
git clone https://github.com/AVANT-ICONIC/jules-dispatch
cd jules-dispatch
bun install

cp .env.example .env
# Edit .env and add your JULES_API_KEY and GITHUB_USERNAME
```

## Usage

Run directly with Bun:

```bash
bun run dev sources list
```

Or build a single portable binary first (recommended):

```bash
bun run build        # produces dist/jules
./dist/jules sources list
```

Examples:

```bash
# List connected repos
jules sources list

# Dispatch a job to Jules
jules sessions create \
  --repo owner/repo \
  --prompt "Fix the bug in auth middleware where tokens expire too early"

# Check status
jules sessions get SESSION_ID

# Approve Jules's plan (when --approve-plan was used)
jules sessions approve SESSION_ID

# View Jules's PR
jules prs view PR_NUMBER --repo owner/repo

# Merge it
jules prs merge PR_NUMBER --repo owner/repo
```

## Agent Mode (--json)

Every command supports `--json` for machine-readable output with no noise:

```bash
jules sessions list --state IN_PROGRESS --json
```

See [AGENTS.md](./AGENTS.md) for the full agent integration guide.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Command Reference](./docs/command-reference.md)
- [Agent Integration Guide](./docs/agent-guide.md)
- [Jules API Notes](./docs/jules-api-notes.md)

## License

MIT
