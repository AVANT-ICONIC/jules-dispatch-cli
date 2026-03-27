import type {
  ListSourcesResponse,
  ListSessionsResponse,
  Session,
  ListActivitiesResponse,
  CreateSessionPayload,
} from './types.ts';

const BASE_URL = 'https://jules.googleapis.com/v1alpha';

export class JulesClient {
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      'X-Goog-Api-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });
    const data = (await res.json()) as T;
    if (!res.ok) {
      const err = data as any;
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    return data;
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

  listActivities(sessionId: string, pageSize = 20): Promise<ListActivitiesResponse> {
    return this.request(`/sessions/${sessionId}/activities?pageSize=${pageSize}`);
  }
}
