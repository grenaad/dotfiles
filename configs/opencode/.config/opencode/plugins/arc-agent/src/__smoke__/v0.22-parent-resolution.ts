/**
 * v0.22 smoke test — parent-session resolution + factory wiring + markdown
 * fallback parsers.
 *
 * Background
 * ----------
 * v0.21 shipped a child-session bug: workflow_note() called from a subagent
 * (child session) read `getState(context.sessionID)` directly, returning a
 * fresh empty ArcState. Every note was silently dropped. 100% loss on both
 * deepseek-v4-flash and opus-4-7 smoke runs.
 *
 * v0.22 fixes it by converting the 4 workflow_* tools to factories that close
 * over the SDK client, walk parent sessions via `client.session.get`, and
 * cache the (child → root) mapping. This smoke test exercises that path with
 * a mock client so the parent-resolution logic is verified without burning
 * model tokens or requiring a live OpenCode server.
 *
 * Run via:
 *   bunx tsx src/__smoke__/v0.22-parent-resolution.ts
 *
 * Or (preferred — same as existing v0.21 stages 1+2 smoke flows):
 *   bunx ts-node src/__smoke__/v0.22-parent-resolution.ts
 *
 * Exits 0 on success, 1 on any assertion failure. Final line prints the
 * pass/total count for easy CI integration.
 */

import {
  evictParentCache,
  makeWorkflowNoteTool,
  makeWorkflowRecallTool,
  makeWorkflowUnknownsStatusTool,
} from "../workflow-memory-tools"
import { getState, clearState, ensureWorkflowMemory } from "../state"
import {
  parseFrameInsufficiencies,
  parseFramePredictions,
  parseFrameUnknowns,
} from "../workflow-memory"
import { NOTE_TYPES } from "../types"

// --- Test harness -----------------------------------------------------------

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

// --- Mock client ------------------------------------------------------------

interface MockSession {
  id: string
  parentID?: string
}

interface MockClientStats {
  sessionGetCalls: number
  sessionGetIdsRequested: string[]
}

function makeMockClient(sessions: MockSession[]): {
  client: Parameters<typeof makeWorkflowNoteTool>[0]
  stats: MockClientStats
  failNextN: (n: number) => void
} {
  const byId = new Map<string, MockSession>()
  for (const s of sessions) byId.set(s.id, s)

  const stats: MockClientStats = { sessionGetCalls: 0, sessionGetIdsRequested: [] }
  let failuresRemaining = 0

  const client = {
    session: {
      get: async (opts: { path: { id: string } }) => {
        stats.sessionGetCalls++
        stats.sessionGetIdsRequested.push(opts.path.id)
        if (failuresRemaining > 0) {
          failuresRemaining--
          throw new Error("mock client: simulated SDK failure")
        }
        const s = byId.get(opts.path.id)
        if (!s) {
          throw new Error(`mock client: session not found: ${opts.path.id}`)
        }
        return { data: s }
      },
    },
  } as unknown as Parameters<typeof makeWorkflowNoteTool>[0]

  return {
    client,
    stats,
    failNextN: (n: number) => {
      failuresRemaining = n
    },
  }
}

// --- Tool-context shim ------------------------------------------------------

/**
 * Minimal stub for the tool context. The real `ToolContext` carries more
 * fields (`messageID`, `agent`, `directory`, `worktree`, `abort`, `metadata`,
 * `ask`); none of them are touched by the workflow_* tools, so the shim
 * only provides `sessionID`. We cast through `unknown` because the broader
 * shape isn't relevant for these tests.
 */
function mkCtx(sessionID: string): Parameters<
  ReturnType<typeof makeWorkflowNoteTool>["execute"]
>[1] {
  return { sessionID } as unknown as Parameters<
    ReturnType<typeof makeWorkflowNoteTool>["execute"]
  >[1]
}

// --- Helpers ----------------------------------------------------------------

function resetAll(sessionIDs: string[]): void {
  for (const id of sessionIDs) {
    clearState(id)
    evictParentCache(id)
  }
}

// --- Stage 1: parent-resolution mechanics -----------------------------------

