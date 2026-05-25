import type { Command } from 'commander';
import type { ConfigLoader } from '../config.ts';
import { JulesClient } from '../client.ts';
import { errorMessage, printJson, printHuman, printError, stateDisplay, dim } from '../output.ts';
import type { AutomationMode, Session, Activity } from '../types.ts';

const FILTER_STATES = [
  'STATE_UNSPECIFIED',
  'QUEUED',
  'PLANNING',
  'AWAITING_PLAN_APPROVAL',
  'AWAITING_USER_FEEDBACK',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'ALL',
];

async function createClient(loadConfig: ConfigLoader): Promise<JulesClient> {
  const config = await loadConfig();
  return new JulesClient(config.julesApiKey);
}

function automationMode(mode?: string): AutomationMode | undefined {
  if (mode === undefined) return undefined;
  if (mode !== 'AUTO_CREATE_PR') {
    throw new Error('Invalid --automation-mode. Valid value: AUTO_CREATE_PR.');
  }
  return mode;
}

function archiveFilter(value?: string): string | undefined {
  switch (value ?? 'active') {
    case 'active':
      return undefined;
    case 'archived':
      return 'archived = true';
    case 'all':
      return 'archived = true OR archived = false';
    default:
      throw new Error('Invalid --archived value. Valid values: active, archived, all.');
  }
}

function formatSession(s: Session): string {
  const pr = s.outputs?.find(o => o.pullRequest)?.pullRequest;
  const prInfo = pr ? `  ${dim('PR:')} ${pr.url}` : '';
  const repo = s.sourceContext?.source ?? dim('(repoless)');
  return `${stateDisplay(s.state)}  ${dim(s.id)}  ${repo}  ${s.title ?? dim('(no title)')}${prInfo}`;
}

