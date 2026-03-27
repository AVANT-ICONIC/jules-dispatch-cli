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

```bash
# List connected repos
bun run src/index.ts sources list

# Dispatch a job to Jules
bun run src/index.ts sessions create \
  --repo owner/repo \
  --prompt "Fix the bug in auth middleware where tokens expire too early"

# Check status
bun run src/index.ts sessions get SESSION_ID

# Approve Jules's plan
bun run src/index.ts sessions approve SESSION_ID

# View Jules's PR
bun run src/index.ts prs view PR_NUMBER --repo owner/repo

# Merge it
bun run src/index.ts prs merge PR_NUMBER --repo owner/repo
```

## Agent Mode (--json)

Every command supports `--json` for machine-readable output with no noise:

```bash
bun run src/index.ts sessions list --state IN_PROGRESS --json
```

See [AGENTS.md](./AGENTS.md) for the full agent integration guide.

## Build a single binary

```bash
bun run build
# Produces: dist/jules
./dist/jules sources list
```

## License

MIT
