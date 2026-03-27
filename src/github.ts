import { $ } from 'bun';

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

/** List open PRs for a repo. Returns all open PRs. */
export async function listOpenPRs(repo: string): Promise<GHPullRequest[]> {
  const result =
    await $`gh pr list --repo ${repo} --state open --json ${PR_FIELDS}`.text();
  return JSON.parse(result) as GHPullRequest[];
}

/** Get a single PR by number. */
export async function viewPR(prNumber: number, repo: string): Promise<GHPullRequest> {
  const result =
    await $`gh pr view ${prNumber} --repo ${repo} --json ${PR_FIELDS}`.text();
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
