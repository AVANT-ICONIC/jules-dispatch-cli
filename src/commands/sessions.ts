import type { Command } from 'commander';
import type { Config } from '../config.ts';
import { JulesClient } from '../client.ts';
import { printJson, printHuman, printError } from '../output.ts';
import type { Session, Activity } from '../types.ts';

function formatSession(s: Session): string {
  const pr = s.outputs?.find(o => o.pullRequest)?.pullRequest;
  const prInfo = pr ? `  PR: ${pr.url}` : '';
  const repo = s.sourceContext.source ?? '(repoless)';
  return `[${s.state}]  ${s.id}  ${repo}  ${s.title ?? '(no title)'}${prInfo}`;
}

function formatActivity(a: Activity): string {
  const who = a.originator === 'agent' ? 'Jules' : 'User ';
  let msg = '';

  if (a.planGenerated) {
    const steps = a.planGenerated.plan.steps.map(s => s.title).join('; ');
    msg = `Plan generated (${a.planGenerated.plan.steps.length} steps): ${steps}`;
  } else if (a.planApproved) {
    msg = `Plan approved: ${a.planApproved.planId}`;
  } else if (a.progressUpdated) {
    msg = a.progressUpdated.description
      ? `${a.progressUpdated.title}: ${a.progressUpdated.description}`
      : a.progressUpdated.title;
  } else if (a.agentMessaged) {
    msg = a.agentMessaged.agentMessage;
  } else if (a.userMessaged) {
    msg = a.userMessaged.userMessage;
  } else {
    msg = '(unknown activity type)';
  }

  const preview = msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
  return `[${a.createTime}] ${who}: ${preview}`;
}

export function registerSessionsCommands(program: Command, config: Config): void {
  const sessions = program
    .command('sessions')
    .description('Manage Jules sessions');

  // list
  sessions
    .command('list')
    .description('List Jules sessions')
    .option('--repo <owner/repo>', 'Filter by repository')
    .option('--state <state>', 'Filter by state: IN_PROGRESS, COMPLETED, WAITING_FOR_INPUT, PLAN_READY, FAILED, ALL', 'ALL')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; state?: string; json?: boolean }) => {
      try {
        const VALID_STATES = ['IN_PROGRESS', 'COMPLETED', 'WAITING_FOR_INPUT', 'PLAN_READY', 'FAILED', 'ALL'];
        const stateValid = !opts.state || VALID_STATES.includes(opts.state);
        if (opts.state && !stateValid) {
          console.error(`Warning: unknown state "${opts.state}". Valid values: ${VALID_STATES.join(', ')}. Showing all states.`);
        }

        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSessions(100);
        let list = response.sessions;

        if (opts.repo) {
          const sourceId = `sources/github/${opts.repo}`;
          list = list.filter(s => s.sourceContext.source === sourceId);
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
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // get
  sessions
    .command('get <session-id>')
    .description('Get details and latest activities for a session')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const [session, activitiesRes] = await Promise.all([
          client.getSession(sessionId),
          client.listActivities(sessionId, 10),
        ]);
        if (opts.json) {
          printJson({ session, activities: activitiesRes.activities });
        } else {
          const repo = session.sourceContext.source ?? '(repoless)';
          printHuman([
            `ID:      ${session.id}`,
            `Title:   ${session.title ?? '(no title)'}`,
            `State:   ${session.state}`,
            `Repo:    ${repo}`,
            `Updated: ${session.updateTime}`,
            `URL:     ${session.url}`,
            '',
            '--- Recent Activities ---',
            ...activitiesRes.activities.map(formatActivity),
          ]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
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
        const client = new JulesClient(config.julesApiKey);

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
          automationMode: opts.automationMode as any,
        });

        if (opts.json) {
          printJson({ id: session.id, state: session.state, url: session.url });
        } else {
          const lines = [
            `Session created:`,
            `  ID:    ${session.id}`,
            `  State: ${session.state}`,
            `  URL:   ${session.url}`,
          ];
          if (opts.automationMode) {
            lines.push(`  Mode:  ${opts.automationMode}`);
          }
          if (opts.approvePlan) {
            lines.push(
              ``,
              `Plan approval required. Jules will pause at PLAN_READY state.`,
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
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // message — official :sendMessage endpoint (post-Jan 2026)
  sessions
    .command('message <session-id> <prompt>')
    .description('Send a message/prompt to Jules (official API endpoint)')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, prompt: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        await client.sendMessage(sessionId, prompt);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Message sent to session ${sessionId}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // reply — legacy endpoint, kept for backwards compatibility
  sessions
    .command('reply <session-id> <message>')
    .description('Send a message to Jules (legacy endpoint)')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, message: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        await client.replyToSession(sessionId, message);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Message sent to session ${sessionId}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // approve
  sessions
    .command('approve <session-id>')
    .description("Approve Jules's plan and let it execute")
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        await client.approvePlan(sessionId);
        if (opts.json) {
          printJson({ ok: true, sessionId });
        } else {
          printHuman([`Plan approved. Jules is now executing session ${sessionId}.`]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
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
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listActivities(sessionId, pageSize, opts.createTime);
        if (opts.json) {
          printJson(response.activities);
        } else if (response.activities.length === 0) {
          printHuman(['No activities yet.']);
        } else {
          printHuman(response.activities.map(formatActivity));
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });
}