function formatActivity(a: Activity): string {
  const who = a.originator === 'agent' ? 'Jules' : a.originator === 'user' ? 'User' : 'System';
  const time = new Date(a.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const prefix = `${dim(`[${time}]`)} ${who} `;
  
  if (a.planGenerated) {
    return `${prefix}generated plan with ${a.planGenerated.plan.steps.length} steps`;
  }
  if (a.planApproved) {
    return `${prefix}approved the plan`;
  }
  if (a.progressUpdated) {
    const detail = a.progressUpdated.description ? ` - ${a.progressUpdated.description}` : '';
    return `${prefix}updated progress: ${a.progressUpdated.title}${detail}`;
  }
  if (a.agentMessaged) {
    return `${prefix}messaged: "${a.agentMessaged.agentMessage}"`;
  }
  if (a.userMessaged) {
    return `${prefix}messaged: "${a.userMessaged.userMessage}"`;
  }
  if (a.sessionCompleted) {
    return `${prefix}completed the session`;
  }
  if (a.sessionFailed) {
    const detail = a.sessionFailed.reason ? `: ${a.sessionFailed.reason}` : '';
    return `${prefix}reported session failure${detail}`;
  }
  return `${prefix}${a.description ?? 'recorded activity'}`;
}

function formatOutputs(session: Session): string[] {
  if (!session.outputs?.length) return ['(none)'];
  return session.outputs.flatMap(output => {
    if (output.pullRequest) return [`Pull Request: ${output.pullRequest.url}`];
    if (output.changeSet) return ['Change set: git patch available via `sessions outputs`'];
    return [];
  });
}

export function registerSessionsCommands(program: Command, loadConfig: ConfigLoader): void {
  const sessions = program
    .command('sessions')
    .description('Manage Jules sessions');

  // list
  sessions
    .command('list')
    .description('List Jules sessions')
    .option('--repo <owner/repo>', 'Filter by repository')
    .option('--state <state>', `Filter by state: ${FILTER_STATES.join(', ')}`, 'ALL')
    .option('--archived <scope>', 'Session visibility: active, archived, all', 'active')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; state?: string; archived?: string; json?: boolean }) => {
      try {
        const stateValid = !opts.state || FILTER_STATES.includes(opts.state);
        if (opts.state && !stateValid) {
          console.error(`Warning: unknown state "${opts.state}". Valid values: ${FILTER_STATES.join(', ')}. Showing all states.`);
        }

        const client = await createClient(loadConfig);
        const response = await client.listSessions(100, archiveFilter(opts.archived));
        let list = response.sessions;

        if (opts.repo) {
          const sourceId = `sources/github/${opts.repo}`;
          list = list.filter(s => s.sourceContext?.source === sourceId);
        }
        if (opts.state && stateValid && opts.state !== 'ALL') {
          list = list.filter(s => s.state === opts.state);
        }

        if (opts.json) {
          printJson(list);
        } else if (list.length === 0) {
          printHuman(['No sessions found.']);
        } else {
          printHuman(list.map(formatSession));
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // get
  sessions
    .command('get <session-id>')
    .description('Get details and latest activities for a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        const [session, activitiesRes] = await Promise.all([
          client.getSession(sessionId),
          client.listActivities(sessionId, 10),
        ]);
        if (opts.json) {
          printJson({ session, activities: activitiesRes.activities });
        } else {
          const repo = session.sourceContext?.source ?? '(repoless)';
          printHuman([
            `ID:      ${session.id}`,
            `Title:   ${session.title ?? '(no title)'}`,
            `State:   ${session.state}`,
            `Repo:    ${repo}`,
            `Created: ${session.createTime}`,
            `Updated: ${session.updateTime}`,
            `URL:     ${session.url}`,
            '',
            '--- Outputs ---',
            ...formatOutputs(session),
            '',
            '--- Recent Activities ---',
            ...activitiesRes.activities.map(formatActivity),
          ]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // create
  sessions
    .command('create')
    .description('Dispatch a new Jules job')
    .option('--repo <owner/repo>', 'Target repository (omit for repoless session)')
    .requiredOption('--prompt <text>', 'Task description for Jules')
    .option('--branch <branch>', 'Branch to start from', 'main')
    .option('--title <title>', 'Session title')
    .option('--automation-mode <mode>', 'Automation mode: AUTO_CREATE_PR')
    .option('--approve-plan', 'Require plan approval before Jules executes')
    .option('--env-vars', 'Enable environment variables for the session')
    .option('--json', 'Output raw JSON')
    .action(async (opts: {
      repo?: string;
      prompt: string;
      branch: string;
      title?: string;
      automationMode?: string;
      approvePlan?: boolean;
      envVars?: boolean;
      json?: boolean;
    }) => {
      try {
        const client = await createClient(loadConfig);

        const sourceContext = opts.repo
          ? {
              source: `sources/github/${opts.repo}`,
              githubRepoContext: { startingBranch: opts.branch },
              environmentVariablesEnabled: opts.envVars ?? false,
            }
          : undefined;

        const session = await client.createSession({
          prompt: opts.prompt,
          title: opts.title,
          sourceContext,
          requirePlanApproval: opts.approvePlan ?? false,
          automationMode: automationMode(opts.automationMode),
        });

        if (opts.json) {
          printJson({ id: session.id, state: session.state, url: session.url });
        } else {
          const lines = [
            `Session created:`,
            `  ID:    ${session.id}`,
            `  State: ${session.state}`,
            `  Repo:  ${opts.repo ?? '(repoless)'}`,
            `  Title: ${session.title ?? '(no title)'}`,
            `  URL:   ${session.url}`,
          ];
          if (opts.automationMode) {
            lines.push(`  Mode:  ${opts.automationMode}`);
          }
          if (opts.approvePlan) {
            lines.push(
              ``,
              `Plan approval required. Jules will pause at AWAITING_PLAN_APPROVAL state.`,
              `Review and approve with: jules sessions approve ${session.id}`,
            );
          } else {
            lines.push(
              ``,
              `Monitor with: jules sessions get ${session.id}`,
            );
          }
          printHuman(lines);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // message — official :sendMessage endpoint (post-Jan 2026)
  sessions
    .command('message <session-id> <prompt>')
    .description('Send a message/prompt to Jules (official API endpoint)')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, prompt: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        await client.sendMessage(sessionId, prompt);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Message sent to session ${sessionId}.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // reply - compatibility alias for message
  sessions
    .command('reply <session-id> <message>')
    .description('Send a message to Jules (alias for sessions message)')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, message: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        await client.sendMessage(sessionId, message);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Message sent to session ${sessionId}.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // archive
  sessions
    .command('archive <session-id>')
    .description('Archive a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        const session = await client.archiveSession(sessionId);
        if (opts.json) {
          printJson(session);
        } else {
          printHuman([`Session ${sessionId} archived.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // unarchive
  sessions
    .command('unarchive <session-id>')
    .description('Restore an archived session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        const session = await client.unarchiveSession(sessionId);
        if (opts.json) {
          printJson(session);
        } else {
          printHuman([`Session ${sessionId} unarchived.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // delete
  sessions
    .command('delete <session-id>')
    .description('Permanently delete a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        await client.deleteSession(sessionId);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Session ${sessionId} deleted.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // approve
  sessions
    .command('approve <session-id>')
    .description("Approve Jules's plan and let it execute")
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        await client.approvePlan(sessionId);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Plan approved. Jules is now executing session ${sessionId}.`]);
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // activities
  sessions
    .command('activities <session-id>')
    .description('Show the activity log for a session')
    .option('--limit <n>', 'Number of activities to fetch', '20')
    .option('--create-time <timestamp>', 'Only fetch activities created after this ISO timestamp')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { limit?: string; createTime?: string; json?: boolean }) => {
      try {
        const pageSize = Number.parseInt(opts.limit ?? '20', 10);
        if (!Number.isFinite(pageSize) || pageSize < 1) {
          printError(`Invalid --limit "${opts.limit}". Must be a positive number.`, 1, opts.json ?? false);
        }
        const client = await createClient(loadConfig);
        const response = await client.listActivities(sessionId, pageSize, opts.createTime);
        if (opts.json) {
          printJson(response.activities);
        } else if (response.activities.length === 0) {
          printHuman(['No activities yet.']);
        } else {
          printHuman(response.activities.map(formatActivity));
        }
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // outputs — download git patch / file outputs from completed session
  sessions
    .command('outputs <session-id>')
    .description('Download file outputs / git patch from a completed session')
    .option('--output <file>', 'Write git patch to file instead of stdout')
    .option('--json', 'Output raw JSON of session outputs')
    .action(async (sessionId: string, opts: { output?: string; json?: boolean }) => {
      try {
        const client = await createClient(loadConfig);
        const session = await client.getSession(sessionId);

        if (!session.outputs || session.outputs.length === 0) {
          if (opts.json) {
            printJson({ outputs: [] });
          } else {
            printHuman(['No outputs available. Session may still be in progress.']);
          }
          return;
        }

        if (opts.json) {
          printJson(session.outputs);
          return;
        }

        // Find the first changeSet with a git patch
        for (const output of session.outputs) {
          if (output.changeSet?.gitPatch?.unidiffPatch) {
            const patch = output.changeSet.gitPatch.unidiffPatch;
            if (opts.output) {
              await Bun.write(opts.output, patch);
              printHuman([`Git patch written to ${opts.output} (${patch.split('\n').length} lines)`]);
            } else {
              console.log(patch);
            }
            return;
          }
        }

        printHuman(['No git patch found in session outputs.']);
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });

  // run - create a session and poll until completion or an action is required
  sessions
    .command('run')
    .description('Create a session and poll until completion or action is required')
    .option('--repo <owner/repo>', 'Target repository (omit for repoless)')
    .requiredOption('--prompt <text>', 'Task description for Jules')
    .option('--branch <branch>', 'Branch to start from', 'main')
    .option('--title <title>', 'Session title')
    .option('--automation-mode <mode>', 'Automation mode: AUTO_CREATE_PR')
    .option('--approve-plan', 'Require plan approval before Jules executes')
    .option('--env-vars', 'Enable environment variables for the session')
    .option('--poll-interval <seconds>', 'Seconds between polls', '30')
    .option('--timeout <seconds>', 'Max seconds to wait before giving up', '600')
    .option('--json', 'Output raw JSON')
    .action(async (opts: {
      repo?: string;
      prompt: string;
      branch: string;
      title?: string;
      automationMode?: string;
      approvePlan?: boolean;
      envVars?: boolean;
      pollInterval: string;
      timeout: string;
      json?: boolean;
    }) => {
      try {
        const client = await createClient(loadConfig);
        const interval = Math.max(10, Number.parseInt(opts.pollInterval, 10) || 30);
        const timeout = Math.max(30, Number.parseInt(opts.timeout, 10) || 600);

        const sourceContext = opts.repo
          ? {
              source: `sources/github/${opts.repo}`,
              githubRepoContext: { startingBranch: opts.branch },
              environmentVariablesEnabled: opts.envVars ?? false,
            }
          : undefined;

        const session = await client.createSession({
          prompt: opts.prompt,
          title: opts.title,
          sourceContext,
          requirePlanApproval: opts.approvePlan ?? false,
          automationMode: automationMode(opts.automationMode),
        });

        if (!opts.json) {
          printHuman([`Created session ${session.id}. Polling every ${interval}s (timeout: ${timeout}s)...`]);
        }

        const deadline = Date.now() + timeout * 1000;
        const returnStates = new Set([
          'COMPLETED',
          'FAILED',
          'AWAITING_PLAN_APPROVAL',
          'AWAITING_USER_FEEDBACK',
          'PAUSED',
        ]);

        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, interval * 1000));
          const current = await client.getSession(session.id);

          if (returnStates.has(current.state)) {
            const prUrl = current.outputs?.find(o => o.pullRequest)?.pullRequest?.url;

            if (opts.json) {
              printJson({
                sessionId: current.id,
                state: current.state,
                title: current.title,
                prUrl: prUrl ?? null,
                outputs: current.outputs ?? [],
              });
            } else if (current.state === 'COMPLETED') {
              const lines = [
                `Session ${current.id} completed.`,
              ];
              if (prUrl) {
                lines.push(`PR: ${prUrl}`);
              }
              printHuman(lines);
            } else if (current.state === 'FAILED') {
              printHuman([`Session ${current.id} failed.`]);
            } else if (current.state === 'AWAITING_PLAN_APPROVAL') {
              printHuman([
                `Session ${current.id} is awaiting plan approval.`,
                `Review activities, then approve with: jules sessions approve ${current.id}`,
              ]);
            } else if (current.state === 'AWAITING_USER_FEEDBACK') {
              printHuman([
                `Session ${current.id} is awaiting feedback.`,
                `Read activities, then send a message with: jules sessions message ${current.id} "..."`,
              ]);
            } else {
              printHuman([
                `Session ${current.id} is paused.`,
                `Read activities before continuing: jules sessions activities ${current.id}`,
              ]);
            }
            return;
          }

          if (!opts.json) {
            printHuman([`  [${current.state}] polling...`]);
          }
        }

        printError(`Timed out after ${timeout}s. Session ${session.id} has not reached a return state. Check with: jules sessions get ${session.id}`, 1, opts.json ?? false);
      } catch (error) {
        printError(errorMessage(error), 1, opts.json ?? false);
      }
    });
}
