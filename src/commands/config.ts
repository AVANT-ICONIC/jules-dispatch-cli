import type { Command } from 'commander';
import type { ConfigLoader } from '../config.ts';
import { JulesClient } from '../client.ts';
import { errorMessage, printJson, printHuman, printError } from '../output.ts';

function redactEnvironment(text: string): string {
  return text.replace(
    /^(\s*[^#=\n]*(?:key|token|secret|password)[^=\n]*\s*=\s*).+$/gim,
    '$1[REDACTED]',
  );
}

export function registerConfigCommands(program: Command, loadConfig: ConfigLoader): void {
  const configCmd = program
    .command('config')
    .description('Manage Jules CLI configuration');

  configCmd
    .command('list')
    .description('List current configuration')
    .action(async () => {
      try {
        const config = await loadConfig();
        printJson({
          julesApiKey: config.julesApiKey ? '[SET]' : '[NOT SET]',
          profile: config.profile || '[default]',
          envFile: config.profile ? `.env.${config.profile}` : '.env'
        });
      } catch (error) {
        printHuman([
          'Configuration incomplete',
          `   Error: ${errorMessage(error)}`,
          '',
          'To set up your configuration, run:',
          '   jules init'
        ]);
      }
    });

  configCmd
    .command('validate')
    .description('Validate current configuration')
    .action(async () => {
      try {
        const config = await loadConfig();
        const response = await new JulesClient(config.julesApiKey).listSources();
        printHuman([
          'Configuration is valid',
          `   Profile: ${config.profile || '[default]'}`,
          `   API Key: ${config.julesApiKey ? '[SET]' : '[NOT SET]'}`,
          `   Environment File: ${config.profile ? `.env.${config.profile}` : '.env'}`,
          `   Connected Sources: ${response.sources.length}`,
        ]);
      } catch (error) {
        printError(`Configuration validation failed: ${errorMessage(error)}`, 1, false);
      }
    });

  configCmd
    .command('env <profile>')
    .description('Show environment variables for a profile')
    .action(async (profile: string) => {
      try {
        const envPath = `.env.${profile}`;
        const Bun = await import('bun');
        const file = Bun.file(envPath);
        
        if (!(await file.exists())) {
          printError(`Profile "${profile}" not found. Create ${envPath} with JULES_API_KEY=your_key.`, 1, false);
          return;
        }
        
        const text = await file.text();
        const redacted = redactEnvironment(text);
        printHuman([
          `Environment variables for profile '${profile}':`,
          redacted.trim() || '(no variables set)'
        ]);
      } catch (error) {
        printError(errorMessage(error), 1, false);
      }
    });
}
