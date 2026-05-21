/**
 * v0.25.1 unit smoke — integrated orchestrator plugin surface.
 *
 * Asserts:
 *   1. CEILINGS has exactly 5 keys (the survivor set).
 *   2. SubagentType union accepts each survivor; rejects deprecated names.
 *   3. NOTE_TYPES has exactly 4 entries (no prediction/insufficiency/etc).
 *   4. measurePlanQuality() returns the v0.25.1 4-signal shape.
 *   5. extractTaskType() handles the orchestrator's plan output shapes.
 *   6. hasPlanHeading() detects Plan-class headings.
 *   7. normalizeVerdict() canonicalizes review verdicts.
 *   8. extractOpenQuestions() handles `## Open Decisions`.
 *   9. workflow-memory append/recall/getFull round-trip for orchestrator + survivors.
 *  10. plan-quality detects falsification + load-bearing refs in real plans.
 *
 * Run: npx tsx src/__smoke__/v0.25-integrated.ts
 * Exits 0 on success, 1 on any failure.
 */

import {
  extractOpenQuestions,
  extractTaskType,
  hasPlanHeading,
  normalizeVerdict,
} from "../analyzers"
import { measurePlanQuality } from "../plan-quality"
import { appendEntry, appendNote, createMemory, getFull, recall } from "../workflow-memory"
import {
  CEILINGS,
  NOTE_TYPES,
  NOTE_TYPE_AUTHORIZATION,
  NOTE_TYPE_VALUES,
  TASK_TYPE_VALUES,
  WRITE_NOTE_SUBAGENTS,
  isSubagent,
} from "../types"

type AssertionResult = { name: string; ok: boolean; detail?: string }
const results: AssertionResult[] = []

