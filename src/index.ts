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
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

registerSourcesCommands(program, config!);

program.command('schedules').description('Scheduled sessions').action(() => {
  console.error('Scheduled sessions are not yet exposed by the Jules API. Use the Jules web UI for now.');
  process.exit(1);
});

program.parse();
