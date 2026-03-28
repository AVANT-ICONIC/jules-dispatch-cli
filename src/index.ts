#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
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

registerSourcesCommands(program, config!);
registerSessionsCommands(program, config!);
registerPrsCommands(program, config!);

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
