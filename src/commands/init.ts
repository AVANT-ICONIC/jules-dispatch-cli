import type { Command } from 'commander';
import { JulesClient } from '../client.ts';
import { errorMessage } from '../output.ts';

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

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard for Jules CLI')
    .action(async () => {
      console.log('Jules CLI Setup Wizard\n');

      const profile = (await ask('Enter profile name (default: default): ')) || 'default';

      const envFile = profile === 'default' ? '.env' : `.env.${profile}`;
      console.log(`\nCreating ${envFile}`);

      const apiKey = await ask('Enter your Jules API key: ');

      if (!apiKey) {
        console.error('API key is required');
        process.exit(1);
      }

      console.log('\nTesting connection...');
      try {
        const response = await new JulesClient(apiKey).listSources();
        console.log(`Connection successful. Found ${response.sources.length} connected source(s).`);
      } catch (error) {
        console.error(`Connection failed: ${errorMessage(error)}`);
        console.log('Please check your API key and try again.');
        process.exit(1);
      }

      await Bun.write(envFile, `JULES_API_KEY=${apiKey}\n`);
      console.log(`Created ${envFile}`);

      console.log('\nSetup complete.');
      if (profile !== 'default') {
        console.log(`To use this profile, run: jules --profile ${profile} <command>`);
      }
      
      const createTemplate = (await ask('\nCreate config template file? (y/N): ')).toLowerCase();
      
      if (createTemplate === 'y' || createTemplate === 'yes') {
        const configTemplate = `# Jules CLI Configuration Template
# Copy to config.json and customize as needed
{
  "version": "1.0",
  "defaultProfile": "${profile}",
  "features": {
    "colorOutput": true,
    "confirmationPrompts": true,
    "autoCreatePr": false
  }
}`;
        
        await Bun.write('config.json.example', configTemplate);
        console.log('Created config.json.example');
      }
    });
}
