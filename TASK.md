Do the work yourself. Do not delegate to subagents and do not wait on another agent to report back — this is an unattended run and nothing will arrive. Read the files you need, make the edits, run the commands, and verify in this session.

## CHECKPOINTS — read your mailbox
`MAILBOX.md` in this directory is your mailbox. The operator may append to it
while you run. Read it (`cat MAILBOX.md`) at exactly these two points:
  1. BEFORE you start writing code, once you have read this brief.
  2. AFTER your analysis/verification pass, before you write your report.
If it is empty, continue without comment. Directives, one per line:
  NOTE: <text>       extra context — take it into account and continue.
  REVISE: <text>     the brief changed — adjust what you build before writing.
  ABANDON: <reason>  stop now. Revert every change you made so the tree is
                     clean, then report only the reason. Do not keep working.
Treat any unrecognised non-empty line as a NOTE — never as a silent no-op.
Your report's MAILBOX line must state what you found at each checkpoint.

## The shared checkout
**Never touch /Users/valunex/Desktop/GitHub/apex-nexus and never move it off master.**
A merge daemon merges into HEAD. On 2026-08-29 a lane left that worktree on its
own branch and sixteen gated lanes merged there over 75 minutes while every log
line still said ACCEPT. Work only in your own worktree, named under Workspace below.

This is now ENFORCED, not requested: `.git/hooks/reference-transaction` refuses
a checkout there and logs your pid, cwd and command line. On 2026-09-08 a review
lane read this same paragraph and ran `git checkout <sha> --force` in that
directory anyway; the operator was shown a UI 527 commits behind for 19 minutes.

TO REVIEW AN EXACT HEAD: check it out in YOUR OWN worktree —
  cd <your worktree> && git checkout <sha>          # allowed there, refused in the shared tree
  git worktree add --detach /Users/valunex/Desktop/GitHub/agent-runs/<name>-head <sha>
and run the qualification from there. A brief that names "the primary checkout"
means "a clean checkout of that commit", never that directory.

## Forbidden
commit, push, branch switch, npm install, subagents, modifying any tracked file
not listed under "Files you may modify" below, and weakening, skipping or
quarantining any currently passing test. If an existing test fails, revert your
change rather than adapting the test.
Creating any new file or directory at the repository root. Notes, plans, logs,
reports and commit messages go in $TMPDIR; a new root entry is out of scope and
is deleted by the gate (.greenroom/root-entries.txt is the list).

## Context queries — Graphex, never graft
Use node tools/graphex/cli.mjs for context queries (ask --source, grep, skeleton, callers); do not run the graft CLI. See docs/GRAPHEX.md.
It talks to one shared daemon over a socket in ~/.apex-fleet/graphex, so it costs a lane almost no memory.

## Tracked shell may only shrink
If you edit any `.sh` file, run `node tools/shell-lines.mjs` before you
report. Its ceiling sits at the current total, so a net-added shell line fails
the merge gate (tests/shell-can-only-shrink.test.mjs). Put new logic in a module
under packages/runtime/src with a test and call it from the script, or remove
as many lines from the files you own as you add. Never edit
tools/shell-lines-budget.json to make room.

## Verify — required, paste the real output
```
node tools/lane-precheck.mjs
git status --short
git diff --stat
```
`lane-precheck` is the merge gate's own cheap checks run on YOUR worktree: scope
against .lane-owners, syntax, the changelog fragment the brief names, tombstones,
new lines that turn an unreadable input into 0/false, and the exact tests the
gate selects PLUS the ratchet suites it keeps finding red (tests that read
scripts, shell-can-only-shrink, exports-with-no-caller, nothing-new-is-unreachable).
Those rejected 92 lanes as "suite is not green" and nothing imports them, so
choosing tests by "names a file I touched" never reaches them. Exit 0 is ready;
1 is a defect to fix; 2 is a check that could not read, which is not a pass:
say so in RISKS. It also lists what the review stage sends a lane back for (a
file outside your list, a missing value shown as zero, a test that agrees with
itself). Leave your work UNCOMMITTED; a clean tree is rejected as "nothing to
commit". Run it again after your last edit, not before.
You may still run single tests by hand:
`node scripts/run-tests.mjs tests/a.test.mjs tests/b.test.mjs`.
Do NOT run the whole suite. It is 8758 files on a machine running every other
lane, it cannot tell you anything about your change that a scoped run cannot,
and the merge gate runs the scoped suite before merging and the full suite
after. Spending your turns there is how a two-minute task becomes two hours.
If you cannot work out which tests your change reaches, say so in the report
and name what you ran instead.

## Filing an idea (optional)
Something worth building outside this task? Do not build it. Write it to
`.idea-proposal.json` in your worktree root:
  {"title": "...", "summary": "...", "killShot": "...", "cheapestTest": "..."}
