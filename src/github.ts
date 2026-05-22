/**
 * GitHub CLI integration. All gh commands route through `execGh` so tests
 * can swap the executor without mocking bun internals.
 */

const PR_FIELDS = 'number,title,state,url,headRefName,body,createdAt';

export interface GHPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  headRefName: string;
  body: string;
  createdAt: string;
}

/** Shell executor — swappable for testing. */
export type ExecGh = (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

let _execGh: ExecGh = async (args: string[]) => {
  try {
    const proc = Bun.spawnSync(['gh', ...args], { stdout: 'pipe', stderr: 'pipe' });
    return {
      stdout: new TextDecoder().decode(proc.stdout),
      stderr: new TextDecoder().decode(proc.stderr),
      exitCode: proc.exitCode,
    };
  } catch (e: any) {
    if (e.code === 'ENOENT' || e.message?.includes('spawnSync')) {
      return { stdout: '', stderr: 'gh: command not found', exitCode: 127 };
    }
    throw e;
  }
};

/** Swap the shell executor — for testing. */
export function setExecGh(fn: ExecGh): void {
  _execGh = fn;
}

/** Internal: route all gh calls through the current executor. */
async function execGh(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return _execGh(args);
}

let ghChecked = false;

/** Verify `gh` CLI is installed and authenticated. Runs once, caches result. */
export async function ensureGhAvailable(): Promise<void> {
  if (ghChecked) return;
  const result = await execGh(['auth', 'status']);
  if (result.exitCode === 127) {
    throw new Error(
      'GitHub CLI (gh) is not installed. Install it from https://cli.github.com'
    );
  }
  if (result.exitCode !== 0) {
    throw new Error(
      'GitHub CLI (gh) is not authenticated. Run `gh auth login` to authenticate.'
    );
  }
  ghChecked = true;
}

/** List open PRs for a repo. Returns all open PRs. */
export async function listOpenPRs(repo: string): Promise<GHPullRequest[]> {
  await ensureGhAvailable();
  const result = await execGh([
    'pr', 'list',
    '--repo', repo,
    '--state', 'open',
    '--json', PR_FIELDS,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`gh pr list failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as GHPullRequest[];
}

/** Get a single PR by number. */
export async function viewPR(prNumber: number, repo: string): Promise<GHPullRequest> {
  await ensureGhAvailable();
  const result = await execGh([
    'pr', 'view', String(prNumber),
    '--repo', repo,
    '--json', PR_FIELDS,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`gh pr view failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as GHPullRequest;
}

/** Merge a PR with merge commit. */
export async function mergePR(prNumber: number, repo: string): Promise<void> {
  await ensureGhAvailable();
  const result = await execGh([
    'pr', 'merge', String(prNumber),
    '--repo', repo,
    '--merge',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`gh pr merge failed: ${result.stderr}`);
  }
}

/** Post a comment on a PR. */
export async function commentOnPR(prNumber: number, repo: string, body: string): Promise<void> {
  await ensureGhAvailable();
  const result = await execGh([
    'pr', 'comment', String(prNumber),
    '--repo', repo,
    '--body', body,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`gh pr comment failed: ${result.stderr}`);
  }
}

/** Reset internal state — for testing only. */
export function __resetGhState(): void {
  ghChecked = false;
}
