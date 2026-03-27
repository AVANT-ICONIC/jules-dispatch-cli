import { describe, it, expect, spyOn, afterEach } from 'bun:test';
import { JulesClient } from '../src/client';

const BASE = 'https://jules.googleapis.com/v1alpha';

function mockFetch(body: unknown, ok = true) {
  return spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

describe('JulesClient', () => {
  afterEach(() => {
    (globalThis.fetch as ReturnType<typeof spyOn>).mockRestore?.();
  });

  it('listSources sends correct header and URL', async () => {
    const spy = mockFetch({ sources: [] });
    const client = new JulesClient('my-key');
    await client.listSources();
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sources`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'my-key' }),
      })
    );
  });

  it('listSessions sends correct URL with pageSize', async () => {
    const spy = mockFetch({ sessions: [] });
    const client = new JulesClient('my-key');
    await client.listSessions(10);
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions?pageSize=10`,
      expect.anything()
    );
  });

  it('createSession wraps payload in { session: ... }', async () => {
    const spy = mockFetch({ id: '123', name: 'sessions/123' });
    const client = new JulesClient('my-key');
    await client.createSession({
      session: {
        prompt: 'do the thing',
        sourceContext: { source: 'sources/github/owner/repo' },
      },
    });
    const callBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody).toHaveProperty('session.prompt', 'do the thing');
  });

  it('throws on non-ok response with API error message', async () => {
    mockFetch({ error: { code: 400, message: 'Bad field', status: 'INVALID_ARGUMENT' } }, false);
    const client = new JulesClient('bad-key');
    await expect(client.listSources()).rejects.toThrow('Bad field');
  });

  it('replyToSession POSTs userMessaged activity', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.replyToSession('sess-1', 'hello Jules');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions/sess-1/activities`,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.userMessaged.userMessage).toBe('hello Jules');
  });

  it('approvePlan POSTs to :approvePlan endpoint', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.approvePlan('sess-2');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions/sess-2:approvePlan`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});
