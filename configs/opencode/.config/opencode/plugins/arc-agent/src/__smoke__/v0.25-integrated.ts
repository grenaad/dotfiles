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
import { buildHooks } from "../hooks"
import { measurePlanQuality } from "../plan-quality"
import { clearState, getState } from "../state"
import { appendEntry, appendNote, createMemory, getFull, recall } from "../workflow-memory"
import { detectAndPersistViolations } from "../violation-pipeline"
import {
  CEILINGS,
  NOTE_TYPES,
  NOTE_TYPE_AUTHORIZATION,
  NOTE_TYPE_VALUES,
  TASK_TYPE_VALUES,
  WRITE_NOTE_SUBAGENTS,
  isSubagent,
} from "../types"
import { detectViolations, __internals as detectorInternals } from "../violation-detector"
import type { createOpencodeClient } from "@opencode-ai/sdk"
import { mkdirSync, rmSync } from "node:fs"

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

// v0.26: CEILINGS expanded from 5 → 7 with violation-driven auditors.
assert("CEILINGS has at least 5 v0.25 survivor keys", Object.keys(CEILINGS).length >= 5,
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

// v0.26: WRITE_NOTE_SUBAGENTS expanded from 5 → 7 (added unverified-auditor + compound-cause-auditor).
assert("WRITE_NOTE_SUBAGENTS has at least 5 v0.25 survivors", WRITE_NOTE_SUBAGENTS.size >= 5)
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

// --- Stage 6: v0.26 violation detector ------------------------------------

section("Stage 6: v0.26 violation-detector")

// 6a. Helpers — stripFencedBlocks, hasHeading, isToolUnavailabilityPlan.
const FENCED_PLAN = `## Foo
\`\`\`
## What I couldn't verify
\`\`\`
## Bar`
const stripped = detectorInternals.stripFencedBlocks(FENCED_PLAN)
assert("stripFencedBlocks removes inline heading-like content from fence",
  !detectorInternals.hasHeading(stripped, "What I couldn't verify"),
  `stripped: ${JSON.stringify(stripped)}`)

assert("hasHeading detects ## level", detectorInternals.hasHeading("## Findings\n", "Findings"))
assert("hasHeading detects ### level", detectorInternals.hasHeading("### Findings\n", "Findings"))
assert("hasHeading rejects #### level",
  !detectorInternals.hasHeading("#### Findings\n", "Findings"))
assert("hasHeading rejects mid-line", !detectorInternals.hasHeading("some ## Findings", "Findings"))

assert("isToolUnavailabilityPlan detects Tool unavailability heading",
  detectorInternals.isToolUnavailabilityPlan("## Tool unavailability\nfoo"))
assert("isToolUnavailabilityPlan detects Provisional findings heading",
  detectorInternals.isToolUnavailabilityPlan("## Provisional findings (without Datadog)\nfoo"))
assert("isToolUnavailabilityPlan rejects regular plan",
  !detectorInternals.isToolUnavailabilityPlan("## Findings\nfoo"))

// 6b. detectMissingUnverifiedSection
const PLAN_NO_UNVERIFIED = `## What you asked for
- foo

## Assumptions
1. foo

## Findings
✅ x app/foo.py:10
🔶 y app/bar.py:20

## Falsification
Wrong if: bar fails.

## Open Decisions for the user
1. baz?`
const v_no_unv = detectViolations(PLAN_NO_UNVERIFIED, "fix")
assert("detect missing-unverified-section fires",
  v_no_unv.some((v) => v.kind === "missing-unverified-section"))

const PLAN_HAS_UNVERIFIED = PLAN_NO_UNVERIFIED + "\n\n## What I couldn't verify\n- nothing"
const v_has_unv = detectViolations(PLAN_HAS_UNVERIFIED, "fix")
assert("detect missing-unverified-section does NOT fire when section present",
  !v_has_unv.some((v) => v.kind === "missing-unverified-section"))

// 6c. detectUniformMarkerNoEscapeNote
const PLAN_UNIFORM = `## Findings
✅ a app/a.py:1
✅ b app/b.py:2
✅ c app/c.py:3

## Falsification
Wrong if: foo.`
const v_unif = detectViolations(PLAN_UNIFORM, "fix")
assert("detect uniform-marker-no-escape-note fires on 3 uniform ✅",
  v_unif.some((v) => v.kind === "uniform-marker-no-escape-note"))

const PLAN_UNIFORM_WITH_ESCAPE = PLAN_UNIFORM.replace(
  "## Findings\n",
  "## Findings\n*All items above are direct-evidence ✅; no inferences emerged.*\n\n",
)
// Note: the escape note must appear within the section body.
const PLAN_UNIFORM_ESCAPE_INLINE = `## Findings
✅ a app/a.py:1
✅ b app/b.py:2
✅ c app/c.py:3

*All items above are direct-evidence ✅; no inferences emerged.*

## Falsification
Wrong if: foo.`
const v_unif_escape = detectViolations(PLAN_UNIFORM_ESCAPE_INLINE, "fix")
assert("detect uniform-marker-no-escape-note does NOT fire when escape note present",
  !v_unif_escape.some((v) => v.kind === "uniform-marker-no-escape-note"))

const PLAN_DISTINCT = `## Findings
✅ a app/a.py:1
🔶 b inferred
⚠️ c risky

## Falsification
Wrong if: foo.`
const v_dist = detectViolations(PLAN_DISTINCT, "fix")
assert("detect uniform-marker does NOT fire on distinct markers",
  !v_dist.some((v) => v.kind === "uniform-marker-no-escape-note"))

// 6d. detectCompoundCausesNoNotes
const PLAN_COMPOUND = `## Findings
✅ Root cause 1 — **Memory exhaustion** at \`ps:36\`. The compressor is at 6.5GB.
✅ Root cause 2 — **Stale opencode sessions** at \`ps:8-20\`. 12 processes using 3GB RSS.
✅ Root cause 3 — **MetaTrader wine** at \`ps:5\`. 123% CPU.

## Falsification
Wrong if: x.`
const v_comp = detectViolations(PLAN_COMPOUND, "fix")
assert("detect compound-causes fires on multiple root-cause N",
  v_comp.some((v) => v.kind === "compound-causes-no-notes-section"))

const PLAN_COMPOUND_WITH_NOTES = PLAN_COMPOUND + "\n\n## Compound-failure notes\nfoo"
const v_comp_with = detectViolations(PLAN_COMPOUND_WITH_NOTES, "fix")
assert("detect compound-causes does NOT fire when notes section present",
  !v_comp_with.some((v) => v.kind === "compound-causes-no-notes-section"))

const PLAN_SINGLE_CAUSE = `## Findings
✅ The bug is in app/foo.py:42. The function returns None when input is empty.
🔶 Adding a guard at line 41 should fix it.

## Falsification
Wrong if: x.`
const v_single = detectViolations(PLAN_SINGLE_CAUSE, "fix")
assert("detect compound-causes does NOT fire on single cause",
  !v_single.some((v) => v.kind === "compound-causes-no-notes-section"))

// 6e. Tool-unavailability short plans are exempt from all detectors
const PLAN_TOOL_UNAVAIL = `## Tool unavailability
- You asked me to query Datadog; I don't have it.

## Provisional findings (without Datadog)
⚠️ The error is likely X based on code at app.py:10.

## Falsification
Wrong if: the actual log shows Y.

## Open Decisions for the user
1. Share the log?`
const v_tu = detectViolations(PLAN_TOOL_UNAVAIL, "fix")
assert("Tool-unavailability plans skip all detectors",
  v_tu.length === 0,
  `actual violations: ${JSON.stringify(v_tu)}`)

// 6f. Severity ordering (high → med → low)
const PLAN_ALL_VIOLATIONS = `## What you asked for
- foo

## Assumptions
1. foo

## Findings
✅ Root cause 1 — bad config app/a.py:1
✅ Root cause 2 — race app/b.py:2
✅ Root cause 3 — typo app/c.py:3

## Falsification
Wrong if: x.`
const v_all = detectViolations(PLAN_ALL_VIOLATIONS, "fix")
assert("detect returns multiple violations sorted by severity",
  v_all.length >= 2 && v_all[0]!.severity === "high",
  `got: ${JSON.stringify(v_all.map((v) => v.kind))}`)

// 6g. CEILINGS has the 2 new auditors
assert("CEILINGS includes unverified-auditor",
  "unverified-auditor" in CEILINGS)
assert("CEILINGS includes compound-cause-auditor",
  "compound-cause-auditor" in CEILINGS)
assert("isSubagent accepts unverified-auditor",
  isSubagent("unverified-auditor"))
assert("isSubagent accepts compound-cause-auditor",
  isSubagent("compound-cause-auditor"))

// 6h. NOTE_TYPE_AUTHORIZATION includes new auditors
assert("NOTE_TYPE_AUTHORIZATION includes unverified-auditor",
  NOTE_TYPE_AUTHORIZATION["unverified-auditor"] !== undefined)
assert("NOTE_TYPE_AUTHORIZATION includes compound-cause-auditor",
  NOTE_TYPE_AUTHORIZATION["compound-cause-auditor"] !== undefined)

// 6i. CEILINGS now has 7 entries (was 5)
assert("CEILINGS has 7 entries after v0.26", Object.keys(CEILINGS).length === 7,
  `actual: ${JSON.stringify(Object.keys(CEILINGS))}`)

// --- Stage 7: v0.26.1 violation pipeline + text-complete hook ---------------

section("Stage 7: v0.26.1 violation pipeline")

const LONG_PLAN_ALL_VIOLATIONS = `# Plan

## What you asked for
- Diagnose why the service is slow and propose a fix.

## Assumptions
1. The captured process list represents steady-state load.
   - If wrong, the CPU/RSS attribution may change.
2. The current failing symptom is caused by local resource pressure.
   - If wrong, the remediation needs logs from the upstream service.

## Findings
✅ Root cause 1 — **Memory exhaustion** at \`ps:36\`. The compressor is at 6.5GB RSS and forces swapping under normal load.
✅ Root cause 2 — **Stale opencode sessions** at \`ps:8-20\`. Twelve processes remain alive and collectively consume multiple GB of RSS.
✅ Root cause 3 — **MetaTrader wine CPU saturation** at \`ps:5\`. The process uses 123% CPU while the editor is also generating.

## Implementation Steps
1. Kill stale sessions and verify RSS drops.
2. Add a session-cleanup guard.
3. Re-run the workload and confirm CPU/RSS stay under threshold.

## Falsification
Wrong if: after killing stale sessions, RSS remains above 8GB and CPU remains above 100% for 5 minutes.

## Open Decisions for the user
1. Should the cleanup guard be automatic or manual?

${Array.from({ length: 80 }, (_, i) => `Detail line ${i}: extra body text keeps this above the mechanical hook threshold.`).join("\n")}`

clearState("smoke-v0261-pipeline")
const pipelineState = getState("smoke-v0261-pipeline")
const pipelineResult = await detectAndPersistViolations({
  sessionID: "smoke-v0261-pipeline",
  state: pipelineState,
  plan: LONG_PLAN_ALL_VIOLATIONS,
  taskType: "fix",
  source: "experimental.text.complete",
})
const pipelineTopics = pipelineState.workflowMemory?.notes.map((n) => n.topic) ?? []
assert("violation pipeline detects all three violations",
  pipelineResult.violations.length === 3,
  `actual: ${JSON.stringify(pipelineResult.violations.map((v) => v.kind))}`)
assert("violation pipeline caps telemetry notes at 2",
  pipelineResult.dispatched.length === 2 && pipelineState.workflowMemory?.notes.length === 2,
  `dispatched=${JSON.stringify(pipelineResult.dispatched)} notes=${pipelineState.workflowMemory?.notes.length}`)
assert("violation pipeline writes high+med violation topics",
  pipelineTopics.includes("violation:compound-causes-no-notes-section") &&
    pipelineTopics.includes("violation:missing-unverified-section"),
  `topics=${JSON.stringify(pipelineTopics)}`)
assert("violation pipeline marks workflow as detected", pipelineState.violationsDetected === true)

const fakeClient = {
  session: {
    get: async ({ path }: { path: { id: string } }) => ({ data: { id: path.id } }),
  },
} as unknown as ReturnType<typeof createOpencodeClient>
const hooks = buildHooks(fakeClient)

clearState("smoke-v0261-text-hook")
await hooks["experimental.text.complete"]?.(
  { sessionID: "smoke-v0261-text-hook", messageID: "m1", partID: "p1" },
  { text: LONG_PLAN_ALL_VIOLATIONS },
)
const textHookState = getState("smoke-v0261-text-hook")
assert("text-complete hook runs mechanical detection",
  textHookState.violationsDetected === true)
assert("text-complete hook writes capped violation notes",
  textHookState.workflowMemory?.notes.length === 2,
  `notes=${textHookState.workflowMemory?.notes.length}`)

const normalizeOutput = {
  text: `## Coverage Analysis: Upstream API → Data-Tables Requirements

### Field Coverage Matrix

✅ Direct match.

### Falsification

Wrong if: schema changed.`,
}
await hooks["experimental.text.complete"]?.(
  { sessionID: "smoke-v0262-normalize", messageID: "m1", partID: "p1" },
  normalizeOutput,
)
assert("text-complete hook promotes Falsification heading mechanically",
  /^## Falsification\b/m.test(normalizeOutput.text),
  normalizeOutput.text)
assert("text-complete hook maps Coverage Analysis to Findings mechanically",
  /^## Findings\b/m.test(normalizeOutput.text),
  normalizeOutput.text)

const pathClient = {
  session: {
    get: async ({ path }: { path: { id: string } }) => ({
      data: {
        id: path.id,
        directory: "/var/folders/tg/dtfhp7h93fz_8yg2h94tb0p40000gn/T/opencode/fixture",
      },
    }),
  },
} as unknown as ReturnType<typeof createOpencodeClient>
const pathHooks = buildHooks(pathClient)
const readArgs = {
  args: {
    filePath: "/private/var/folders/tg/dtfhp7h93fz_8yg2h94tb0p40000gn/T/opencode/fixture/packages/chart/src/index.ts",
  },
}
await pathHooks["tool.execute.before"]?.(
  { sessionID: "smoke-v0263-path-normalize", tool: "read", callID: "c1" },
  readArgs,
)
assert("tool hook rewrites /private workspace read path to relative",
  readArgs.args.filePath === "packages/chart/src/index.ts",
  `filePath=${readArgs.args.filePath}`)
const grepArgs = {
  args: {
    pattern: "foo",
    path: "/private/var/folders/tg/dtfhp7h93fz_8yg2h94tb0p40000gn/T/opencode/fixture/packages/chart",
  },
}
await pathHooks["tool.execute.before"]?.(
  { sessionID: "smoke-v0263-path-normalize", tool: "grep", callID: "c2" },
  grepArgs,
)
assert("tool hook rewrites /private workspace grep path to relative",
  grepArgs.args.path === "packages/chart",
  `path=${grepArgs.args.path}`)

const siblingRoot = "/tmp/arc-agent-smoke-sibling-root"
rmSync(siblingRoot, { recursive: true, force: true })
mkdirSync(`${siblingRoot}/workspace/fd-core-responses`, { recursive: true })
const siblingClient = {
  session: {
    get: async ({ path }: { path: { id: string } }) => ({
      data: {
        id: path.id,
        directory: `${siblingRoot}/workspace`,
      },
    }),
  },
} as unknown as ReturnType<typeof createOpencodeClient>
const siblingHooks = buildHooks(siblingClient)
const siblingReadArgs = {
  args: {
    filePath: `${siblingRoot}/fd-core-responses/src/api/routes.py`,
  },
}
await siblingHooks["tool.execute.before"]?.(
  { sessionID: "smoke-v0263-sibling-path-normalize", tool: "read", callID: "s1" },
  siblingReadArgs,
)
assert("tool hook rewrites sibling fixture path to workspace relative",
  siblingReadArgs.args.filePath === "fd-core-responses/src/api/routes.py",
  `filePath=${siblingReadArgs.args.filePath}`)
const siblingPermission = { status: "deny" as "ask" | "deny" | "allow" }
await siblingHooks["permission.ask"]?.(
  {
    id: "p1",
    type: "external_directory",
    pattern: `${siblingRoot}/fd-core-responses/src/api/*`,
    sessionID: "smoke-v0263-sibling-path-normalize",
    messageID: "m1",
    title: "external",
    metadata: {},
    time: { created: Date.now() },
  },
  siblingPermission,
)
assert("permission hook allows sibling path that maps into workspace",
  siblingPermission.status === "allow",
  `status=${siblingPermission.status}`)
rmSync(siblingRoot, { recursive: true, force: true })

clearState("smoke-v0263-tool-budget")
const budgetHooks = buildHooks(fakeClient)
let budgetOutput = { title: "ok", output: "normal", metadata: {} }
for (let i = 0; i < 19; i++) {
  budgetOutput = { title: "ok", output: "normal", metadata: {} }
  await budgetHooks["tool.execute.after"]?.(
    { sessionID: "smoke-v0263-tool-budget", tool: "read", callID: `b${i}`, args: {} },
    budgetOutput,
  )
}
assert("tool hook replaces over-budget investigation output with sentinel",
  budgetOutput.output.includes("TOOL BUDGET EXCEEDED"),
  budgetOutput.output)
assert("tool hook tracks investigation tool count",
  getState("smoke-v0263-tool-budget").investigationToolCalls === 19,
  `count=${getState("smoke-v0263-tool-budget").investigationToolCalls}`)

const deprecatedTask = {
  args: {
    subagent_type: "explore",
    prompt: "Search the whole repo for data table fields",
    description: "Explore deprecated path",
  },
}
await budgetHooks["tool.execute.before"]?.(
  { sessionID: "smoke-v0263-deprecated-subagent", tool: "task", callID: "d1" },
  deprecatedTask,
)
assert("tool hook rewrites deprecated explore subagent to critic no-op",
  deprecatedTask.args.subagent_type === "critic" && deprecatedTask.args.prompt.includes("Deprecated subagent dispatch blocked: explore"),
  JSON.stringify(deprecatedTask.args))

clearState("smoke-v0261-text-hook-split")
const splitHooks = buildHooks(fakeClient)
const splitAt = LONG_PLAN_ALL_VIOLATIONS.indexOf("\n## Falsification")
await splitHooks["experimental.text.complete"]?.(
  { sessionID: "smoke-v0261-text-hook-split", messageID: "m1", partID: "p1" },
  { text: LONG_PLAN_ALL_VIOLATIONS.slice(0, splitAt) },
)
const splitStateBefore = getState("smoke-v0261-text-hook-split")
assert("text-complete hook buffers partial plan without firing",
  splitStateBefore.violationsDetected !== true)
await splitHooks["experimental.text.complete"]?.(
  { sessionID: "smoke-v0261-text-hook-split", messageID: "m1", partID: "p2" },
  { text: LONG_PLAN_ALL_VIOLATIONS.slice(splitAt) },
)
const splitStateAfter = getState("smoke-v0261-text-hook-split")
assert("text-complete hook fires after split plan completes",
  splitStateAfter.violationsDetected === true)
assert("text-complete hook writes notes after split plan completes",
  splitStateAfter.workflowMemory?.notes.length === 2,
  `notes=${splitStateAfter.workflowMemory?.notes.length}`)

const fakeChildClient = {
  session: {
    get: async ({ path }: { path: { id: string } }) => ({
      data: { id: path.id, parentID: "smoke-v0261-root" },
    }),
  },
} as unknown as ReturnType<typeof createOpencodeClient>
clearState("smoke-v0261-child")
const childHooks = buildHooks(fakeChildClient)
await childHooks["experimental.text.complete"]?.(
  { sessionID: "smoke-v0261-child", messageID: "m1", partID: "p1" },
  { text: LONG_PLAN_ALL_VIOLATIONS },
)
const childState = getState("smoke-v0261-child")
assert("text-complete hook skips child/subagent sessions",
  childState.violationsDetected !== true && childState.workflowMemory === undefined)

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
