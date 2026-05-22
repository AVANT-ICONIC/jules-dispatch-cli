// Jules API - Session states
export type SessionState =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'WAITING_FOR_INPUT'
  | 'PLAN_READY'
  | 'FAILED';

// Jules API - Automation mode for session creation
export type AutomationMode = 'AUTO_CREATE_PR';

// Jules API - Source (connected GitHub repo)
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

// Jules API - Sessions
export interface GitHubRepoContext {
  startingBranch?: string;
}

export interface SourceContext {
  source?: string;
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
  automationMode?: AutomationMode;
}

export interface ListSessionsResponse {
  sessions: Session[];
  nextPageToken?: string;
}

// Jules API - Activities (discriminated union by key presence)

export interface AgentMessaged {
  agentMessage: string;
}

export interface UserMessaged {
  userMessage: string;
}

export interface PlanStep {
  id: string;
  title: string;
  index?: number;
}

export interface PlanGenerated {
  plan: {
    id: string;
    steps: PlanStep[];
  };
}

export interface PlanApproved {
  planId: string;
}

export interface ProgressUpdated {
  title: string;
  description?: string;
}

export interface BashOutputArtifact {
  bashOutput: {
    command: string;
    output: string;
  };
}

export interface ChangeSetArtifact {
  changeSet: {
    source: string;
    gitPatch: {
      baseCommitId: string;
      unidiffPatch?: string;
    };
  };
}

export type Artifact = BashOutputArtifact | ChangeSetArtifact;

export interface Activity {
  name: string;
  id: string;
  createTime: string;
  originator: 'agent' | 'user';
  // Legacy discriminated union fields (still present in API)
  agentMessaged?: AgentMessaged;
  userMessaged?: UserMessaged;
  // New discriminated union fields (post-January 2026)
  planGenerated?: PlanGenerated;
  planApproved?: PlanApproved;
  progressUpdated?: ProgressUpdated;
  artifacts?: Artifact[];
}

export interface ListActivitiesResponse {
  activities: Activity[];
  nextPageToken?: string;
}

// Jules API - Session create payload (flat object, not nested)
export interface CreateSessionPayload {
  prompt: string;
  sourceContext?: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
}

// Jules API - Send message payload
export interface SendMessagePayload {
  prompt: string;
}

// Jules API - Error shape
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
