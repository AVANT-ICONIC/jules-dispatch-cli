/**
 * Output utilities for agent-first CLI.
 * Commands receive --json as a Commander option and pass it explicitly
 * to these functions - no global state.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

/** Map session state to color + emoji for human output */
export function stateDisplay(state: string): string {
  switch (state) {
    case 'IN_PROGRESS':    return `${BLUE}⟳ IN_PROGRESS${RESET}`;
    case 'COMPLETED':      return `${GREEN}✓ COMPLETED${RESET}`;
    case 'FAILED':         return `${RED}✗ FAILED${RESET}`;
    case 'WAITING_FOR_INPUT': return `${YELLOW}? WAITING_FOR_INPUT${RESET}`;
    case 'PLAN_READY':     return `${CYAN}📋 PLAN_READY${RESET}`;
    default:               return `${DIM}${state}${RESET}`;
  }
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}

/** Machine-readable output (agent mode). Compact single-line JSON. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

/** Human-readable output. Prints one line per entry. */
export function printHuman(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}

/**
 * Print an error and exit non-zero.
 * In json mode: JSON to stderr. Otherwise: plain text to stderr.
 */
export function printError(message: string, code: number, json: boolean): never {
  if (json) {
    console.error(JSON.stringify({ error: message, code }));
  } else {
    console.error(`${RED}Error:${RESET} ${message}`);
  }
  process.exit(code);
}