async function stage1_parentResolution(): Promise<void> {
  section("Stage 1 — parent-session resolution mechanics")

  // Scenario: parent ses_p has memory; child ses_c is a subagent's session.
  // workflow_note from ses_c must land in ses_p's ArcState.
  const PARENT = "ses_p_001"
  const CHILD = "ses_c_001"
  resetAll([PARENT, CHILD])

  const { client, stats } = makeMockClient([
    { id: CHILD, parentID: PARENT },
    { id: PARENT }, // root — no parentID
  ])

  // Seed parent state with workflow memory (the orchestrator's
  // tool.execute.after hook would have done this on the parent's first
  // subagent capture; we simulate that here).
  const parentState = getState(PARENT)
  parentState.trivialityTier = "full"
  ensureWorkflowMemory(parentState)

  const noteTool = makeWorkflowNoteTool(client)

  const result = await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.prediction,
      topic: "P1",
      content: "I expect APIRouter at module level | Wrong if: factory function",
    },
    mkCtx(CHILD),
  )

  const resObj = typeof result === "string" ? { output: result } : result
  assert(
    "ses_c note lands in ses_p memory (not in fresh ses_c ArcState)",
    parentState.workflowMemory?.notes.length === 1,
    `parentState.notes.length=${parentState.workflowMemory?.notes.length ?? "<unset>"}`,
  )
  assert(
    "tool returns success title (not 'memory not initialized')",
    resObj.output?.includes("recorded") === true,
    `output=${resObj.output?.slice(0, 120)}`,
  )
  assert(
    "child ses_c ArcState was NOT polluted with workflow memory",
    getState(CHILD).workflowMemory === undefined,
  )
  // The walker calls session.get on CHILD (returns parentID=PARENT) and
  // again on PARENT (returns no parentID → confirms root). So 2 calls is
  // correct for the first walk.
  assert(
    "first walk makes 2 session.get calls (CHILD then PARENT to confirm root)",
    stats.sessionGetCalls === 2,
    `calls=${stats.sessionGetCalls}`,
  )

  // Second call from same child — cache hit, no new SDK calls.
  const callsAfterFirst = stats.sessionGetCalls
  await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.prediction,
      topic: "P2",
      content: "I expect include_router pattern | Wrong if: app.add_api_route",
    },
    mkCtx(CHILD),
  )
  assert(
    "second call from same child uses cached parent (no extra SDK calls)",
    stats.sessionGetCalls === callsAfterFirst,
    `calls=${stats.sessionGetCalls} (expected ${callsAfterFirst})`,
  )
  assert(
    "second note also landed in parent",
    parentState.workflowMemory?.notes.length === 2,
    `notes=${parentState.workflowMemory?.notes.length}`,
  )

  resetAll([PARENT, CHILD])
}

// --- Stage 2: 3-deep parent chain -------------------------------------------

async function stage2_deepChain(): Promise<void> {
  section("Stage 2 — deeper parent chains (orchestrator → sub → sub-sub)")

  // Hypothetical 3-level nesting: a subagent that itself spawns another
  // subagent. Current orchestrator runs at depth ≤ 1, but the walk must
  // handle arbitrary depth defensively.
  const ROOT = "ses_root_a"
  const MID = "ses_mid_a"
  const LEAF = "ses_leaf_a"
  resetAll([ROOT, MID, LEAF])

  const { client, stats } = makeMockClient([
    { id: LEAF, parentID: MID },
    { id: MID, parentID: ROOT },
    { id: ROOT },
  ])

  const rootState = getState(ROOT)
  rootState.trivialityTier = "full"
  ensureWorkflowMemory(rootState)

  const noteTool = makeWorkflowNoteTool(client)
  await noteTool.execute(
    {
      author: "skeptic",
      type: NOTE_TYPES.pattern,
      topic: "deep-nest",
      content: "deep-nest test note",
    },
    mkCtx(LEAF),
  )

  assert(
    "3-deep walk: note from leaf lands in root memory",
    rootState.workflowMemory?.notes.length === 1,
    `root.notes=${rootState.workflowMemory?.notes.length ?? "<unset>"}`,
  )
  assert(
    "walk made 3 session.get calls (leaf → mid → root)",
    stats.sessionGetCalls === 3,
    `calls=${stats.sessionGetCalls}`,
  )
  assert(
    "mid session ArcState not polluted",
    getState(MID).workflowMemory === undefined,
  )
  assert(
    "leaf session ArcState not polluted",
    getState(LEAF).workflowMemory === undefined,
  )

  resetAll([ROOT, MID, LEAF])
}

// --- Stage 3: cycle detection -----------------------------------------------

