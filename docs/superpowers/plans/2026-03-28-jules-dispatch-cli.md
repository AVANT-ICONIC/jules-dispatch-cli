# Jules Dispatch CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript/Bun CLI that lets AI agents fully control Google Jules — dispatching jobs, monitoring sessions, replying to Jules, approving plans, and handling PRs — without ever touching the Jules web UI.

**Architecture:** Commander.js handles CLI parsing with nested subcommands. A typed `JulesClient` class wraps all Jules REST API calls. PR operations delegate to the `gh` CLI (already authenticated). Each command receives a `--json` flag and calls either `printJson()` or `printHuman()` for output — zero global state.

**Tech Stack:** Bun (runtime + test runner), TypeScript, Commander.js, `gh` CLI (peer dep)

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Bin entry, deps, build/test scripts |
| `tsconfig.json` | TS config for Bun bundler |
| `.gitignore` | Ignore `.env`, build output |
| `.env.example` | Placeholder config for OSS users |
| `LICENSE` | MIT |
| `src/types.ts` | All Jules API TypeScript types |
| `src/config.ts` | Load + validate `.env` vars |
| `src/output.ts` | `printJson` / `printHuman` / `printError` utilities |
| `src/client.ts` | Typed Jules REST API client class |
| `src/github.ts` | `gh` CLI wrapper for PR operations |
| `src/commands/sources.ts` | `jules sources list` |
| `src/commands/sessions.ts` | `jules sessions list/get/create/reply/approve/activities` |
| `src/commands/prs.ts` | `jules prs list/view/merge/comment` |
| `src/index.ts` | CLI entry point, command registration, schedules stub |
| `tests/config.test.ts` | Unit tests for config loading |
| `tests/output.test.ts` | Unit tests for output formatting |
| `tests/client.test.ts` | Unit tests for API client with mocked fetch |
| `AGENTS.md` | Agent integration contract |
| `README.md` | Human setup + usage guide |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `LICENSE`
- Create: `src/` directory

- [ ] **Step 1: Install Commander.js**

```bash
cd /Users/valunex/Desktop/GitHub/jules-dispatch
bun add commander
bun add -d @types/bun
```

Expected output: package.json created, `node_modules/` populated.

- [ ] **Step 2: Write package.json**

Replace the auto-generated `package.json` with:

```json
{
  "name": "jules-dispatch",
  "version": "0.1.0",
  "description": "Agent-first CLI for Google Jules — dispatch jobs, monitor sessions, handle PRs without touching the web UI",
  "license": "MIT",
  "bin": {
    "jules": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "build": "bun build --compile --outfile dist/jules ./src/index.ts",
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "type": "module"
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write .gitignore**

```
.env
dist/
node_modules/
*.js.map
```

- [ ] **Step 5: Write .env.example**

```
# Jules Dispatch Configuration
# Copy to .env and fill in your values

# Jules API Key — get from jules.google.com > Settings > API Keys
JULES_API_KEY=your-jules-api-key-here

# Your GitHub username (owner of connected repos)
GITHUB_USERNAME=your-github-username
```

- [ ] **Step 6: Write LICENSE**

```
MIT License

Copyright (c) 2026 AVANT-ICONIC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Verify Bun works**

```bash
bun --version
bun run dev -- --help
```

Expected: Bun version printed, `--help` exits cleanly (will error until index.ts exists — that's fine).

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example LICENSE
git commit -m "feat: project scaffold — Bun + TypeScript + Commander"
```

---

## Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write src/types.ts**

```typescript
// Jules API — Session states
export type SessionState =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'WAITING_FOR_INPUT'
  | 'PLAN_READY'
  | 'FAILED';

// Jules API — Source (connected GitHub repo)
export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  defaultBranch?: { displayName: string };
  branches?: Array<{ displayName: string }>;
}

export interface Source {
  name: string;
  id: string;
  githubRepo: GitHubRepo;
}

export interface ListSourcesResponse {
  sources: Source[];
  nextPageToken?: string;
}

// Jules API — Sessions
export interface GitHubRepoContext {
  startingBranch?: string;
}

export interface SourceContext {
  source: string;
  githubRepoContext?: GitHubRepoContext;
  environmentVariablesEnabled?: boolean;
}

export interface GitPatch {
  unidiffPatch: string;
  baseCommitId: string;
  suggestedCommitMessage: string;
}

export interface PullRequestOutput {
  url: string;
  title: string;
  description: string;
  baseRef: string;
  headRef: string;
}

export interface SessionOutput {
  changeSet?: { source: string; gitPatch: GitPatch };
  pullRequest?: PullRequestOutput;
}

