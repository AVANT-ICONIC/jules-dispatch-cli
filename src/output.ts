/**
 * Output utilities for agent-first CLI.
 * Commands receive --json as a Commander option and pass it explicitly
 * to these functions — no global state.
 */

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
export function printError(message: string, code = 1, json = false): never {
  if (json) {
    console.error(JSON.stringify({ error: message, code }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(code);
}
