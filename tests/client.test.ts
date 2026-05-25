import { describe, it, expect, spyOn, afterEach } from 'bun:test';
import { JulesClient } from '../src/client';

const BASE = 'https://jules.googleapis.com/v1alpha';

function mockFetch(body: unknown, ok = true) {
  const text = async () => JSON.stringify(body);
  return spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    text,
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
      `${BASE}/sources?pageSize=100`,
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

  it('listSessions passes an archive filter when supplied', async () => {
    const spy = mockFetch({ sessions: [] });
    const client = new JulesClient('my-key');
    await client.listSessions(100, 'archived = true');
    expect(spy.mock.calls[0][0]).toBe(
      `${BASE}/sessions?pageSize=100&filter=archived+%3D+true`,
    );
  });

  it('listSources fetches subsequent pages', async () => {
    const spy = spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ sources: [{ name: 'sources/one' }], nextPageToken: 'next' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ sources: [{ name: 'sources/two' }] }),
      } as Response);
    const client = new JulesClient('my-key');
    const result = await client.listSources();
    expect(result.sources).toHaveLength(2);
    expect(spy.mock.calls[1][0]).toBe(`${BASE}/sources?pageSize=100&pageToken=next`);
  });

  it('createSession sends flat payload (no session wrapper)', async () => {
    const spy = mockFetch({ id: '123', name: 'sessions/123' });
    const client = new JulesClient('my-key');
    await client.createSession({
      prompt: 'do the thing',
      sourceContext: { source: 'sources/github/owner/repo' },
    });
    const callBody = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody).toHaveProperty('prompt', 'do the thing');
    expect(callBody).not.toHaveProperty('session');
  });

  it('throws on non-ok response with API error message', async () => {
    mockFetch({ error: { code: 400, message: 'Bad field', status: 'INVALID_ARGUMENT' } }, false);
    const client = new JulesClient('bad-key');
    await expect(client.listSources()).rejects.toThrow('Bad field');
  });

  it('sendMessage POSTs to the official custom method', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.sendMessage('sess-1', 'hello Jules');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/sessions/sess-1:sendMessage`,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.prompt).toBe('hello Jules');
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

  it('supports documented archive, unarchive and delete methods', async () => {
    const spy = mockFetch({});
    const client = new JulesClient('my-key');
    await client.archiveSession('sess-3');
    await client.unarchiveSession('sess-3');
    await client.deleteSession('sess-3');
    expect(spy.mock.calls[0][0]).toBe(`${BASE}/sessions/sess-3:archive`);
    expect(spy.mock.calls[1][0]).toBe(`${BASE}/sessions/sess-3:unarchive`);
    expect(spy.mock.calls[2][0]).toBe(`${BASE}/sessions/sess-3`);
    expect((spy.mock.calls[2][1] as RequestInit).method).toBe('DELETE');
  });

  it('uses an AIP-160 filter for incremental activities', async () => {
    const spy = mockFetch({ activities: [] });
    const client = new JulesClient('my-key');
    await client.listActivities('sess-4', 5, '2026-05-26T00:00:00Z');
    expect(spy.mock.calls[0][0]).toBe(
      `${BASE}/sessions/sess-4/activities?pageSize=5&filter=create_time+%3E+%222026-05-26T00%3A00%3A00Z%22`,
    );
  });
});
