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
