import type { Command } from 'commander';
import { loadConfig, Config } from '../config.ts';
import { printJson, printHuman, printError } from '../output.ts';

export function registerConfigCommands(program: Command): void {
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
        // If loadConfig fails, it's likely due to missing API key
        printHuman([
          '⚠️  Configuration incomplete',
          `   Error: ${error.message}`,
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
        printHuman([
          '✅ Configuration is valid',
          `   Profile: ${config.profile || '[default]'}`,
          `   API Key: ${config.julesApiKey ? '[SET]' : '[NOT SET]'}`,
          `   Environment File: ${config.profile ? `.env.${config.profile}` : '.env'}`
        ]);
      } catch (error) {
        printError(`❌ Configuration validation failed: ${error.message}`, 1, false);
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
        printHuman([
          `Environment variables for profile '${profile}':`,
          text.trim() || '(no variables set)'
        ]);
      } catch (error) {
        printError(error.message, 1, false);
      }
    });
}