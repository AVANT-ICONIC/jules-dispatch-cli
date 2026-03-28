import type { Command } from 'commander';
import type { Config } from '../config.ts';
import { JulesClient } from '../client.ts';
import { printJson, printHuman, printError } from '../output.ts';
import type { Session, Activity } from '../types.ts';

function formatSession(s: Session): string {
  const pr = s.outputs?.find(o => o.pullRequest)?.pullRequest;
  const prInfo = pr ? `  PR: ${pr.url}` : '';
  return `[${s.state}]  ${s.id}  ${s.title ?? '(no title)'}${prInfo}`;
}

function formatActivity(a: Activity): string {
  const who = a.originator === 'agent' ? 'Jules' : 'User ';
  const msg = a.agentMessaged?.agentMessage ?? a.userMessaged?.userMessage ?? '(no message)';
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
        if (opts.state && !VALID_STATES.includes(opts.state)) {
          printError(`Invalid --state "${opts.state}". Valid values: ${VALID_STATES.join(', ')}`, 1, opts.json ?? false);
        }

        const client = new JulesClient(config.julesApiKey);
        const response = await client.listSessions(100);
        let list = response.sessions;

        if (opts.repo) {
          const sourceId = `sources/github/${opts.repo}`;
          list = list.filter(s => s.sourceContext.source === sourceId);
        }
        if (opts.state && opts.state !== 'ALL') {
          list = list.filter(s => s.state === opts.state);
        }

        if (opts.json) {
          printJson(list);
        } else {
          if (list.length === 0) {
            printHuman(['No sessions found.']);
          } else {
            printHuman(list.map(formatSession));
          }
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
          printHuman([
            `ID:      ${session.id}`,
            `Title:   ${session.title ?? '(no title)'}`,
            `State:   ${session.state}`,
            `Repo:    ${session.sourceContext.source}`,
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
    .requiredOption('--repo <owner/repo>', 'Target repository (e.g. AVANT-ICONIC/my-repo)')
    .requiredOption('--prompt <text>', 'Task description for Jules')
    .option('--branch <branch>', 'Branch to start from', 'main')
    .option('--title <title>', 'Session title')
    .option('--approve-plan', 'Require plan approval before Jules executes')
    .option('--json', 'Output raw JSON')
    .action(async (opts: {
      repo: string;
      prompt: string;
      branch: string;
      title?: string;
      approvePlan?: boolean;
      json?: boolean;
    }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const session = await client.createSession({
          prompt: opts.prompt,
          title: opts.title,
          requirePlanApproval: opts.approvePlan ?? false,
          sourceContext: {
            source: `sources/github/${opts.repo}`,
            githubRepoContext: { startingBranch: opts.branch },
          },
        });
        if (opts.json) {
          printJson({ id: session.id, state: session.state, url: session.url });
        } else {
          printHuman([
            `Session created:`,
            `  ID:    ${session.id}`,
            `  State: ${session.state}`,
            `  URL:   ${session.url}`,
            ``,
            `Monitor with: jules sessions get ${session.id}`,
          ]);
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });

  // reply
  sessions
    .command('reply <session-id> <message>')
    .description('Send a message to Jules in a session')
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
    .option('--json', 'Output raw JSON')
    .action(async (sessionId: string, opts: { limit?: string; json?: boolean }) => {
      try {
        const client = new JulesClient(config.julesApiKey);
        const response = await client.listActivities(sessionId, parseInt(opts.limit ?? '20', 10));
        if (opts.json) {
          printJson(response.activities);
        } else {
          if (response.activities.length === 0) {
            printHuman(['No activities yet.']);
          } else {
            printHuman(response.activities.map(formatActivity));
          }
        }
      } catch (e: any) {
        printError(e.message, 1, opts.json ?? false);
      }
    });
}
