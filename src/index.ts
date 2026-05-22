#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { registerSourcesCommands } from './commands/sources.ts';
import { registerSessionsCommands } from './commands/sessions.ts';
import { registerPrsCommands } from './commands/prs.ts';

const program = new Command();
const pkg = JSON.parse(await Bun.file(new URL('../package.json', import.meta.url)).text());

program
  .name('jules')
  .description('Agent-first CLI for Google Jules.\nDocs: https://github.com/AVANT-ICONIC/jules-dispatch')
  .version(pkg.version);


function initConfig(): ReturnType<typeof loadConfig> {
  try {
    return loadConfig();
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

const config = initConfig();

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
