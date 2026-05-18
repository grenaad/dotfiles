/**
 * flow-agent JSONL logger.
 *
 * Writes to ~/.local/share/opencode/log/flow-agent.log
 * One JSON object per line. Best-effort — swallows write failures.
 */

import { appendFile, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import type { FlowLogLine } from "./types"

const LOG_DIR = join(homedir(), ".local", "share", "opencode", "log")
const LOG_PATH = join(LOG_DIR, "flow-agent.log")

let ensured = false

async function ensureDir(): Promise<void> {
  if (ensured) return
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true })
    ensured = true
  } catch {
    /* swallow */
  }
}

/**
 * Distributive `Omit<U, "t">` so each branch of the discriminated union keeps
 * its own field set instead of collapsing to the intersection.
 */
type LogInput = FlowLogLine extends infer U
  ? U extends FlowLogLine
    ? Omit<U, "t"> & { t?: string }
    : never
  : never

export async function log(line: LogInput): Promise<void> {
  try {
    await ensureDir()
    const withTime = { ...line, t: (line as { t?: string }).t ?? new Date().toISOString() }
    await appendFile(LOG_PATH, JSON.stringify(withTime) + "\n", "utf8")
  } catch {
    /* swallow */
  }
}