async function stage3_cycleDetection(): Promise<void> {
  section("Stage 3 — cycle detection (safety, not a real case)")

  // a → b → a (cycle). Should bail gracefully without infinite loop.
  const A = "ses_cycle_a"
  const B = "ses_cycle_b"
  resetAll([A, B])

  const { client } = makeMockClient([
    { id: A, parentID: B },
    { id: B, parentID: A }, // cycle
  ])

  const aState = getState(A)
  aState.trivialityTier = "full"
  ensureWorkflowMemory(aState)
  const bState = getState(B)
  bState.trivialityTier = "full"
  ensureWorkflowMemory(bState)

  const noteTool = makeWorkflowNoteTool(client)

  // Should resolve to either A or B (whichever the walk bails at) without
  // hanging. Note must land in some real ArcState.
  const result = await noteTool.execute(
    {
      author: "skeptic",
      type: NOTE_TYPES.concern,
      topic: "cycle-test",
      content: "should not hang",
    },
    mkCtx(A),
  )

  const totalNotes =
    (aState.workflowMemory?.notes.length ?? 0) +
    (bState.workflowMemory?.notes.length ?? 0)
  const resObj = typeof result === "string" ? { output: result } : result
  assert(
    "cycle does not infinite-loop; tool returns within reasonable time",
    resObj.output !== undefined,
  )
  assert(
    "cycle bails to a real session; note recorded somewhere",
    totalNotes === 1,
    `aNotes=${aState.workflowMemory?.notes.length} bNotes=${bState.workflowMemory?.notes.length}`,
  )

  resetAll([A, B])
}

// --- Stage 4: SDK failure fallback ------------------------------------------

async function stage4_sdkFailureFallback(): Promise<void> {
  section("Stage 4 — SDK failure falls back to original sessionID")

  const ORIG = "ses_fail_orig"
  resetAll([ORIG])

  const { client, stats, failNextN } = makeMockClient([{ id: ORIG }])

  // Seed memory on ORIG directly so the fallback path can write to it.
  const origState = getState(ORIG)
  origState.trivialityTier = "full"
  ensureWorkflowMemory(origState)

  // Force the SDK call to throw on the next attempt.
  failNextN(1)

  const noteTool = makeWorkflowNoteTool(client)
  // Use skeptic + concern; skeptic is authorized for concern per
  // NOTE_TYPE_AUTHORIZATION (not for observation).
  await noteTool.execute(
    {
      author: "skeptic",
      type: NOTE_TYPES.concern,
      topic: "fallback",
      content: "should still land on ORIG via fallback",
    },
    mkCtx(ORIG),
  )

  assert(
    "SDK failure falls back to original sessionID; note lands on ORIG",
    origState.workflowMemory?.notes.length === 1,
    `notes=${origState.workflowMemory?.notes.length}`,
  )
  assert(
    "fallback consumed exactly one (failing) SDK call attempt",
    stats.sessionGetCalls === 1,
    `calls=${stats.sessionGetCalls}`,
  )

  resetAll([ORIG])
}

// --- Stage 5: evictParentCache + clearState integration --------------------

async function stage5_cacheEviction(): Promise<void> {
  section("Stage 5 — cache eviction on clearState")

  const PARENT = "ses_evict_p"
  const CHILD = "ses_evict_c"
  resetAll([PARENT, CHILD])

  const { client, stats } = makeMockClient([
    { id: CHILD, parentID: PARENT },
    { id: PARENT },
  ])
  const parentState = getState(PARENT)
  parentState.trivialityTier = "full"
  ensureWorkflowMemory(parentState)

  const noteTool = makeWorkflowNoteTool(client)
  await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.prediction,
      topic: "P1",
      content: "X | Wrong if: Y",
    },
    mkCtx(CHILD),
  )
  // After first call, cache contains CHILD → PARENT.
  const callsAfterFirst = stats.sessionGetCalls

  // clearState should evict the cache entry too.
  clearState(CHILD)

  // Re-seed parent (clearState on CHILD doesn't touch PARENT).
  // Second call from CHILD must re-resolve via SDK.
  await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.prediction,
      topic: "P2",
      content: "X2 | Wrong if: Y2",
    },
    mkCtx(CHILD),
  )

  // After eviction, the next walk re-fetches: get(CHILD) → get(PARENT) = 2 calls.
  assert(
    "after clearState(CHILD), next call re-resolves via SDK (cache evicted)",
    stats.sessionGetCalls === callsAfterFirst + 2,
    `firstCalls=${callsAfterFirst}, afterClearCalls=${stats.sessionGetCalls} (expected +2)`,
  )

  resetAll([PARENT, CHILD])
}

// --- Stage 6: recall and unknowns_status also resolve to parent -------------

