import { describe, it, expect, afterEach } from 'bun:test';

describe('loadConfig', () => {
  const originalKey = process.env.JULES_API_KEY;
  const originalUser = process.env.GITHUB_USERNAME;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.JULES_API_KEY;
    else process.env.JULES_API_KEY = originalKey;

    if (originalUser === undefined) delete process.env.GITHUB_USERNAME;
    else process.env.GITHUB_USERNAME = originalUser;
  });

  it('throws when JULES_API_KEY is missing', async () => {
    delete process.env.JULES_API_KEY;
    process.env.GITHUB_USERNAME = 'test-user';
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow('JULES_API_KEY');
  });

  it('throws when GITHUB_USERNAME is missing', async () => {
    process.env.JULES_API_KEY = 'test-key';
    delete process.env.GITHUB_USERNAME;
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow('GITHUB_USERNAME');
  });

  it('returns config when both vars are set', async () => {
    process.env.JULES_API_KEY = 'test-key';
    process.env.GITHUB_USERNAME = 'test-user';
    const { loadConfig } = await import('../src/config');
    const config = loadConfig();
    expect(config.julesApiKey).toBe('test-key');
    expect(config.githubUsername).toBe('test-user');
  });
});
