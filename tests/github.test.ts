import { describe, it, expect, afterEach } from 'bun:test';
import {
  ensureGhAvailable,
  listOpenPRs,
  viewPR,
  mergePR,
  commentOnPR,
  setExecGh,
  __resetGhState,
} from '../src/github';
import type { ExecGh } from '../src/github';

function mockExecGh(responses: Record<string, { stdout: string; stderr: string; exitCode: number }>) {
  const fn: ExecGh = async (args: string[]) => {
    const key = args.join(' ');
    if (key in responses) return responses[key];
    // Default: success with empty output
    return { stdout: '[]', stderr: '', exitCode: 0 };
  };
  setExecGh(fn);
  return fn;
}

afterEach(() => {
  __resetGhState();
});

describe('ensureGhAvailable', () => {
  it('calls gh auth status and caches result', async () => {
    mockExecGh({
      'auth status': { stdout: 'Logged in', stderr: '', exitCode: 0 },
    });
    await ensureGhAvailable();
    // Second call should be cached — no error
    await ensureGhAvailable();
  });

  it('throws when gh auth status fails', async () => {
    mockExecGh({
      'auth status': { stdout: '', stderr: 'not logged in', exitCode: 1 },
    });
    await expect(ensureGhAvailable()).rejects.toThrow('not authenticated');
  });

  it('throws when gh is not installed (exit code 127)', async () => {
    __resetGhState();
    mockExecGh({
      'auth status': { stdout: '', stderr: 'gh: command not found', exitCode: 127 },
    });
    await expect(ensureGhAvailable()).rejects.toThrow('not installed');
  });

});

describe('listOpenPRs', () => {
  it('parses gh pr list JSON output', async () => {
    const prJSON = JSON.stringify([
      { number: 42, title: 'Test', state: 'OPEN', url: 'https://github.com/o/r/pull/42', headRefName: 'feat/x', body: '', createdAt: '2026-01-01T00:00:00Z' },
    ]);
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr list --repo owner/repo --state open --json number,title,state,url,headRefName,body,createdAt': { stdout: prJSON, stderr: '', exitCode: 0 },
    });
    const prs = await listOpenPRs('owner/repo');
    expect(prs).toHaveLength(1);
    expect(prs[0].number).toBe(42);
    expect(prs[0].title).toBe('Test');
  });

  it('throws on non-zero exit code', async () => {
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr list --repo owner/repo --state open --json number,title,state,url,headRefName,body,createdAt': { stdout: '', stderr: 'not found', exitCode: 1 },
    });
    await expect(listOpenPRs('owner/repo')).rejects.toThrow('gh pr list failed');
  });
});

describe('viewPR', () => {
  it('calls gh pr view with correct args', async () => {
    const prJSON = JSON.stringify({ number: 7, title: 'Fix', state: 'OPEN', url: 'u', headRefName: 'fix', body: 'desc', createdAt: '2026-01-01' });
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr view 7 --repo owner/repo --json number,title,state,url,headRefName,body,createdAt': { stdout: prJSON, stderr: '', exitCode: 0 },
    });
    const pr = await viewPR(7, 'owner/repo');
    expect(pr.number).toBe(7);
  });
});

describe('mergePR', () => {
  it('calls gh pr merge with --merge flag', async () => {
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr merge 3 --repo owner/repo --merge': { stdout: 'Merged', stderr: '', exitCode: 0 },
    });
    await expect(mergePR(3, 'owner/repo')).resolves.toBeUndefined();
  });

  it('throws on merge failure', async () => {
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr merge 3 --repo owner/repo --merge': { stdout: '', stderr: 'conflict', exitCode: 1 },
    });
    await expect(mergePR(3, 'owner/repo')).rejects.toThrow('gh pr merge failed');
  });
});

describe('commentOnPR', () => {
  it('calls gh pr comment with body', async () => {
    mockExecGh({
      'auth status': { stdout: '', stderr: '', exitCode: 0 },
      'pr comment 5 --repo owner/repo --body nice work': { stdout: '', stderr: '', exitCode: 0 },
    });
    await expect(commentOnPR(5, 'owner/repo', 'nice work')).resolves.toBeUndefined();
  });
});