async function stage6_recallAndUnknowns(): Promise<void> {
  section("Stage 6 — recall + unknowns_status also resolve to parent")

  const PARENT = "ses_recall_p"
  const CHILD = "ses_recall_c"
  resetAll([PARENT, CHILD])

  const { client } = makeMockClient([
    { id: CHILD, parentID: PARENT },
    { id: PARENT },
  ])
  const parentState = getState(PARENT)
  parentState.trivialityTier = "full"
  const memory = ensureWorkflowMemory(parentState)

  // Pre-populate with one note via the tool path (also exercises the fix).
  const noteTool = makeWorkflowNoteTool(client)
  await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.unknown,
      topic: "U1",
      content: "Q: which workspace? | I: pending | S: open | R: user_input | E: ",
    },
    mkCtx(CHILD),
  )

  // Recall from CHILD must see the note (1 in parent's memory).
  const recallTool = makeWorkflowRecallTool(client)
  const recallResult = await recallTool.execute({ noteType: NOTE_TYPES.unknown }, mkCtx(CHILD))
  const recallObj = typeof recallResult === "string" ? { output: recallResult } : recallResult
  assert(
    "workflow_recall from child reads parent's notes",
    recallObj.output?.includes("Found 1 result") === true ||
      recallObj.output?.includes("u1") === true,
    `output=${recallObj.output?.slice(0, 200)}`,
  )

  // unknowns_status from CHILD must see the open R:user_input bucket.
  const unkTool = makeWorkflowUnknownsStatusTool(client)
  const unkResult = await unkTool.execute({}, mkCtx(CHILD))
  const unkObj = typeof unkResult === "string" ? { output: unkResult } : unkResult
  assert(
    "workflow_unknowns_status from child reports parent's open unknown",
    unkObj.output?.includes("1 open") === true,
    `output=${unkObj.output?.slice(0, 200)}`,
  )
  assert(
    "memory state is consistent (1 note recorded)",
    memory.notes.length === 1,
  )

  resetAll([PARENT, CHILD])
}

// --- Stage 7: memory-uninitialized log path (smoke for the new log line) ----

async function stage7_memoryUninitializedLog(): Promise<void> {
  section("Stage 7 — memory-uninitialized rejection path")

  const PARENT = "ses_uninit_p"
  const CHILD = "ses_uninit_c"
  resetAll([PARENT, CHILD])

  const { client } = makeMockClient([
    { id: CHILD, parentID: PARENT },
    { id: PARENT },
  ])
  // Deliberately do NOT initialize memory on PARENT — simulates the case
  // where a triviality fast-path suppressed it (or restater hasn't fired yet).
  const parentState = getState(PARENT)
  parentState.trivialityTier = "trivial" // suppression tier — memory not created
  // No ensureWorkflowMemory() call.

  const noteTool = makeWorkflowNoteTool(client)
  const result = await noteTool.execute(
    {
      author: "frame",
      type: NOTE_TYPES.prediction,
      topic: "P1",
      content: "X | Wrong if: Y",
    },
    mkCtx(CHILD),
  )
  const resObj = typeof result === "string" ? { output: result } : result

  assert(
    "memory-uninitialized rejection returns clean error message",
    resObj.output?.includes("not been initialized") === true,
    `output=${resObj.output?.slice(0, 200)}`,
  )
  assert(
    "memory remains uninitialized (not lazily created on note write)",
    parentState.workflowMemory === undefined,
  )

  resetAll([PARENT, CHILD])
}

// --- Stage 8: markdown fallback parsers -------------------------------------

