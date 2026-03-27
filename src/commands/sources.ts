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
