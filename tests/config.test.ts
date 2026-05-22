import { describe, it, expect, afterEach } from 'bun:test';

describe('loadConfig', () => {
  const originalKey = process.env.JULES_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.JULES_API_KEY;
    else process.env.JULES_API_KEY = originalKey;
  });

  it('throws when JULES_API_KEY is missing', async () => {
    delete process.env.JULES_API_KEY;
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig()).toThrow('JULES_API_KEY');
  });

  it('returns config with julesApiKey when set', async () => {
    process.env.JULES_API_KEY = 'test-key';
    const { loadConfig } = await import('../src/config');
    const config = loadConfig();
    expect(config.julesApiKey).toBe('test-key');
  });
});
