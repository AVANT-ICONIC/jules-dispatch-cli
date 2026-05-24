export interface Config {
  julesApiKey: string;
  profile?: string;
}

async function loadEnvProfile(profile: string): Promise<void> {
  const envPath = `.env.${profile}`;
  const file = Bun.file(envPath);
  if (!(await file.exists())) {
    throw new Error(
      `Profile "${profile}" not found. Create ${envPath} with JULES_API_KEY=your_key.`
    );
  }
  const text = await file.text();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export async function loadConfig(profile?: string): Promise<Config> {
  if (profile) {
    await loadEnvProfile(profile);
  }

  const julesApiKey = process.env.JULES_API_KEY;

  if (!julesApiKey) {
    const envName = profile ? `.env.${profile}` : '.env';
    throw new Error(
      `JULES_API_KEY is not set. Copy .env.example to ${envName} and add your Jules API key.`
    );
  }

  // Validate API key format (basic validation)
  if (!julesApiKey.startsWith('ya29.') && !julesApiKey.startsWith('ya27.')) {
    throw new Error(
      `Invalid JULES_API_KEY format. Expected a Google OAuth2 access token starting with 'ya29.' or 'ya27.'`
    );
  }

  return { julesApiKey, profile };
}