export interface Session {
  name: string;
  id: string;
  title?: string;
  createTime: string;
  updateTime: string;
  state: SessionState;
  sourceContext: SourceContext;
  prompt: string;
  url: string;
  outputs?: SessionOutput[];
}

export interface ListSessionsResponse {
  sessions: Session[];
  nextPageToken?: string;
}

// Jules API — Activities (discriminated union by key presence)
export interface AgentMessaged {
  agentMessage: string;
}

export interface UserMessaged {
  userMessage: string;
}

export interface Activity {
  name: string;
  id: string;
  createTime: string;
  originator: 'agent' | 'user';
  agentMessaged?: AgentMessaged;
  userMessaged?: UserMessaged;
}

export interface ListActivitiesResponse {
  activities: Activity[];
  nextPageToken?: string;
}

// Jules API — Session create payload (must be wrapped in { session: ... })
export interface CreateSessionPayload {
  session: {
    prompt: string;
    sourceContext: SourceContext;
    title?: string;
    requirePlanApproval?: boolean;
  };
}

// Jules API — Error shape
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
```

- [ ] **Step 2: Verify types compile**

```bash
bun build src/types.ts --outdir /tmp/jules-check 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: Jules API TypeScript types"
```

---

## Task 3: Config

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// tests/config.test.ts
import { describe, it, expect, afterEach } from 'bun:test';

describe('loadConfig', () => {
  const originalKey = process.env.JULES_API_KEY;
  const originalUser = process.env.GITHUB_USERNAME;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.JULES_API_KEY;
    else process.env.JULES_API_KEY = originalKey;

    if (originalUser === undefined) delete process.env.GITHUB_USERNAME;
    else process.env.GITHUB_USERNAME = originalUser;
  });

  it('throws when JULES_API_KEY is missing', async () => {
    delete process.env.JULES_API_KEY;
    process.env.GITHUB_USERNAME = 'test-user';
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow('JULES_API_KEY');
  });

  it('throws when GITHUB_USERNAME is missing', async () => {
    process.env.JULES_API_KEY = 'test-key';
    delete process.env.GITHUB_USERNAME;
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow('GITHUB_USERNAME');
  });

  it('returns config when both vars are set', async () => {
    process.env.JULES_API_KEY = 'test-key';
    process.env.GITHUB_USERNAME = 'test-user';
    const { loadConfig } = await import('../src/config');
    const config = loadConfig();
    expect(config.julesApiKey).toBe('test-key');
    expect(config.githubUsername).toBe('test-user');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
bun test tests/config.test.ts
```

Expected: FAIL — `Cannot find module '../src/config'`

- [ ] **Step 3: Write src/config.ts**

```typescript
export interface Config {
  julesApiKey: string;
  githubUsername: string;
}

export function loadConfig(): Config {
  const julesApiKey = process.env.JULES_API_KEY;
  const githubUsername = process.env.GITHUB_USERNAME;

  if (!julesApiKey) {
    throw new Error(
      'JULES_API_KEY is not set. Copy .env.example to .env and add your Jules API key.'
    );
  }
  if (!githubUsername) {
    throw new Error(
      'GITHUB_USERNAME is not set. Copy .env.example to .env and add your GitHub username.'
    );
  }

  return { julesApiKey, githubUsername };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
bun test tests/config.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: config loader with env validation"
```

---

## Task 4: Output Utilities

**Files:**
- Create: `src/output.ts`
- Create: `tests/output.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/output.test.ts
import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import { printJson, printHuman, printError } from '../src/output';

describe('printJson', () => {
  it('logs compact JSON to stdout', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    printJson({ foo: 'bar' });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }));
    spy.mockRestore();
  });
});

describe('printHuman', () => {
  it('logs each line to stdout', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    printHuman(['line one', 'line two']);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'line one');
    expect(spy).toHaveBeenNthCalledWith(2, 'line two');
    spy.mockRestore();
  });
});

describe('printError', () => {
  it('logs JSON error to stderr when json=true', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const exit = spyOn(process, 'exit').mockImplementation((() => {}) as any);
    printError('something broke', 1, true);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ error: 'something broke', code: 1 }));
    spy.mockRestore();
    exit.mockRestore();
  });

  it('logs plain error to stderr when json=false', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const exit = spyOn(process, 'exit').mockImplementation((() => {}) as any);
    printError('something broke', 1, false);
    expect(spy).toHaveBeenCalledWith('Error: something broke');
    spy.mockRestore();
    exit.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
bun test tests/output.test.ts
```

Expected: FAIL — `Cannot find module '../src/output'`

- [ ] **Step 3: Write src/output.ts**

