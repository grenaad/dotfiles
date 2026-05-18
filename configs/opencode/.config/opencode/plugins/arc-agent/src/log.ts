/**
 * Append-only JSONL logger for arc-agent.
 * Writes to ~/.local/share/opencode/log/arc-agent.log
 * Never throws; failures are silent (logger must not break workflow).
 */

import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"

import type { LogLine } from "./types"

const LOG_DIR = join(homedir(), ".local/share/opencode/log")
const LOG_FILE = join(LOG_DIR, "arc-agent.log")

let ensured = false

async function ensureLogDir(): Promise<void> {
  if (ensured) return
  try {
    await mkdir(LOG_DIR, { recursive: true })
    ensured = true
  } catch {
    /* swallow */
  }
}

export async function log(line: LogLine): Promise<void> {
  try {
    await ensureLogDir()
    const entry: LogLine = { ...line, t: new Date().toISOString() }
    await appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8")
  } catch {
    /* swallow — logger must never break the plugin */
  }
}

/** Background log; intentionally fire-and-forget. */
export function logBackground(line: LogLine): void {
  void log(line)
}
