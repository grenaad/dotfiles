/**
 * v0.23 E2E smoke — shared assertions against the JSONL log file.
 *
 * The E2E smokes are invoked manually via the PTY MCP tool against a
 * throwaway fixture directory. After the opencode run completes, this
 * module is invoked with the parent sessionID + expected task type +
 * fixture name; it reads ~/.local/share/opencode/log/arc-agent.log,
 * filters to lines from the run, and asserts plan-quality + cognitive-
 * loop signals are present.
 *
 * Run via:
 *   bunx tsx src/__smoke__/v0.23-e2e-assertions.ts <session_id> <fixture>
 *
 *   <fixture> is one of: feature | fix | investigate
 *
 * Exits 0 on all assertions passing, 1 otherwise. Prints PASS/FAIL summary.
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const LOG_PATH = join(homedir(), ".local/share/opencode/log/arc-agent.log")

interface LogLine {
  kind: string
  session: string
  t: string
  [k: string]: unknown
}

function readSessionLogs(sessionPrefix: string): LogLine[] {
  const text = readFileSync(LOG_PATH, "utf8")
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  const parsed: LogLine[] = []
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as LogLine
      // Match the parent session AND child sessions (which share the prefix
      // structure when nested via task() — but for safety we widen to any
      // session containing the parent's id substring).
      if (
        typeof obj.session === "string" &&
        (obj.session === sessionPrefix || obj.session.startsWith(sessionPrefix.slice(0, 12)))
      ) {
        parsed.push(obj)
      }
    } catch {
      // skip malformed
    }
  }
  return parsed
}

type AssertionResult = { name: string; ok: boolean; detail?: string }
const results: AssertionResult[] = []

function assert(name: string, cond: boolean, detail?: string): void {
  results.push({ name, ok: cond, detail })
  if (!cond) {
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${name}${detail ? `\n     ${detail}` : ""}`)
  } else {
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`)
  }
}

function section(title: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${title} ===`)
}

const sessionID = process.argv[2]
const fixture = process.argv[3] as "feature" | "fix" | "investigate" | undefined

if (!sessionID || !fixture) {
  // eslint-disable-next-line no-console
  console.error("Usage: v0.23-e2e-assertions.ts <session_id> <feature|fix|investigate>")
  process.exit(2)
}

if (!["feature", "fix", "investigate"].includes(fixture)) {
  // eslint-disable-next-line no-console
  console.error(`Invalid fixture: ${fixture}. Must be feature | fix | investigate.`)
  process.exit(2)
}

const logs = readSessionLogs(sessionID)

section(`v0.23 E2E assertions — fixture=${fixture}, session=${sessionID}`)

// --- Universal assertions (all fixtures) ----------------------------------

section("Universal: pipeline ran")

const memoryUninitialized = logs.filter(
  (l) => l.kind === "workflow.note.memory-uninitialized",
)
assert(
  "0 memory-uninitialized failures (v0.22 regression check)",
  memoryUninitialized.length === 0,
  `got ${memoryUninitialized.length}`,
)

const stanceLogs = logs.filter((l) => l.kind === "workflow.stance")
assert("workflow.stance logged (orchestrator engaged)", stanceLogs.length >= 1)

// --- Plan-quality assertions ----------------------------------------------

section("Plan quality (v0.23 instrumentation)")

const planQualityLogs = logs.filter((l) => l.kind === "workflow.plan.quality")
assert(
  "workflow.plan.quality logged at least once",
  planQualityLogs.length >= 1,
  `got ${planQualityLogs.length}`,
)

if (planQualityLogs.length >= 1) {
  const last = planQualityLogs[planQualityLogs.length - 1] as LogLine & {
    task_type: string
    load_bearing_refs: number
    grounded: boolean
    checkable_wrong_if: boolean
    forbidden_phrase_count: number
    oversized_sections: string[]
    ungrounded_insufficiencies: number
    contradiction_acknowledged: boolean
  }

  // Expected task_type by fixture
  const expectedTaskType =
    fixture === "feature" ? "feature" : fixture === "fix" ? "fix" : "investigate"
  assert(
    `plan task_type === ${expectedTaskType}`,
    last.task_type === expectedTaskType,
    `got ${last.task_type}`,
  )

  // Grounded: feature + fix should have file:line refs; investigate may be docs-only and forgiven.
  if (fixture === "feature" || fixture === "fix") {
    assert(
      `${fixture}: load_bearing_refs >= 1 (plan references concrete files)`,
      last.load_bearing_refs >= 1,
      `got ${last.load_bearing_refs}`,
    )
  } else {
    // investigate is allowed 0 refs (it's a recommendation, not an implementation)
    assert(
      "investigate: load_bearing_refs >= 0 (informational only)",
      last.load_bearing_refs >= 0,
    )
  }

  // Checkable Wrong-if expected on all task types per plan.md
  assert(
    `${fixture}: checkable_wrong_if === true (Wrong-if names verifiable condition)`,
    last.checkable_wrong_if === true,
    `wrong_if check failed; consult plan output`,
  )

  // Forbidden phrases should be 0 with v0.23 plan.md installed; allow up to 1
  // in v0.23 as a softer initial threshold (deepseek may slip occasionally).
  assert(
    `${fixture}: forbidden_phrase_count <= 1 (plan.md forbidden-pattern discipline)`,
    last.forbidden_phrase_count <= 1,
    `got ${last.forbidden_phrase_count}`,
  )

  // Oversized sections: warn at >0 but don't hard-fail (length contract is
  // advisory in v0.23).
  if (last.oversized_sections.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `    ⚠ oversized sections (advisory): [${last.oversized_sections.join(", ")}]`,
    )
  }
  assert(
    `${fixture}: oversized_sections present in log (field shape check)`,
    Array.isArray(last.oversized_sections),
  )

  // Contradiction acknowledgment: required true when predictionsContradicted > 0,
  // vacuously true otherwise. We can't know predictionsContradicted from logs
  // directly, but workflow.prediction.reconciled logs report contradicted count.
  const reconciled = logs
    .filter((l) => l.kind === "workflow.prediction.reconciled")
    .map((l) => l as LogLine & { contradicted: number })
  const lastReconciled = reconciled[reconciled.length - 1]
  const hadContradictions =
    lastReconciled !== undefined && lastReconciled.contradicted > 0
  if (hadContradictions) {
    assert(
      `${fixture}: contradiction_acknowledged === true (had ${lastReconciled.contradicted} contradictions)`,
      last.contradiction_acknowledged === true,
    )
  } else {
    assert(
      `${fixture}: contradiction_acknowledged === true (vacuous — 0 contradictions)`,
      last.contradiction_acknowledged === true,
    )
  }
}

// --- Per-fixture cognitive-loop assertions --------------------------------

if (fixture === "fix") {
  section("Fix-specific: failure-chain")
  const fcLogs = logs.filter((l) => l.kind === "workflow.failure-chain.declared")
  assert(
    "workflow.failure-chain.declared logged",
    fcLogs.length >= 1,
    `got ${fcLogs.length}`,
  )
  if (fcLogs.length >= 1) {
    const fc = fcLogs[fcLogs.length - 1] as LogLine & {
      confirmations: number
      has_root_cause: boolean
    }
    assert(
      "fix: confirmations >= 2 (non-tautological corroborations)",
      fc.confirmations >= 2,
      `got ${fc.confirmations}`,
    )
    assert("fix: has_root_cause === true", fc.has_root_cause === true)
  }
}

if (fixture === "feature") {
  section("Feature-specific: prediction-observation loop")
  const predictions = logs.filter(
    (l) => l.kind === "workflow.prediction.declared" || l.kind === "workflow.note.fallback-parsed",
  )
  assert(
    "feature: predictions emitted (declared or fallback-parsed)",
    predictions.length >= 1,
    `got ${predictions.length}`,
  )
}

if (fixture === "investigate") {
  section("Investigate-specific: task type captured")
  const tt = logs
    .filter((l) => l.kind === "tool.execute.after")
    .find((l) => (l as LogLine & { task_type?: string }).task_type === "investigate")
  assert(
    "investigate: task_type captured at tool.execute.after",
    tt !== undefined,
  )
}

// --- Summary -------------------------------------------------------------

const passed = results.filter((r) => r.ok).length
const total = results.length
// eslint-disable-next-line no-console
console.log(`\n${passed}/${total} assertions passed`)
if (passed === total) {
  // eslint-disable-next-line no-console
  console.log("PASS")
  process.exit(0)
} else {
  // eslint-disable-next-line no-console
  console.error(`FAIL: ${total - passed} assertion(s) failed`)
  process.exit(1)
}
