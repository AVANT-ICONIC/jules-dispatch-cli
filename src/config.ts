export interface Config {
  julesApiKey: string;
  githubUsername: string;
}

export function loadConfig(): Config {
  const julesApiKey = process.env.JULES_API_KEY;
  const githubUsername = process.env.GITHUB_USERNAME;

  if (!julesApiKey) {
    throw new Error(
      'JULES_API_KEY is not set. Copy .env.example to .env and add your Jules API key.'
    );
  }
  if (!githubUsername) {
    throw new Error(
      'GITHUB_USERNAME is not set. Copy .env.example to .env and add your GitHub username.'
    );
  }

  return { julesApiKey, githubUsername };
}
