import type { Command } from 'commander';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard for Jules CLI')
    .action(async () => {
      console.log('🔧 Jules CLI Setup Wizard\n');

      // Ask for profile name
      const profile = await new Promise<string>((resolve) => {
        process.stdout.write('Enter profile name (default: default): ');
        const stdin = process.openStdin();
        stdin.addListener('data', (data) => {
          const answer = data.toString().trim();
          resolve(answer || 'default');
          stdin.pause();
        });
      });

      const envFile = `.env.${profile}`;
      console.log(`\n📝 Creating ${envFile}`);

      // Ask for Jules API key
      const apiKey = await new Promise<string>((resolve) => {
        process.stdout.write('Enter your Jules API key: ');
        const stdin = process.openStdin();
        stdin.addListener('data', (data) => {
          const answer = data.toString().trim();
          resolve(answer);
          stdin.pause();
        });
      });

      if (!apiKey) {
        console.error('❌ API key is required');
        process.exit(1);
      }

      // Validate API key format
      if (!apiKey.startsWith('ya29.') && !apiKey.startsWith('ya27.')) {
        console.log('⚠️  Warning: API key does not look like a valid Google OAuth2 token');
        console.log('   (should start with ya29. or ya27.)');
        const confirm = await new Promise<string>((resolve) => {
          process.stdout.write('Continue anyway? (y/N): ');
          const stdin = process.openStdin();
          stdin.addListener('data', (data) => {
            const answer = data.toString().trim().toLowerCase();
            resolve(answer);
            stdin.pause();
          });
        });
        
        if (confirm !== 'y' && confirm !== 'yes') {
          console.log('Setup cancelled.');
          process.exit(1);
        }
      }

      // Write .env file
      const Bun = await import('bun');
      await Bun.write(envFile, `JULES_API_KEY=${apiKey}\n`);

      console.log(`✅ Created ${envFile}`);

      // Test connection
      console.log('\n🔍 Testing connection...');
      try {
        // Import and test config loading
        const { loadConfig } = await import('../config.ts');
        await loadConfig(profile);
        console.log('✅ Connection successful!');
      } catch (error) {
        console.error(`❌ Connection failed: ${error.message}`);
        console.log('Please check your API key and try again.');
        process.exit(1);
      }

      console.log('\n🎉 Setup complete!');
      console.log(`To use this profile, run: jules --profile ${profile} <command>`);
      console.log('To set as default, copy the file to .env or rename it.');
      
      // Offer to create config template
      const createTemplate = await new Promise<string>((resolve) => {
        process.stdout.write('\nCreate config template file? (y/N): ');
        const stdin = process.openStdin();
        stdin.addListener('data', (data) => {
          const answer = data.toString().trim().toLowerCase();
          resolve(answer);
          stdin.pause();
        });
      });
      
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
        console.log('✅ Created config.json.example');
      }
    });
}