```typescript
/**
 * Output utilities for agent-first CLI.
 * Commands receive --json as a Commander option and pass it explicitly
 * to these functions — no global state.
 */

/** Machine-readable output (agent mode). Compact single-line JSON. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

/** Human-readable output. Prints one line per entry. */
export function printHuman(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}

/**
 * Print an error and exit non-zero.
 * In json mode: JSON to stderr. Otherwise: plain text to stderr.
 */
export function printError(message: string, code = 1, json = false): never {
  if (json) {
    console.error(JSON.stringify({ error: message, code }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(code);
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
bun test tests/output.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/output.ts tests/output.test.ts
git commit -m "feat: output utilities (printJson/printHuman/printError)"
```

---

## Task 5: Jules API Client

**Files:**
- Create: `src/client.ts`
- Create: `tests/client.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/client.test.ts
import { describe, it, expect, spyOn, afterEach } from 'bun:test';
import { JulesClient } from '../src/client';

const BASE = 'https://jules.googleapis.com/v1alpha';

function mockFetch(body: unknown, ok = true) {
  return spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

describe('JulesClient', () => {
  afterEach(() => {
    (globalThis.fetch as ReturnType<typeof spyOn>).mockRestore?.();
  });

  it('listSources sends correct header and URL', async () => {
    const spy = mockFetch({ sources: [] });
    const client = new JulesClient('my-key');
    await client.listSources();
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sources`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'my-key' }),
      })
    );
  });

  it('listSessions sends correct URL with pageSize', async () => {
    const spy = mockFetch({ sessions: [] });
    const client = new JulesClient('my-key');
    await client.listSessions(10);
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions?pageSize=10`,
      expect.anything()
    );
  });

  it('createSession wraps payload in { session: ... }', async () => {
    const spy = mockFetch({ id: '123', name: 'sessions/123' });
    const client = new JulesClient('my-key');
    await client.createSession({
      session: {
        prompt: 'do the thing',
        sourceContext: { source: 'sources/github/owner/repo' },
      },
    });
    const callBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody).toHaveProperty('session.prompt', 'do the thing');
  });

  it('throws on non-ok response with API error message', async () => {
    mockFetch({ error: { code: 400, message: 'Bad field', status: 'INVALID_ARGUMENT' } }, false);
    const client = new JulesClient('bad-key');
    await expect(client.listSources()).rejects.toThrow('Bad field');
  });

  it('replyToSession POSTs userMessaged activity', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.replyToSession('sess-1', 'hello Jules');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions/sess-1/activities`,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.userMessaged.userMessage).toBe('hello Jules');
  });

  it('approvePlan POSTs to :approvePlan endpoint', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.approvePlan('sess-2');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions/sess-2:approvePlan`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
bun test tests/client.test.ts
```

Expected: FAIL — `Cannot find module '../src/client'`

- [ ] **Step 3: Write src/client.ts**

```typescript
import type {
  ListSourcesResponse,
  ListSessionsResponse,
  Session,
  ListActivitiesResponse,
  CreateSessionPayload,
} from './types.ts';

const BASE_URL = 'https://jules.googleapis.com/v1alpha';

export class JulesClient {
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      'X-Goog-Api-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });
    const data = (await res.json()) as T;
    if (!res.ok) {
      const err = data as any;
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    return data;
  }

  listSources(): Promise<ListSourcesResponse> {
    return this.request('/sources');
  }

  listSessions(pageSize = 50): Promise<ListSessionsResponse> {
    return this.request(`/sessions?pageSize=${pageSize}`);
  }

  getSession(sessionId: string): Promise<Session> {
    return this.request(`/sessions/${sessionId}`);
  }

  createSession(payload: CreateSessionPayload): Promise<Session> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  replyToSession(sessionId: string, message: string): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/activities`, {
      method: 'POST',
      body: JSON.stringify({ userMessaged: { userMessage: message } }),
    });
  }

  approvePlan(sessionId: string): Promise<unknown> {
    return this.request(`/sessions/${sessionId}:approvePlan`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  listActivities(sessionId: string, pageSize = 20): Promise<ListActivitiesResponse> {
    return this.request(`/sessions/${sessionId}/activities?pageSize=${pageSize}`);
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
bun test tests/client.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/client.ts tests/client.test.ts
git commit -m "feat: Jules API client with typed requests"
```

---

## Task 6: GitHub CLI Wrapper

**Files:**
- Create: `src/github.ts`

No unit tests here — `gh` CLI is an external process. Covered by the end-to-end test in Task 12.

- [ ] **Step 1: Write src/github.ts**

```typescript
import { $ } from 'bun';

export interface GHPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  headRefName: string;
  body: string;
  createdAt: string;
}

/** List open PRs for a repo. Returns all open PRs (caller filters by Jules branch if needed). */
export async function listOpenPRs(repo: string): Promise<GHPullRequest[]> {
  const result =
    await $`gh pr list --repo ${repo} --state open --json number,title,state,url,headRefName,body,createdAt`.text();
  return JSON.parse(result) as GHPullRequest[];
}

/** Get a single PR by number. */
export async function viewPR(prNumber: number, repo: string): Promise<GHPullRequest> {
  const result =
    await $`gh pr view ${prNumber} --repo ${repo} --json number,title,state,url,headRefName,body,createdAt`.text();
  return JSON.parse(result) as GHPullRequest;
}

/** Merge a PR with merge commit. */
export async function mergePR(prNumber: number, repo: string): Promise<void> {
  await $`gh pr merge ${prNumber} --repo ${repo} --merge --yes`;
}

/** Post a comment on a PR. */
export async function commentOnPR(prNumber: number, repo: string, body: string): Promise<void> {
  await $`gh pr comment ${prNumber} --repo ${repo} --body ${body}`;
}
```

- [ ] **Step 2: Verify gh is available**

```bash
gh --version
```

Expected: `gh version 2.x.x`

- [ ] **Step 3: Commit**

```bash
git add src/github.ts
git commit -m "feat: gh CLI wrapper for PR operations"
```

---

## Task 7: Sources Command

**Files:**
- Create: `src/commands/sources.ts`

- [ ] **Step 1: Write src/commands/sources.ts**

```typescript
import type { Command } from 'commander';
import type { Config } from '../config.ts';
import { JulesClient } from '../client.ts';
import { printJson, printHuman, printError } from '../output.ts';
import type { Source } from '../types.ts';

function formatSource(s: Source): string {
  const visibility = s.githubRepo.isPrivate ? 'private' : 'public';
  const branch = s.githubRepo.defaultBranch?.displayName ?? 'unknown';
  return `${s.githubRepo.owner}/${s.githubRepo.repo}  [${visibility}]  default: ${branch}`;
}

export function registerSourcesCommands(program: Command, config: Config): void {
  const sources = program
    .command('sources')
    .description('Manage Jules-connected GitHub repositories');

  sources
    .command('list')
    .description('List all Jules-connected repositories')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSources();
        if (opts.json) {
          printJson(response.sources);
        } else {
          if (response.sources.length === 0) {
            printHuman(['No sources found. Connect a repo at jules.google.com']);
          } else {
            printHuman(response.sources.map(formatSource));
          }
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });
}
```

- [ ] **Step 2: Wire into index.ts (temporary stub to test)**

Create `src/index.ts` with just enough to test sources:

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { printError } from './output.ts';
import { registerSourcesCommands } from './commands/sources.ts';

const program = new Command();
program.name('jules').description('Agent-first CLI for Google Jules').version('0.1.0');

let config;
try {
  config = loadConfig();
} catch (e: any) {
  printError(e.message, 1, process.argv.includes('--json'));
}

registerSourcesCommands(program, config!);

program.command('schedules').description('Scheduled sessions').action(() => {
  console.error('Scheduled sessions are not yet exposed by the Jules API. Use the Jules web UI for now.');
  process.exit(1);
});

program.parse();
```

- [ ] **Step 3: Test sources list against live API**

```bash
bun run src/index.ts sources list
bun run src/index.ts sources list --json
```

Expected (human): one line per repo, e.g. `AVANT-ICONIC/Apex-Custom-Language  [private]  default: main`
Expected (json): JSON array of source objects.

- [ ] **Step 4: Commit**

```bash
git add src/commands/sources.ts src/index.ts
git commit -m "feat: sources list command"
```

---

## Task 8: Sessions Commands

**Files:**
- Create: `src/commands/sessions.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write src/commands/sessions.ts**

```typescript
import type { Command } from 'commander';
import type { Config } from '../config.ts';
import { JulesClient } from '../client.ts';
import { printJson, printHuman, printError } from '../output.ts';
import type { Session, Activity } from '../types.ts';

function formatSession(s: Session): string {
  const pr = s.outputs?.find(o => o.pullRequest)?.pullRequest;
  const prInfo = pr ? `  PR: ${pr.url}` : '';
  return `[${s.state}]  ${s.id}  ${s.title ?? '(no title)'}${prInfo}`;
}

function formatActivity(a: Activity): string {
  const who = a.originator === 'agent' ? 'Jules' : 'User ';
  const msg = a.agentMessaged?.agentMessage ?? a.userMessaged?.userMessage ?? '(no message)';
  const preview = msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
  return `[${a.createTime}] ${who}: ${preview}`;
}

export function registerSessionsCommands(program: Command, config: Config): void {
  const sessions = program
    .command('sessions')
    .description('Manage Jules sessions');

  // list
  sessions
    .command('list')
    .description('List Jules sessions')
    .option('--repo <owner/repo>', 'Filter by repository')
    .option('--state <state>', 'Filter by state: IN_PROGRESS, COMPLETED, WAITING_FOR_INPUT, PLAN_READY, FAILED, ALL', 'ALL')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; state?: string; json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSessions(100);
        let sessions = response.sessions;

        if (opts.repo) {
          const sourceId = `sources/github/${opts.repo}`;
          sessions = sessions.filter(s => s.sourceContext.source === sourceId);
        }
        if (opts.state && opts.state !== 'ALL') {
          sessions = sessions.filter(s => s.state === opts.state);
        }

        if (opts.json) {
          printJson(sessions);
        } else {
          if (sessions.length === 0) {
            printHuman(['No sessions found.']);
          } else {
            printHuman(sessions.map(formatSession));
          }
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // get
  sessions
    .command('get <session-id>')
    .description('Get details and latest activities for a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const [session, activitiesRes] = await Promise.all([
          client.getSession(sessionId),
          client.listActivities(sessionId, 10),
        ]);
        if (opts.json) {
          printJson({ session, activities: activitiesRes.activities });
        } else {
          printHuman([
            `ID:      ${session.id}`,
            `Title:   ${session.title ?? '(no title)'}`,
            `State:   ${session.state}`,
            `Repo:    ${session.sourceContext.source}`,
            `Updated: ${session.updateTime}`,
            `URL:     ${session.url}`,
            '',
            '--- Recent Activities ---',
            ...activitiesRes.activities.map(formatActivity),
          ]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // create
  sessions
    .command('create')
    .description('Dispatch a new Jules job')
    .requiredOption('--repo <owner/repo>', 'Target repository (e.g. AVANT-ICONIC/my-repo)')
    .requiredOption('--prompt <text>', 'Task description for Jules')
    .option('--branch <branch>', 'Branch to start from', 'main')
    .option('--title <title>', 'Session title')
    .option('--approve-plan', 'Require plan approval before Jules executes')
    .option('--json', 'Output raw JSON')
    .action(async (opts: {
      repo: string;
      prompt: string;
      branch: string;
      title?: string;
      approvePlan?: boolean;
      json?: boolean;
    }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const session = await client.createSession({
          session: {
            prompt: opts.prompt,
            title: opts.title,
            requirePlanApproval: opts.approvePlan ?? false,
            sourceContext: {
              source: `sources/github/${opts.repo}`,
              githubRepoContext: { startingBranch: opts.branch },
            },
          },
        });
        if (opts.json) {
          printJson({ id: session.id, state: session.state, url: session.url });
        } else {
          printHuman([
            `Session created:`,
            `  ID:    ${session.id}`,
            `  State: ${session.state}`,
            `  URL:   ${session.url}`,
            ``,
            `Monitor with: jules sessions get ${session.id}`,
          ]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // reply
  sessions
    .command('reply <session-id> <message>')
    .description('Send a message to Jules in a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, message: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        await client.replyToSession(sessionId, message);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Message sent to session ${sessionId}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // approve
  sessions
    .command('approve <session-id>')
    .description('Approve Jules\'s plan and let it execute')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        await client.approvePlan(sessionId);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Plan approved. Jules is now executing session ${sessionId}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // activities
  sessions
    .command('activities <session-id>')
    .description('Show the activity log for a session')
    .option('--limit <n>', 'Number of activities to fetch', '20')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { limit?: string; json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listActivities(sessionId, parseInt(opts.limit ?? '20', 10));
        if (opts.json) {
          printJson(response.activities);
        } else {
          if (response.activities.length === 0) {
            printHuman(['No activities yet.']);
          } else {
            printHuman(response.activities.map(formatActivity));
          }
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });
}
```

- [ ] **Step 2: Register sessions in index.ts**

Add after the sources registration line:

```typescript
import { registerSessionsCommands } from './commands/sessions.ts';
// ...
registerSessionsCommands(program, config!);
```

- [ ] **Step 3: Smoke-test against live API**

```bash
# List all in-progress sessions
bun run src/index.ts sessions list --state IN_PROGRESS

# List as JSON (agent mode)
bun run src/index.ts sessions list --state IN_PROGRESS --json

# Get the in-progress session we saw earlier
bun run src/index.ts sessions get 2072552271158231359
bun run src/index.ts sessions get 2072552271158231359 --json
```

Expected (list human): lines like `[IN_PROGRESS]  2072552271158231359  Bolt ⚡: ...`
Expected (get json): `{ session: {...}, activities: [...] }`

- [ ] **Step 4: Commit**

```bash
git add src/commands/sessions.ts src/index.ts
git commit -m "feat: sessions commands (list/get/create/reply/approve/activities)"
```

---

## Task 9: PRs Command

**Files:**
- Create: `src/commands/prs.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write src/commands/prs.ts**

```typescript
import type { Command } from 'commander';
import type { Config } from '../config.ts';
import { JulesClient } from '../client.ts';
import { listOpenPRs, viewPR, mergePR, commentOnPR } from '../github.ts';
import { printJson, printHuman, printError } from '../output.ts';
import type { PullRequestOutput } from '../types.ts';

interface EnrichedPR {
  julesSessionId: string;
  julesSessionTitle?: string;
  pr: PullRequestOutput;
  ghState?: string;
}

export function registerPrsCommands(program: Command, config: Config): void {
  const prs = program
    .command('prs')
    .description('Manage Jules-created pull requests');

  // list — cross-references session outputs for Jules PRs
  prs
    .command('list')
    .description('List open PRs created by Jules (from completed sessions)')
    .option('--repo <owner/repo>', 'Filter by repository')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSessions(100);

        const enriched: EnrichedPR[] = [];
        for (const session of response.sessions) {
          if (!session.outputs) continue;

          // Optional repo filter
          if (opts.repo) {
            const sourceId = `sources/github/${opts.repo}`;
            if (session.sourceContext.source !== sourceId) continue;
          }

          for (const output of session.outputs) {
            if (output.pullRequest) {
              enriched.push({
                julesSessionId: session.id,
                julesSessionTitle: session.title,
                pr: output.pullRequest,
              });
            }
          }
        }

        // Enrich with live gh state if we have a repo to query
        if (opts.repo && enriched.length > 0) {
          try {
            const ghPRs = await listOpenPRs(opts.repo);
            const ghByHead = new Map(ghPRs.map(p => [p.headRefName, p.state]));
            for (const e of enriched) {
              e.ghState = ghByHead.get(e.pr.headRef) ?? 'unknown';
            }
          } catch {
            // gh enrichment is best-effort
          }
        }

        if (opts.json) {
          printJson(enriched);
        } else {
          if (enriched.length === 0) {
            printHuman(['No Jules-created PRs found.']);
          } else {
            printHuman(
              enriched.map(e => {
                const state = e.ghState ? ` [${e.ghState}]` : '';
                return `${e.pr.url}${state}  ${e.pr.title}`;
              })
            );
          }
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // view
  prs
    .command('view <pr-number>')
    .description('Show a PR created by Jules')
    .requiredOption('--repo <owner/repo>', 'Repository (e.g. AVANT-ICONIC/my-repo)')
    .option('--json', 'Output raw JSON')
    .action(async (prNumber: string, opts: { repo: string; json?: boolean }) => {
      try {
        const pr = await viewPR(parseInt(prNumber, 10), opts.repo);
        if (opts.json) {
          printJson(pr);
        } else {
          printHuman([
            `Title:   ${pr.title}`,
            `State:   ${pr.state}`,
            `URL:     ${pr.url}`,
            `Branch:  ${pr.headRefName}`,
            ``,
            pr.body,
          ]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // merge
  prs
    .command('merge <pr-number>')
    .description('Merge a Jules PR')
    .requiredOption('--repo <owner/repo>', 'Repository')
    .option('--json', 'Output raw JSON')
    .action(async (prNumber: string, opts: { repo: string; json?: boolean }) => {
      try {
        await mergePR(parseInt(prNumber, 10), opts.repo);
        if (opts.json) {
          printJson({ ok: true, merged: parseInt(prNumber, 10), repo: opts.repo });
        } else {
          printHuman([`PR #${prNumber} merged into ${opts.repo}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // comment
  prs
    .command('comment <pr-number> <message>')
    .description('Post a comment on a Jules PR')
    .requiredOption('--repo <owner/repo>', 'Repository')
    .option('--json', 'Output raw JSON')
    .action(async (prNumber: string, message: string, opts: { repo: string; json?: boolean }) => {
      try {
        await commentOnPR(parseInt(prNumber, 10), opts.repo, message);
        if (opts.json) {
          printJson({ ok: true, pr: parseInt(prNumber, 10), repo: opts.repo });
        } else {
          printHuman([`Comment posted on PR #${prNumber}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });
}
```

- [ ] **Step 2: Register prs in index.ts**

Add after sessions registration:

```typescript
import { registerPrsCommands } from './commands/prs.ts';
// ...
registerPrsCommands(program, config!);
```

- [ ] **Step 3: Smoke-test PRs list**

```bash
bun run src/index.ts prs list --json
bun run src/index.ts prs list --repo AVANT-ICONIC/game-idea
```

Expected: Jules-created PRs extracted from session outputs.

- [ ] **Step 4: Commit**

```bash
git add src/commands/prs.ts src/index.ts
git commit -m "feat: prs commands (list/view/merge/comment)"
```

---

## Task 10: Final index.ts — Wire Everything Clean

**Files:**
- Modify: `src/index.ts` (replace stub with final version)

- [ ] **Step 1: Rewrite src/index.ts to final form**

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { printError } from './output.ts';
import { registerSourcesCommands } from './commands/sources.ts';
import { registerSessionsCommands } from './commands/sessions.ts';
import { registerPrsCommands } from './commands/prs.ts';

const program = new Command();

program
  .name('jules')
  .description('Agent-first CLI for Google Jules.\nDocs: https://github.com/AVANT-ICONIC/jules-dispatch')
  .version('0.1.0');

let config;
try {
  config = loadConfig();
} catch (e: any) {
  // Use plain text error — we don't know --json flag yet at this point
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

registerSourcesCommands(program, config);
registerSessionsCommands(program, config);
registerPrsCommands(program, config);

// Schedules: not yet supported by Jules API
program
  .command('schedules')
  .description('Scheduled sessions (not yet supported by Jules API)')
  .action(() => {
    console.error(
      'Scheduled sessions are not yet exposed by the Jules API. Use the Jules web UI: https://jules.google.com'
    );
    process.exit(1);
  });

program.parse();
```

- [ ] **Step 2: Verify help output**

```bash
bun run src/index.ts --help
bun run src/index.ts sessions --help
bun run src/index.ts sessions create --help
```

Expected: Clean help text for all commands and subcommands.

- [ ] **Step 3: Run all tests**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: finalize CLI entry point with all commands wired"
```

---

## Task 11: AGENTS.md and README.md

**Files:**
- Create: `AGENTS.md`
- Create: `README.md`

- [ ] **Step 1: Write AGENTS.md**

```markdown
# AGENTS.md — Jules Dispatch CLI Integration Guide

This document tells AI agents (Claude Code, Codex, Gemini, etc.) exactly how to use
the `jules` CLI to manage Google Jules without human intervention.

## Prerequisites

Run this check at the start of every session:

```bash
bun run src/index.ts sources list --json
```

If you get a non-empty array, you are authenticated and ready. If you get an error,
the `.env` file is missing or the API key is invalid — stop and report to the user.

## Dispatching a Job (Instant Mode)

Jules will execute immediately and open a PR when done:

```bash
bun run src/index.ts sessions create \
  --repo OWNER/REPO \
  --prompt "Detailed description of the task. Include: goal, files to touch, constraints, how to verify correctness." \
  --title "Short descriptive title" \
  --json
```

Save the `id` field from the JSON response. You will need it to monitor progress.

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

Poll every 30+ seconds (do not poll faster — Jules is async):

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

Activities with `agentMessaged` are from Jules. Read the `agentMessage` field.
Activities with `userMessaged` are from you or the user.

## Replying to Jules

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

1. Always use `--json` — no human-readable noise
2. Never poll faster than 30 second intervals
3. Run `sources list` once per session — cache the result
4. Use `sessions list --state IN_PROGRESS --json` to get an overview before diving into individual sessions
5. Read `session.outputs` from `sessions get` before calling `prs list` — the PR URL is already there

## Exit Codes

- `0` — success
- `1` — error (see stderr for JSON error object when using `--json`)
```

- [ ] **Step 2: Write README.md**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: AGENTS.md integration contract and README"
```

---

## Task 12: End-to-End Test

Verifies the complete flow: create test repo → connect Jules → dispatch → approve → PR → merge.

**Note:** Jules must have the GitHub App installed on the test repo for this to work. You may need to visit jules.google.com to connect the new repo after creation.

- [ ] **Step 1: Create the test repo**

```bash
gh repo create AVANT-ICONIC/jules-dispatch-test \
  --private \
  --description "Test repo for jules-dispatch CLI end-to-end verification" \
  --clone
cd jules-dispatch-test
```

- [ ] **Step 2: Push a minimal codebase Jules can improve**

```bash
mkdir src
cat > src/index.ts << 'EOF'
// TODO: add input validation
export function divide(a: number, b: number): number {
  return a / b; // Bug: no check for b === 0
}

export function greet(name: string): string {
  return `Hello ${name}`;
}
EOF

echo '{ "name": "test-app", "version": "1.0.0", "type": "module" }' > package.json

git init
git add .
git commit -m "Initial commit — minimal TS app with known issues"
git branch -M main
git remote add origin https://github.com/AVANT-ICONIC/jules-dispatch-test.git
git push -u origin main
```

- [ ] **Step 3: Connect repo to Jules**

Visit https://jules.google.com, go to Settings > Connected Repos, and add `AVANT-ICONIC/jules-dispatch-test`. Then verify it appears:

```bash
cd /Users/valunex/Desktop/GitHub/jules-dispatch
bun run src/index.ts sources list --json | grep jules-dispatch-test
```

Expected: the repo appears in the JSON output.

- [ ] **Step 4: Dispatch a session with plan approval**

```bash
SESSION=$(bun run src/index.ts sessions create \
  --repo AVANT-ICONIC/jules-dispatch-test \
  --prompt "Fix the divide function in src/index.ts to throw an error when b is 0 instead of returning Infinity. Add a JSDoc comment explaining the fix. Keep the change minimal." \
  --title "Fix divide-by-zero bug" \
  --approve-plan \
  --json | bun -e "const d=await Bun.stdin.json(); console.log(d.id)")

echo "Session ID: $SESSION"
```

Expected: session ID printed, e.g. `1234567890123456789`

- [ ] **Step 5: Poll until PLAN_READY**

```bash
bun run src/index.ts sessions get $SESSION --json | bun -e "const d=await Bun.stdin.json(); console.log(d.session.state)"
```

Repeat until state is `PLAN_READY`. (Jules typically takes 2-5 minutes.)

- [ ] **Step 6: Read Jules's plan**

```bash
bun run src/index.ts sessions activities $SESSION --json
```

Inspect the `agentMessaged.agentMessage` from Jules — it should describe what it plans to change.

- [ ] **Step 7: Approve the plan**

```bash
bun run src/index.ts sessions approve $SESSION --json
```

Expected: `{ "ok": true, "sessionId": "..." }`

- [ ] **Step 8: Poll until COMPLETED**

```bash
bun run src/index.ts sessions get $SESSION --json | bun -e "const d=await Bun.stdin.json(); console.log(d.session.state)"
```

Repeat until `COMPLETED`.

- [ ] **Step 9: Inspect the PR from session outputs**

```bash
bun run src/index.ts sessions get $SESSION --json | \
  bun -e "const d=await Bun.stdin.json(); const pr=d.session.outputs?.find(o=>o.pullRequest)?.pullRequest; console.log(JSON.stringify(pr,null,2))"
```

Expected: PR URL, title, headRef all present.

- [ ] **Step 10: View the PR via the prs command**

```bash
PR_URL=$(bun run src/index.ts sessions get $SESSION --json | \
  bun -e "const d=await Bun.stdin.json(); console.log(d.session.outputs?.find(o=>o.pullRequest)?.pullRequest?.url ?? '')")

# Extract PR number from URL (last segment)
PR_NUM=$(echo $PR_URL | grep -oE '[0-9]+$')

bun run src/index.ts prs view $PR_NUM --repo AVANT-ICONIC/jules-dispatch-test
```

Expected: PR title, state (open), body shown.

- [ ] **Step 11: Merge the PR**

```bash
bun run src/index.ts prs merge $PR_NUM --repo AVANT-ICONIC/jules-dispatch-test --json
```

Expected: `{ "ok": true, "merged": ..., "repo": "AVANT-ICONIC/jules-dispatch-test" }`

- [ ] **Step 12: Verify on GitHub**

```bash
gh pr view $PR_NUM --repo AVANT-ICONIC/jules-dispatch-test
```

Expected: `state: MERGED`

- [ ] **Step 13: Run full test suite one final time**

```bash
cd /Users/valunex/Desktop/GitHub/jules-dispatch
bun test
```

Expected: all tests pass.

- [ ] **Step 14: Final commit**

```bash
git add .
git commit -m "test: verified end-to-end Jules dispatch flow"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Covered In |
|-----------------|------------|
| `sources list` | Task 7 |
| `sessions list/get/create/reply/approve/activities` | Task 8 |
| `prs list/view/merge/comment` | Task 9 |
| `--json` flag on every command | All command tasks |
| Exit codes | `printError` in Task 4 |
| Schedules stub | Task 10 |
| `{ "session": ... }` create payload wrapper | Task 5 `client.ts` |
| Activities discriminated union | Task 2 types, Task 8 `formatActivity` |
| PRs via session outputs not branch patterns | Task 9 `prs list` |
| `AGENTS.md` contract | Task 11 |
| `README.md` | Task 11 |
| `.env.example` + `.gitignore` | Task 1 |
| MIT License | Task 1 |
| End-to-end test | Task 12 |

All spec requirements covered. No gaps found.