function stage8_markdownParsers(): void {
  section("Stage 8 — markdown fallback parsers (v0.22)")

  const frameOutput = `## Ask
Add a health endpoint.

## Restate intent
- User wants a FastAPI health route.

## Current State
Existing app/ with translation routes.

## Target State
A /health endpoint mirroring translation pattern.

## Delta
- Add new APIRouter for health.

## Predictions
- P1: I expect APIRouter to be at module level because the convention in translation is module-level. Wrong if: it's inside a factory function.
- P2: I expect include_router() to be used in main.py because that's the FastAPI default. Wrong if: app uses mount() instead.
- P3: I expect Pydantic v2 because the project's pyproject lists pydantic>=2. Wrong if: pyproject pins <2.

## Existing Solutions Check
- **translation router pattern** — Sufficient: copy the APIRouter idiom verbatim.
- **fastapi-utils health helper** — Insufficient: introduces a third-party dep and we don't want a new transitive.
- **manual @app.get('/health') in main.py** — Insufficient: violates the "mirror APIRouter convention" constraint.

## Goals
- A working /health.

## Constraints
- No new deps.

## Assumptions
- async handlers.

## Open Questions
- U1: Which file path — app/health.py or src/api/health/routes.py? | R: user_input — different conventions implied.
- U2: Should /health include readiness probes? | R: user_input — affects scope.
- U3: Is the global auth middleware applied to all routes? | R: pre_design — need to confirm via inspection.

## Task Shape
Primary: greenfield-plan
Secondary: none
Rationale: New file; no refactor.

## Task Type
feature

Justification: builds new capability.

Confidence: high

## Falsification
Wrong if: the codebase already has a /health endpoint.
`

  const preds = parseFramePredictions(frameOutput)
  assert(
    "parseFramePredictions extracts 3 predictions",
    preds.length === 3,
    `got ${preds.length}: ${JSON.stringify(preds.map((p) => p.topic))}`,
  )
  assert(
    "P1 topic is normalized to 'p1' lowercase",
    preds[0]?.topic === "p1",
    `topic=${preds[0]?.topic}`,
  )
  assert(
    "P1 content has 'Wrong if:' separator preserved",
    preds[0]?.content.includes("Wrong if:") === true,
    `content=${preds[0]?.content}`,
  )

  const unks = parseFrameUnknowns(frameOutput)
  assert(
    "parseFrameUnknowns extracts 3 unknowns",
    unks.length === 3,
    `got ${unks.length}: ${JSON.stringify(unks.map((u) => u.topic))}`,
  )
  assert(
    "U1 topic is normalized to 'u1'",
    unks[0]?.topic === "u1",
    `topic=${unks[0]?.topic}`,
  )
  assert(
    "U1 content includes Q: and R: fields",
    unks[0]?.content.includes("Q: Which file path") === true &&
      unks[0]?.content.includes("R: user_input") === true,
    `content=${unks[0]?.content}`,
  )
  assert(
    "U3 captures R: pre_design",
    unks[2]?.content.includes("R: pre_design") === true,
    `content=${unks[2]?.content}`,
  )

  const insufs = parseFrameInsufficiencies(frameOutput)
  assert(
    "parseFrameInsufficiencies extracts 2 Insufficient bullets (not Sufficient)",
    insufs.length === 2,
    `got ${insufs.length}: ${JSON.stringify(insufs.map((i) => i.topic))}`,
  )
  assert(
    "insufficiency 1 mechanism is 'fastapi-utils health helper'",
    insufs[0]?.topic === "fastapi-utils health helper",
    `topic=${insufs[0]?.topic}`,
  )
  assert(
    "insufficiency content has M: ... | I: ... shape",
    insufs[0]?.content.startsWith("M: ") === true &&
      insufs[0]?.content.includes("| I: ") === true,
    `content=${insufs[0]?.content}`,
  )

  // Empty section / absent section returns []
  assert(
    "parseFramePredictions on empty markdown returns []",
    parseFramePredictions("just some prose, no section").length === 0,
  )
  assert(
    "parseFrameUnknowns on empty markdown returns []",
    parseFrameUnknowns("nothing here").length === 0,
  )
  assert(
    "parseFrameInsufficiencies on empty markdown returns []",
    parseFrameInsufficiencies("nada").length === 0,
  )

  // Predictions section with no parseable bullets returns []
  const malformed = `## Predictions
- This bullet has no P-number.
- Neither does this one.
`
  assert(
    "parseFramePredictions skips bullets without P<n> shape",
    parseFramePredictions(malformed).length === 0,
  )

  // Predictions without Wrong if: are skipped (incomplete)
  const incomplete = `## Predictions
- P1: I expect something but didn't state a falsifier.
- P2: I expect another thing. Wrong if: the falsifier is named.
`
  const incompletePreds = parseFramePredictions(incomplete)
  assert(
    "parseFramePredictions skips predictions without 'Wrong if:'",
    incompletePreds.length === 1 && incompletePreds[0]?.topic === "p2",
    `got ${incompletePreds.length} preds: ${JSON.stringify(incompletePreds.map((p) => p.topic))}`,
  )
}

// --- Main -------------------------------------------------------------------

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("arc-agent v0.22 smoke test — parent-session resolution")
  // eslint-disable-next-line no-console
  console.log("=====================================================")

  await stage1_parentResolution()
  await stage2_deepChain()
  await stage3_cycleDetection()
  await stage4_sdkFailureFallback()
  await stage5_cacheEviction()
  await stage6_recallAndUnknowns()
  await stage7_memoryUninitializedLog()
  stage8_markdownParsers()

  const passed = results.filter((r) => r.ok).length
  const total = results.length
  // eslint-disable-next-line no-console
  console.log(`\n${passed}/${total} assertions passed`)

  if (passed !== total) {
    // eslint-disable-next-line no-console
    console.error("FAIL")
    process.exit(1)
  }
  // eslint-disable-next-line no-console
  console.log("PASS")
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("UNEXPECTED ERROR:", err)
  process.exit(1)
})