All four required: killShot = the objection that kills it, cheapestTest = the
cheapest check that proves it wrong. Filed under your lane; never in your diff.

## Agency (worker)
Do exactly what the brief says, nothing more. Prove it: run the named tests and show the output. On failure after 3 attempts, stop and report what you tried, the exact error and where. Never delete, rename or rewrite anything the brief doesn't name.
Making a test pass never means changing the test, the assertion or the check. If the check is wrong, say so and stop.

------------------------------------------------------------------------
Everything above is the same, byte for byte, for every lane of this agency
level cut from this master commit. Your own task, workspace, files and report format follow.
------------------------------------------------------------------------

# [mechanical] End exhausted429 retries without an extra sleep
Assigned 2026-10-21T08:57:44.016Z under issue3482/code-optimizer. Repo AVANT-ICONIC/jules-dispatch-cli, root /Users/valunex/Desktop/GitHub/jules-dispatch-cli. Write only src/client.ts, tests/client-retry.test.mjs and README.md. No OpenSpec root exists here; do not initialize one. Existing AGENTS prerequisite to call the live Jules CLI is overridden by this run's no-provider/no-credential rule. Do not read .env or config, call sources list, start sessions, or send requests.
MEASURED real JulesClient.listSources with stub fetch and fake setTimeout:4fetches, delays[1000,2000,4000,8000],15000ms scheduled, zero actual sleeps/network. The fourth429 cannot retry but still schedules8s and says retrying. Goal4fetches, delays[1000,2000,4000],7000ms scheduled, honest terminal rate-limit error. Preserve successful retry behavior and existing API.
Use the real public client with a literal fake key, injected/global fetch and timer stubs restored in finally. Node22.23.2 can strip this module's erasable TypeScript. Add focused node:test regression tests/client-retry.test.mjs; run only node --test tests/client-retry.test.mjs. Do not run Bun's suite or live CLI. Prove test red on original and green after; include429-then-success and exhausted429. No real network, clock waits or children. Target<=10ms/case,<=200msCPU/file,<=8MiB fixtures. Update README retry description. Check live branch/claim owners before edits, worktree under approved apex work-home/worktrees only. Leave lane output uncommitted for its gate.

RULES (absolute): Never run /usr/bin/security, read or dump the macOS keychain, or look for tokens or passwords anywhere. Every gh and git push uses HOME=/Users/valunex. A gh or push 401/403 means stop immediately and end GAVE UP: auth. Never force push, git add -A, git add ., git stash, git worktree remove/prune, or gh pr merge. Land only through ~/.apex-fleet/instant-land. Work only in an assigned worktree under /Users/valunex/Desktop/GitHub/apex-nexus-work/worktrees; never commit in Marc's /Users/valunex/Desktop/GitHub/apex-nexus checkout. Run only touched tests with Node 22.23.2 node --test <files>, never the full suite or scripts/run-tests.mjs. Never launch Google Chrome or read Chrome profiles. Never read, list or scan ~/Music, ~/Pictures, ~/Movies, ~/Library, ~/Documents or the home folder as a whole. Disk checks only inside ~/Desktop/GitHub, ~/.apex-fleet and ~/Library/Caches by name. Never touch ~/Downloads, ~/Desktop/GitHub/amon or ~/amon-cloud-backup. Never edit ~/.apex-fleet/fleet-power.json or any slider. No jobs on codex-bob or claude-bob; Scion and bob-* branches stay Bob's. HelloGen generation and port 8765 are forbidden. No asc, xcodebuild, uploads, ~/.appstoreconnect, *.p8 or *.p12. No AI attribution in commits.
Do not delegate agents or launch provider jobs.

## FINDINGS — one write outside this brief
If you notice a real defect outside your files, do not fix it and do not stop
for it: append it to `.ledger/findings/perf-jules-terminal-429-delay.md`. That path is always in scope
and nothing else is. One `## ` heading per finding, naming the FILE, then ONE
line saying what is wrong, then an `EVIDENCE:` line — a command, a line number
or a measurement. A finding missing any of those three is refused unread.

## Workspace
`/Users/valunex/Desktop/GitHub/agent-runs/night01/projects/jules-dispatch-cli/gen-perf-jules-terminal-429-delay` — branch `night01-gen-perf-jules-terminal-429-delay`, cut from master.

## Files you may modify
- `src/client.ts`
- `tests/client-retry.test.mjs`
- you may ADD new files under `tests/`

## Report exactly
TASK: gen-perf-jules-terminal-429-delay
DECISION: DONE | ALREADY-COVERED | NOT-NEEDED
FILES MODIFIED:
TESTS: (real pass/fail counts)
MAILBOX: (empty at both checkpoints | the directives found and what you did)
RISKS:
