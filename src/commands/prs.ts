import type { Command } from 'commander';
import type { ConfigLoader } from '../config.ts';
import { JulesClient } from '../client.ts';
import { listOpenPRs, viewPR, mergePR, commentOnPR } from '../github.ts';
import { errorMessage, printJson, printHuman, printError } from '../output.ts';
import type { PullRequestOutput, Session } from '../types.ts';

interface EnrichedPR {
  julesSessionId: string;
  julesSessionTitle?: string;
  pr: PullRequestOutput;
  ghState?: string;
}

/** Extract PR outputs from sessions, optionally filtered by repo. */
function collectPullRequests(sessions: Session[], repo?: string): EnrichedPR[] {
  const result: EnrichedPR[] = [];
  for (const session of sessions) {
    if (!session.outputs) continue;
    if (!session.sourceContext?.source) continue;

    if (repo) {
      const sourceId = `sources/github/${repo}`;
      if (session.sourceContext.source !== sourceId) continue;
    }

    for (const output of session.outputs) {
      if (output.pullRequest) {
        result.push({
          julesSessionId: session.id,
          julesSessionTitle: session.title,
          pr: output.pullRequest,
        });
      }
    }
  }
  return result;
}

/** Enrich PRs with live GitHub state. Best-effort, mutates in place. */
async function enrichWithGitHubState(enriched: EnrichedPR[], repo: string): Promise<void> {
  try {
    const ghPRs = await listOpenPRs(repo);
    const ghByHead = new Map(ghPRs.map(p => [p.headRefName, p.state]));
    for (const e of enriched) {
      e.ghState = ghByHead.get(e.pr.headRef) ?? 'unknown';
    }
  } catch {
    // gh enrichment is best-effort
  }
}

function formatEnrichedPR(e: EnrichedPR): string {
  const state = e.ghState ? ` [${e.ghState}]` : '';
  return `${e.pr.url}${state}  ${e.pr.title}`;
}

export function registerPrsCommands(program: Command, loadConfig: ConfigLoader): void {
  const prs = program
    .command('prs')
    .description('Manage Jules-created pull requests');

  // list - cross-references session outputs for Jules PRs
  prs
    .command('list')
    .description('List open PRs created by Jules (from completed sessions)')
    .option('--repo <owner/repo>', 'Filter by repository')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; json?: boolean }) => {
      try {
        const config = await loadConfig();
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSessions(100);

        const enriched = collectPullRequests(response.sessions, opts.repo);

        if (opts.repo && enriched.length > 0) {
          await enrichWithGitHubState(enriched, opts.repo);
        }

        if (opts.json) {
          printJson(enriched);
        } else if (enriched.length === 0) {
          printHuman(['No Jules-created PRs found.']);
        } else {
          printHuman(enriched.map(formatEnrichedPR));
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
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
        const pr = await viewPR(Number.parseInt(prNumber, 10), opts.repo);
        if (opts.json) {
          printJson(pr);
        } else {
          printHuman([
            `Title:   ${pr.title}`,
            `State:   ${pr.state}`,
            `URL:     ${pr.url}`,
            `Branch:  ${pr.headRefName}`,
            ``,
            pr.body ?? '',
          ]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
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
        await mergePR(Number.parseInt(prNumber, 10), opts.repo);
        if (opts.json) {
          printJson({ ok: true, merged: Number.parseInt(prNumber, 10), repo: opts.repo });
        } else {
          printHuman([`PR #${prNumber} merged into ${opts.repo}.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
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
        await commentOnPR(Number.parseInt(prNumber, 10), opts.repo, message);
        if (opts.json) {
          printJson({ ok: true, pr: Number.parseInt(prNumber, 10), repo: opts.repo });
        } else {
          printHuman([`Comment posted on PR #${prNumber}.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });
}
