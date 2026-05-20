/**
 * v0.23 — Plan posture loader.
 *
 * Why this lives in the plugin rather than under agents/:
 * --------------------------------------------------------
 * OpenCode has a built-in `plan` primary-mode agent (invokable via
 * `opencode --agent plan`). Dropping an `agents/plan.md` file shadows that
 * built-in — breaking the user's top-level Opus-led planning workflow.
 *
 * The arc-agent orchestrator's plan step calls `task(subagent_type=plan)`,
 * which would resolve to the same shadowed file. So instead of taking over
 * the agent name, we inject the cognitive posture via the plugin's
 * `tool.execute.before` hook (analogous to how the structural template is
 * already injected from `templates.ts`).
 *
 * The rendered plan prompt order:
 *   1. DELEGATION_PREAMBLE + REASONING_CONVENTIONS (plugin)
 *   2. PLAN_POSTURE (this module — plugin)
 *   3. orchestrator's task body (recall directives, threaded outputs)
 *   4. per-task-type structural template (plugin, templates.ts)
 *
 * The posture body lives in `prompts/plan-posture.md` (human-readable,
 * easy to iterate without editing TypeScript). This module reads it once
 * at first access and caches it for the process lifetime.
 *
 * Failure mode: if the file is missing or unreadable, we fall back to an
 * empty string and log to stderr. The plan still runs (with template +
 * preamble only) — the posture is an enhancement, not a hard requirement.
 */

import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const POSTURE_FILENAME = "plan-posture.md"
const PROMPTS_DIR_NAME = "prompts"

/**
 * Marker placed at the top of the loaded posture (after the frontmatter-
 * style header in the .md). The hook uses this marker to avoid double-
 * injection if the posture is somehow already in the prompt.
 */
export const PLAN_POSTURE_MARKER = "PLAN POSTURE — load-bearing decisions"

let cachedPosture: string | null = null
let loadAttempted = false

/**
 * Locate the prompts directory relative to this source file. At runtime the
 * plugin loads from `plugins/arc-agent/src/plan-posture.ts` (when run via
 * tsx) — the prompts dir is one level up.
 *
 * Falls back to CWD-relative path if `import.meta.url` is unavailable in the
 * runtime (defensive).
 */
function resolvePosturePath(): string {
  try {
    const here = fileURLToPath(import.meta.url)
    const srcDir = dirname(here)
    const pluginRoot = dirname(srcDir)
    return join(pluginRoot, PROMPTS_DIR_NAME, POSTURE_FILENAME)
  } catch {
    return join("plugins", "arc-agent", PROMPTS_DIR_NAME, POSTURE_FILENAME)
  }
}

/**
 * Read the posture body from disk. Strips the file's own preamble
 * (everything before the first `## Posture` heading) — that preamble is
 * documentation about WHERE this content runs, not content the planner
 * should see in its prompt.
 */
function loadPosture(): string {
  if (cachedPosture !== null) return cachedPosture
  if (loadAttempted) return ""
  loadAttempted = true

  try {
    const path = resolvePosturePath()
    const raw = readFileSync(path, "utf8")
    // Strip the file header (everything before the first `## Posture` heading).
    // The header documents that this is plugin-injected; it shouldn't appear
    // in the rendered prompt.
    const postureStart = raw.indexOf("## Posture")
    const body = postureStart >= 0 ? raw.slice(postureStart) : raw
    cachedPosture = `${PLAN_POSTURE_MARKER}\n\n${body.trim()}\n`
    return cachedPosture
  } catch (err) {
    // Best-effort: log and continue without the posture. Plan still runs.
    // eslint-disable-next-line no-console
    console.error(
      `[arc-agent] plan-posture load failed: ${(err as Error).message}. Plan will run with template + preamble only.`,
    )
    cachedPosture = ""
    return ""
  }
}

/**
 * Public accessor. Returns the posture body (with marker prefix) or "" if
 * the file could not be loaded. Caller must concat with their own
 * separator if they want spacing.
 */
export function getPlanPosture(): string {
  return loadPosture()
}

/**
 * Test-only reset. Used by unit smokes to force a re-read after editing
 * the posture file under test fixtures.
 */
export function _resetPlanPostureCache(): void {
  cachedPosture = null
  loadAttempted = false
}