function assert(name: string, cond: boolean, detail?: string): void {
  results.push({ name, ok: cond, detail })
  if (!cond) console.error(`  ✗ ${name}${detail ? `\n     ${detail}` : ""}`)
  else console.log(`  ✓ ${name}`)
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`)
}

// --- Stage 1: type-level constants ------------------------------------------

section("Stage 1: CEILINGS + SubagentType")

const SURVIVORS = [
  "review",
  "critic",
  "confidence-auditor",
  "cost-checker",
  "falsifier",
] as const

assert("CEILINGS has exactly 5 keys", Object.keys(CEILINGS).length === 5,
  `actual: ${JSON.stringify(Object.keys(CEILINGS))}`)
for (const s of SURVIVORS) {
  assert(`isSubagent("${s}") === true`, isSubagent(s))
}

const DEPRECATED = [
  "frame", "librarian", "explore", "synthesis", "spike", "restater",
  "alternatives", "delta-mapper", "ambiguity-spotter", "edgecases",
  "batch-planner", "scope-guard", "expectation-keeper", "unknowns-auditor",
  "frame-validity-check", "skeptic", "assumption-ledger", "decision-options",
  "plan",
]
for (const s of DEPRECATED) {
  assert(`isSubagent("${s}") === false (deprecated)`, !isSubagent(s))
}

// --- Stage 2: NOTE_TYPES + authorization ------------------------------------

section("Stage 2: NOTE_TYPES + authorization")

assert("NOTE_TYPES has exactly 4 entries", Object.keys(NOTE_TYPES).length === 4)
assert("NOTE_TYPE_VALUES === observation/concern/pattern/retraction",
  NOTE_TYPE_VALUES.length === 4 &&
  NOTE_TYPE_VALUES.includes("observation") &&
  NOTE_TYPE_VALUES.includes("concern") &&
  NOTE_TYPE_VALUES.includes("pattern") &&
  NOTE_TYPE_VALUES.includes("retraction"))

// Deprecated note types must NOT be present.
for (const t of ["prediction", "insufficiency", "contradiction", "assumption", "unknown"]) {
  assert(`NOTE_TYPES has no "${t}"`, !((t as string) in NOTE_TYPES))
}

assert("WRITE_NOTE_SUBAGENTS has 5 members", WRITE_NOTE_SUBAGENTS.size === 5)
for (const s of SURVIVORS) {
  const allowed = NOTE_TYPE_AUTHORIZATION[s]
  assert(`${s} has note authorization`, allowed !== undefined && allowed.length > 0)
}

// --- Stage 3: analyzers -----------------------------------------------------

section("Stage 3: analyzers")

assert("TASK_TYPE_VALUES has 5 entries",
  TASK_TYPE_VALUES.length === 5 &&
  ["feature", "fix", "refactor", "investigate", "docs"].every((t) =>
    (TASK_TYPE_VALUES as readonly string[]).includes(t)))

// extractTaskType: heading variants
assert("extractTaskType heading: feature", extractTaskType(`## Task Type\nfeature`) === "feature")
assert("extractTaskType inline: fix", extractTaskType(`Task Type: fix`) === "fix")
assert("extractTaskType bold inline", extractTaskType(`**Task Type**: refactor`) === "refactor")
assert("extractTaskType missing returns null", extractTaskType(`no task type here`) === null)

// hasPlanHeading
assert("hasPlanHeading: # Plan", hasPlanHeading(`# Plan\nbody`))
assert("hasPlanHeading: ## Plan", hasPlanHeading(`## Plan\nbody`))
assert("hasPlanHeading: # Plan: title", hasPlanHeading(`# Plan: foo\nbody`))
assert("hasPlanHeading: # Diagnosis & Fix Plan", hasPlanHeading(`# Diagnosis & Fix Plan`))
assert("hasPlanHeading: # Recommendation", hasPlanHeading(`# Recommendation`))
assert("hasPlanHeading: empty -> false", !hasPlanHeading(``))
assert("hasPlanHeading: no plan -> false", !hasPlanHeading(`# Something Else`))

// normalizeVerdict
assert("normalizeVerdict: proceed", normalizeVerdict(`## Verdict\nproceed`) === "proceed")
assert("normalizeVerdict: needs-revision", normalizeVerdict(`## Verdict\nneeds-revision`) === "needs-revision")
assert("normalizeVerdict: reject", normalizeVerdict(`## Verdict\nreject`) === "reject")
assert("normalizeVerdict: missing returns null", normalizeVerdict(`no verdict here`) === null)

// extractOpenQuestions
assert("extractOpenQuestions: bullets", extractOpenQuestions(`## Open Decisions\n- foo?\n- bar?`).length === 2)
assert("extractOpenQuestions: empty -> []", extractOpenQuestions(`# Plan\nbody`).length === 0)

// --- Stage 4: plan-quality --------------------------------------------------

section("Stage 4: plan-quality signals")

const GOOD_PLAN = `## What you asked for
- bullets

## Architecture Decisions
| Decision | Pick | Reasoning |
|---|---|---|
| approach | Lock | per app/cache.py:18 |

## Implementation Steps
1. Edit app/cache.py:19 to remove the await.

## Falsification
Wrong if: pytest tests/test_cache.py:1 fails after the change.`

const q1 = measurePlanQuality(GOOD_PLAN, "fix")
assert("plan-quality good: load_bearing_refs >= 1", q1.loadBearingRefs >= 1,
  `actual: ${q1.loadBearingRefs}`)
assert("plan-quality good: grounded true", q1.grounded)
assert("plan-quality good: checkable_wrong_if true", q1.checkableWrongIf)
assert("plan-quality good: no forbidden phrases", q1.forbiddenPhraseCount === 0)
assert("plan-quality good: no oversized", q1.oversizedSections.length === 0)

const BAD_PLAN = `## What you asked for
- bullets

## Architecture Decisions
The cleaner separation makes this more maintainable and easier to reason about.
Different domain — best practice.

## Falsification
Wrong if: the design is wrong.`

const q2 = measurePlanQuality(BAD_PLAN, "feature")
assert("plan-quality bad: forbidden phrases counted", q2.forbiddenPhraseCount >= 3,
  `actual: ${q2.forbiddenPhraseCount}`)
assert("plan-quality bad: checkable_wrong_if false", !q2.checkableWrongIf)
assert("plan-quality bad: not grounded", !q2.grounded)

// --- Stage 5: workflow-memory ----------------------------------------------

section("Stage 5: workflow-memory")

const memory = createMemory()
assert("createMemory: empty entries", memory.entries.length === 0)
assert("createMemory: empty notes", memory.notes.length === 0)

const e1 = appendEntry(memory, { subagent: "orchestrator", output: "## Plan\nfoo" })
assert("appendEntry orchestrator", e1.id === "orchestrator-001")
assert("appendEntry recorded size", e1.size === "## Plan\nfoo".length)

const e2 = appendEntry(memory, { subagent: "review", output: "## Verdict\nproceed" })
assert("appendEntry review", e2.id === "review-002")

const n1 = appendNote(memory, {
  author: "orchestrator",
  type: "observation",
  topic: "pattern-found",
  content: "Found similar pattern in app/cache.py:18",
})
assert("appendNote orchestrator", n1.ok === true)

const n2 = appendNote(memory, {
  author: "review",
  type: "concern",
  topic: "missing-test",
  content: "No regression test for the fix",
})
assert("appendNote review/concern", n2.ok === true)

const nReject = appendNote(memory, {
  // @ts-expect-error -- testing runtime rejection of deprecated author
  author: "frame",
  type: "observation",
  topic: "x",
  content: "y",
})
assert("appendNote rejects deprecated author 'frame'", nReject.ok === false)

const nWrongType = appendNote(memory, {
  author: "falsifier",
  type: "observation", // falsifier only allowed concern
  topic: "x",
  content: "y",
})
assert("appendNote rejects falsifier writing observation", nWrongType.ok === false)

// recall
const hits = recall(memory, { kind: "both" })
assert("recall returns 2 entries + 2 notes = 4 (capped by default limit 5)",
  hits.length === 4, `actual: ${hits.length}`)

const hitOrch = recall(memory, { subagent: "orchestrator", kind: "entry" })
assert("recall by subagent=orchestrator", hitOrch.length === 1)

// getFull
const full = getFull(memory, "orchestrator-001")
assert("getFull entry", full.kind === "entry")
assert("getFull miss", getFull(memory, "missing-000").kind === "miss")

// --- Summary ---------------------------------------------------------------

const total = results.length
const passed = results.filter((r) => r.ok).length
const failed = total - passed
console.log(`\n${passed}/${total} assertions passed`)
if (failed > 0) {
  console.error(`${failed} FAILED`)
  process.exit(1)
}
console.log("PASS")
