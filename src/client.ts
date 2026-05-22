import type {
  ListSourcesResponse,
  ListSessionsResponse,
  Session,
  ListActivitiesResponse,
  CreateSessionPayload,
  SendMessagePayload,
} from './types.ts';

const BASE_URL = 'https://jules.googleapis.com/v1alpha';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class JulesClient {
  private readonly headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      'X-Goog-Api-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...this.headers, ...options.headers },
      });

      if (res.status === 429) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        lastError = new Error(`Rate limited. Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Jules API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error?.message ?? `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return data as T;
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  listSources(): Promise<ListSourcesResponse> {
    return this.request('/sources');
  }

  listSessions(pageSize = 50): Promise<ListSessionsResponse> {
    return this.request(`/sessions?pageSize=${pageSize}`);
  }

  getSession(sessionId: string): Promise<Session> {
    return this.request(`/sessions/${sessionId}`);
  }

  createSession(payload: CreateSessionPayload): Promise<Session> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Send a message to Jules via the :sendMessage endpoint (official API, post-Jan 2026). */
  sendMessage(sessionId: string, prompt: string): Promise<unknown> {
    const payload: SendMessagePayload = { prompt };
    return this.request(`/sessions/${sessionId}:sendMessage`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** @deprecated Legacy reply endpoint. Prefer sendMessage for new integrations. */
  replyToSession(sessionId: string, message: string): Promise<unknown> {
    return this.request(`/sessions/${sessionId}/activities`, {
      method: 'POST',
      body: JSON.stringify({ userMessaged: { userMessage: message } }),
    });
  }

  approvePlan(sessionId: string): Promise<unknown> {
    return this.request(`/sessions/${sessionId}:approvePlan`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  listActivities(
    sessionId: string,
    pageSize = 20,
    createTime?: string,
  ): Promise<ListActivitiesResponse> {
    let path = `/sessions/${sessionId}/activities?pageSize=${pageSize}`;
    if (createTime) {
      path += `&createTime=${encodeURIComponent(createTime)}`;
    }
    return this.request(path);
  }
}
