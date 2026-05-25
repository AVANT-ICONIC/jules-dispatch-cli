import type { Command } from 'commander';
import { readdir, rm } from 'fs/promises';
import { errorMessage, printHuman, printError } from '../output.ts';

async function ask(question: string): Promise<string> {
  process.stdout.write(question);
  process.stdin.resume();
  return new Promise(resolve => {
    process.stdin.once('data', data => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

function redactEnvironment(text: string): string {
  return text.replace(
    /^(\s*[^#=\n]*(?:key|token|secret|password)[^=\n]*\s*=\s*).+$/gim,
    '$1[REDACTED]',
  );
}

export function registerProfileCommands(program: Command): void {
  const profileCmd = program
    .command('profile')
    .description('Manage Jules CLI profiles');

  profileCmd
    .command('list')
    .description('List all available profiles')
    .action(async () => {
      try {
        const files = await readdir('.');
        const envFiles = files.filter(file => 
          file.startsWith('.env.') && file.length > 5
        ).map(file => file.substring(5));
        
        const hasDefault = files.includes('.env');
        
        const profiles = [
          ...envFiles.map(name => ({ name, type: 'custom', file: `.env.${name}` })),
          ...(hasDefault ? [{ name: 'default', type: 'default', file: '.env' }] : [])
        ];

        if (profiles.length === 0) {
          printHuman(['No profiles found. Run `jules init` to create a profile.']);
          return;
        }

        printHuman([
          'Available profiles:',
          ...profiles.map(profile => 
            `  ${profile.name.padEnd(15)} ${profile.type} (${profile.file})`
          ),
          '',
          'Usage:',
          '  jules --profile <name> <command>  # Use specific profile',
          '  jules init                          # Create new profile'
        ]);
      } catch (error) {
        printError(errorMessage(error), 1, false);
      }
    });

  profileCmd
    .command('create <name>')
    .description('Create a new profile')
    .action(async (name: string) => {
      try {
        if (!name || name.trim() === '') {
          printError('Profile name cannot be empty', 1, false);
          return;
        }

        const envFile = `.env.${name}`;
        const Bun = await import('bun');
        const file = Bun.file(envFile);
        if (await file.exists()) {
          printError(`Profile "${name}" already exists at ${envFile}`, 1, false);
          return;
        }

        const content = `# Jules CLI Profile: ${name}
# Add your Jules API key below:
# JULES_API_KEY=your_api_key_here
`;
        await Bun.write(envFile, content);
        
        printHuman([
          `Created profile "${name}" at ${envFile}`,
          '',
          'Next steps:',
          `1. Edit ${envFile} and add your Jules API key`,
          `2. Test the profile: jules --profile ${name} config validate`,
          `3. Use the profile: jules --profile ${name} <command>`
        ]);
      } catch (error) {
        printError(errorMessage(error), 1, false);
      }
    });

  profileCmd
    .command('show <name>')
    .description('Show profile details')
    .action(async (name: string) => {
      try {
        const envFile = `.env.${name}`;
        const Bun = await import('bun');
        const file = Bun.file(envFile);
        
        if (!(await file.exists())) {
          printError(`Profile "${name}" not found at ${envFile}`, 1, false);
          return;
        }
        
        const content = redactEnvironment(await file.text());
        printHuman([
          `Profile: ${name}`,
          `File: ${envFile}`,
          'Contents:',
          content.trim() || '(empty)'
        ]);
      } catch (error) {
        printError(errorMessage(error), 1, false);
      }
    });

  profileCmd
    .command('delete <name>')
    .description('Delete a profile')
    .action(async (name: string) => {
      try {
        if (name === 'default') {
          printError('Cannot delete the default profile. Use config commands to manage .env file directly.', 1, false);
          return;
        }

        const envFile = `.env.${name}`;
        const Bun = await import('bun');
        const file = Bun.file(envFile);
        
        if (!(await file.exists())) {
          printError(`Profile "${name}" not found at ${envFile}`, 1, false);
          return;
        }

        const confirm = (await ask(`Are you sure you want to delete profile "${name}"? (y/N): `)).toLowerCase();

        if (confirm === 'y' || confirm === 'yes') {
          await rm(envFile);
          printHuman([`Deleted profile "${name}"`]);
        } else {
          printHuman(['Profile deletion cancelled.']);
        }
      } catch (error) {
        printError(errorMessage(error), 1, false);
      }
    });
}
