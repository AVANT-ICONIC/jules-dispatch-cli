#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig } from './config.ts';
import { registerSourcesCommands } from './commands/sources.ts';
import { registerSessionsCommands } from './commands/sessions.ts';
import { registerPrsCommands } from './commands/prs.ts';
import { registerInitCommand } from './commands/init.ts';

const program = new Command();
const pkg = JSON.parse(await Bun.file(new URL('../package.json', import.meta.url)).text());

program
  .name('jules')
  .description('Agent-first CLI for Google Jules.\nDocs: https://github.com/AVANT-ICONIC/jules-dispatch')
  .version(pkg.version);

// Global options
program.option('--profile <name>', 'Use a specific profile (loads .env.<name>)');

function initConfig(profile: string | undefined): ReturnType<typeof loadConfig> {
  try {
    return loadConfig(profile);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

const config = initConfig(program.opts().profile);

registerSourcesCommands(program, config);
registerSessionsCommands(program, config);
registerPrsCommands(program, config);
registerInitCommand(program);

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

// Shell completions
program
  .command('completion <shell>')
  .description('Generate shell completion script')
  .action((shell) => {
    shell = shell.toLowerCase();
    if (shell === 'bash') {
      console.log('# Jules CLI Bash Completion');
      console.log('# Source this file or add to your bashrc/zshrc');
      console.log('_jules_completion() {');
      console.log('  local words cword');
      console.log('  _get_comp_words_by_ref -n =:n words cword');
      console.log('  local completions');
      console.log('  completions="$(jules completions "${words[cword-1]}" "${words[@]}")"');
      console.log('  IFS=$\\n');
      console.log('  read -ra COMPREPLY <<< "$completions"');
      console.log('}');
      console.log('complete -F _jules_completion jules');
    } else if (shell === 'zsh') {
      console.log('# Jules CLI Zsh Completion');
      console.log('# Add to your zshrc:');
      console.log('# autoload -Uz compinit && compinit');
      console.log('# source <(jules completion zsh)');
      console.log('#compdef jules');
      console.log('_jules_completion() {');
      console.log('  local -a completions');
      console.log('  local -a words');
      console.log('  local -i cword');
      console.log('  words=(${(z)LBUFFER})');
      console.log('  cword=$#words');
      console.log('  completions=($(jules completions "${words[cword-1]}" "${words[@]}"))');
      console.log("  _describe -t commands 'jules commands' completions \"$@\"");
      console.log('}');
      console.log('compdef _jules_completion jules');
    } else if (shell === 'fish') {
      console.log('# Jules CLI Fish Completion');
      console.log('# Save to ~/.config/fish/completions/jules.fish');
      console.log('function __jules_completion');
      console.log('  set -l words (commandline -o c)');
      console.log('  set -l cword (count $words)');
      console.log('  set -l completions (jules completions (commandline -ot) $words)');
      console.log('  for completion in $completions');
      console.log('    echo $completion');
      console.log('  end');
      console.log('end');
      console.log('complete -c jules -f -a "__jules_completion"');
    } else {
      console.error(`Unsupported shell: ${shell}`);
      console.log('Supported shells: bash, zsh, fish');
      process.exit(1);
    }
  });

program.parse();