// Jules API — Session states
export type SessionState =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'WAITING_FOR_INPUT'
  | 'PLAN_READY'
  | 'FAILED';

// Jules API — Source (connected GitHub repo)
export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  defaultBranch?: { displayName: string };
  branches?: Array<{ displayName: string }>;
}

export interface Source {
  name: string;
  id: string;
  githubRepo: GitHubRepo;
}

export interface ListSourcesResponse {
  sources: Source[];
  nextPageToken?: string;
}

// Jules API — Sessions
export interface GitHubRepoContext {
  startingBranch?: string;
}

export interface SourceContext {
  source: string;
  githubRepoContext?: GitHubRepoContext;
  environmentVariablesEnabled?: boolean;
}

export interface GitPatch {
  unidiffPatch: string;
  baseCommitId: string;
  suggestedCommitMessage: string;
}

export interface PullRequestOutput {
  url: string;
  title: string;
  description: string;
  baseRef: string;
  headRef: string;
}

export interface SessionOutput {
  changeSet?: { source: string; gitPatch: GitPatch };
  pullRequest?: PullRequestOutput;
}

export interface Session {
  name: string;
  id: string;
  title?: string;
  createTime: string;
  updateTime: string;
  state: SessionState;
  sourceContext: SourceContext;
  prompt: string;
  url: string;
  outputs?: SessionOutput[];
}

export interface ListSessionsResponse {
  sessions: Session[];
  nextPageToken?: string;
}

// Jules API — Activities (discriminated union by key presence)
export interface AgentMessaged {
  agentMessage: string;
}

export interface UserMessaged {
  userMessage: string;
}

export interface Activity {
  name: string;
  id: string;
  createTime: string;
  originator: 'agent' | 'user';
  agentMessaged?: AgentMessaged;
  userMessaged?: UserMessaged;
}

export interface ListActivitiesResponse {
  activities: Activity[];
  nextPageToken?: string;
}

// Jules API — Session create payload (flat object, not nested)
export interface CreateSessionPayload {
  prompt: string;
  sourceContext: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
}

// Jules API — Error shape
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
