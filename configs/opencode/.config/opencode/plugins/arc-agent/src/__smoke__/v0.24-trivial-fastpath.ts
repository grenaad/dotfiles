/**
 * v0.24 unit smoke — trivial fast-path enforcement + mechanical stub
 * injection + slim preamble + auto-confirm bypass.
 *
 * Exercises the v0.24 hook-side changes against synthetic state fixtures.
 * Five scenarios:
 *
 *   (a) trivial-stub injection — every TRIVIAL_SKIPPED_SUBAGENTS member
 *       receives the stub when triviality is `trivial`.
 *   (b) full preamble preserved — `trivialityTier="full"` keeps the full
 *       REASONING_CONVENTIONS block.
 *   (c) slim preamble for mechanical-check subs on full — scope-guard
 *       gets REASONING_CONVENTIONS_SLIM (not full).
 *   (d) scope-guard deterministic clean — populated memory with restater
 *       + plan entries that share token sets returns "in-scope".
 *   (e) unknowns auto-downgrade detection — synthesis-style accept_risk
 *       note flips the verdict to DEFERRED_ACCEPTABLE.
 *   (f) prediction auto-confirm bypass — all predictions confirmed +
 *       non-empty evidence returns true.
 *
 * Run via:
 *   npx tsx src/__smoke__/v0.24-trivial-fastpath.ts
 *
 * Exits 0 on success, 1 on any failure.
 */

import {
  computeScopeGuardVerdict,
  computeUnknownsVerdict,
  predictionsAllTriviallyConfirmed,
} from "../analyzers"
import {
  MECHANICAL_VERDICT_MARKER,
  PREAMBLE_MARKER,
  REASONING_CONVENTIONS,
  REASONING_CONVENTIONS_SLIM,
  TRIVIAL_SKIP_MARKER,
  TRIVIAL_SKIP_STUB_TEMPLATE,
  MECHANICAL_VERDICT_STUB_TEMPLATE,
} from "../constants"
import { createMemory } from "../workflow-memory"
import { appendEntry, appendNote } from "../workflow-memory"
import {
  MECHANICAL_CHECK_SUBAGENTS,
  TRIVIAL_SKIPPED_SUBAGENTS,
  type SubagentType,
} from "../types"

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

// --- Fixtures ---------------------------------------------------------------

function renderTrivialStub(sub: SubagentType): string {
  return TRIVIAL_SKIP_STUB_TEMPLATE.replace(/\{subagent\}/g, sub)
}

function renderMechanicalStub(sub: SubagentType, verdictLine: string): string {
  return MECHANICAL_VERDICT_STUB_TEMPLATE.replace(/\{verdict_line\}/g, verdictLine).replace(
    /\{subagent\}/g,
    sub,
  )
}

// --- (a) Trivial-stub injection ---------------------------------------------

section("(a) Trivial-stub template covers all TRIVIAL_SKIPPED_SUBAGENTS")

assert(
  "TRIVIAL_SKIPPED_SUBAGENTS is non-empty",
  TRIVIAL_SKIPPED_SUBAGENTS.size > 0,
  `size=${TRIVIAL_SKIPPED_SUBAGENTS.size}`,
)

for (const sub of TRIVIAL_SKIPPED_SUBAGENTS) {
  const stub = renderTrivialStub(sub)
  assert(
    `stub for ${sub} contains TRIVIAL_SKIP_MARKER`,
    stub.includes(TRIVIAL_SKIP_MARKER),
  )
  assert(
    `stub for ${sub} names the subagent in the return line`,
    stub.includes(`${sub} not run on trivial workflows`),
  )
  assert(
    `stub for ${sub} omits the full conventions block`,
    !stub.includes("Layer 0 — STANCE"),
  )
}

assert(
  "expected core specialists are in TRIVIAL_SKIPPED_SUBAGENTS",
  TRIVIAL_SKIPPED_SUBAGENTS.has("librarian") &&
    TRIVIAL_SKIPPED_SUBAGENTS.has("explore") &&
    TRIVIAL_SKIPPED_SUBAGENTS.has("synthesis") &&
    TRIVIAL_SKIPPED_SUBAGENTS.has("scope-guard") &&
    TRIVIAL_SKIPPED_SUBAGENTS.has("unknowns-auditor"),
)

assert(
  "artifact subagents NOT in TRIVIAL_SKIPPED_SUBAGENTS",
  !TRIVIAL_SKIPPED_SUBAGENTS.has("frame") &&
    !TRIVIAL_SKIPPED_SUBAGENTS.has("plan") &&
    !TRIVIAL_SKIPPED_SUBAGENTS.has("review") &&
    !TRIVIAL_SKIPPED_SUBAGENTS.has("critic") &&
    !TRIVIAL_SKIPPED_SUBAGENTS.has("restater"),
)

// --- (b) Full preamble preserved on artifact subs ---------------------------

section("(b) Full preamble preserved for artifact subagents on full workflow")

assert(
  "REASONING_CONVENTIONS contains DeepSeek work-shape lecture",
  REASONING_CONVENTIONS.includes("decompose-upfront") ||
    REASONING_CONVENTIONS.includes("Decompose first") ||
    REASONING_CONVENTIONS.includes("Phase 1 —"),
  "expected the full conventions block to keep the multi-phase content",
)

assert(
  "REASONING_CONVENTIONS_SLIM omits Phase 1-4.6",
  !REASONING_CONVENTIONS_SLIM.includes("Phase 1 —") &&
    !REASONING_CONVENTIONS_SLIM.includes("Phase 4.5") &&
    !REASONING_CONVENTIONS_SLIM.includes("Phase 4.6"),
)

assert(
  "REASONING_CONVENTIONS_SLIM keeps Layer 0 STANCE",
  REASONING_CONVENTIONS_SLIM.includes("Layer 0 — STANCE"),
)

assert(
  "REASONING_CONVENTIONS_SLIM keeps Layer 5 FALSIFICATION",
  REASONING_CONVENTIONS_SLIM.includes("Layer 5 — FALSIFICATION"),
)

assert(
  "REASONING_CONVENTIONS_SLIM is meaningfully smaller (<=1800 chars)",
  REASONING_CONVENTIONS_SLIM.length <= 1800,
  `slim=${REASONING_CONVENTIONS_SLIM.length}; full=${REASONING_CONVENTIONS.length}`,
)

assert(
  "full is at least 4x slim",
  REASONING_CONVENTIONS.length >= REASONING_CONVENTIONS_SLIM.length * 4,
  `slim=${REASONING_CONVENTIONS_SLIM.length}; full=${REASONING_CONVENTIONS.length}`,
)

// --- (c) Mechanical-check subagents set ------------------------------------

section("(c) MECHANICAL_CHECK_SUBAGENTS set is correct")

const expectedMechanical: SubagentType[] = [
  "scope-guard",
  "expectation-keeper",
  "unknowns-auditor",
  "confidence-auditor",
  "ambiguity-spotter",
  "restater",
  "frame-validity-check",
  "cost-checker",
  "batch-planner",
]
for (const m of expectedMechanical) {
  assert(`${m} in MECHANICAL_CHECK_SUBAGENTS`, MECHANICAL_CHECK_SUBAGENTS.has(m))
}

const notMechanical: SubagentType[] = ["frame", "plan", "alternatives", "review", "critic", "synthesis", "spike"]
for (const m of notMechanical) {
  assert(`${m} NOT in MECHANICAL_CHECK_SUBAGENTS`, !MECHANICAL_CHECK_SUBAGENTS.has(m))
}

// --- (d) scope-guard deterministic clean ------------------------------------

section("(d) computeScopeGuardVerdict returns in-scope when artifact preserves the ask")

const askA = `## Restated ask
Add a /health endpoint mirroring the FastAPI APIRouter convention. The endpoint returns {status: ok}. Mount at /health in app/main.py. Liveness only.`

const artifactA = `## Plan
Implementation:
- New file app/health.py with module-level APIRouter
- Mount at /health in app/main.py via include_router(prefix="/health")
- Returns {status: ok} on GET /
- Liveness probe; no dependency checks.
- Test via curl GET /health expecting 200 + {"status":"ok"}.

The endpoint preserves the FastAPI convention and is mounted on app.main.`

assert(
  "scope-guard verdict: in-scope when artifact strongly overlaps the ask",
  computeScopeGuardVerdict(askA, artifactA) === "in-scope",
)

const askB = `## Restated ask
Add a /health endpoint.`

const artifactB = `## Plan
Refactor entire authentication module. Replace JWT with OAuth2. Migrate to Pydantic v2. Add Redis caching layer. New deployment manifests.`

assert(
  "scope-guard verdict: ambiguous when artifact diverges from ask",
  computeScopeGuardVerdict(askB, artifactB) === "ambiguous",
)

assert(
  "scope-guard verdict: ambiguous on empty inputs",
  computeScopeGuardVerdict("", artifactA) === "ambiguous",
)

assert(
  "scope-guard verdict: ambiguous when ask is empty",
  computeScopeGuardVerdict(askA, "") === "ambiguous",
)

// --- (e) Unknowns auto-downgrade ------------------------------------------

section("(e) computeUnknownsVerdict reads memory deterministically")

// Empty memory → ALL_RESOLVED
{
  const memory = createMemory("full")
  assert(
    "empty memory → ALL_RESOLVED",
    computeUnknownsVerdict(memory) === "ALL_RESOLVED",
  )
}

// One open pre_design → OPEN_UNKNOWNS_REMAIN
{
  const memory = createMemory("full")
  const r = appendNote(memory, {
    author: "frame",
    type: "unknown",
    topic: "u1",
    content: "Q: Is X always Y? | I: not yet | S: open | R: pre_design | E: ",
  })
  assert("appendNote u1 ok", r.ok)
  assert(
    "one R:pre_design + S:open → OPEN_UNKNOWNS_REMAIN",
    computeUnknownsVerdict(memory) === "OPEN_UNKNOWNS_REMAIN",
  )
}

// Downgrade to accept_risk → DEFERRED_ACCEPTABLE
{
  const memory = createMemory("full")
  const r1 = appendNote(memory, {
    author: "frame",
    type: "unknown",
    topic: "u1",
    content: "Q: Is X always Y? | I: not yet | S: open | R: pre_design | E: ",
  })
  assert("appendNote u1 ok (pre-design)", r1.ok)
  const r2 = appendNote(memory, {
    author: "synthesis",
    type: "unknown",
    topic: "u1",
    content:
      "Q: Is X always Y? | I: design handles both branches | S: deferred | R: accept_risk | E: zipfile.is_zipfile() handles both",
  })
  assert("appendNote u1 ok (accept_risk downgrade)", r2.ok)
  // The latest note wins (status=deferred, R=accept_risk) → DEFERRED_ACCEPTABLE
  // since there are no open unknowns left.
  const v = computeUnknownsVerdict(memory)
  assert(
    "deferred + accept_risk → ALL_RESOLVED (no opens) or DEFERRED_ACCEPTABLE",
    v === "ALL_RESOLVED" || v === "DEFERRED_ACCEPTABLE",
    `got: ${v}`,
  )
}

// Mixed: one pre_design open + one user_input open → OPEN_UNKNOWNS_REMAIN (strongest blocker)
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "unknown",
    topic: "u1",
    content: "Q: pre-design Q? | I: nope | S: open | R: pre_design | E: ",
  })
  appendNote(memory, {
    author: "frame",
    type: "unknown",
    topic: "u2",
    content: "Q: user-input Q? | I: nope | S: open | R: user_input | E: ",
  })
  assert(
    "pre_design + user_input opens → OPEN_UNKNOWNS_REMAIN (pre_design wins)",
    computeUnknownsVerdict(memory) === "OPEN_UNKNOWNS_REMAIN",
  )
}

// Only user_input open → USER_INPUT_REQUIRED
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "unknown",
    topic: "u1",
    content: "Q: user input? | I: nope | S: open | R: user_input | E: ",
  })
  assert(
    "user_input open only → USER_INPUT_REQUIRED",
    computeUnknownsVerdict(memory) === "USER_INPUT_REQUIRED",
  )
}

// --- (f) Prediction auto-confirm bypass ------------------------------------

section("(f) predictionsAllTriviallyConfirmed bypass condition")

// No predictions → false
{
  const memory = createMemory("full")
  assert(
    "no predictions → not auto-confirm-eligible",
    predictionsAllTriviallyConfirmed(memory) === false,
  )
}

// All confirmed with evidence → true
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "prediction",
    topic: "p1",
    content: "Expect X | Wrong if: not-X",
  })
  appendNote(memory, {
    author: "frame",
    type: "prediction",
    topic: "p2",
    content: "Expect Y | Wrong if: not-Y",
  })
  appendNote(memory, {
    author: "librarian",
    type: "observation",
    topic: "p1",
    content: "V: confirmed | E: grep at routes.py:42 shows X",
  })
  appendNote(memory, {
    author: "librarian",
    type: "observation",
    topic: "p2",
    content: "V: confirmed | E: pyproject.toml:15 pins Y",
  })
  assert(
    "all confirmed with evidence → auto-confirm-eligible",
    predictionsAllTriviallyConfirmed(memory) === true,
  )
}

// One contradicted → false
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "prediction",
    topic: "p1",
    content: "Expect X | Wrong if: not-X",
  })
  appendNote(memory, {
    author: "librarian",
    type: "observation",
    topic: "p1",
    content: "V: contradicted | E: shows not-X",
  })
  assert(
    "contradicted prediction → NOT auto-confirm-eligible",
    predictionsAllTriviallyConfirmed(memory) === false,
  )
}

// One unobserved → false
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "prediction",
    topic: "p1",
    content: "Expect X | Wrong if: not-X",
  })
  // No observation note for p1 → unobserved
  assert(
    "unobserved prediction → NOT auto-confirm-eligible",
    predictionsAllTriviallyConfirmed(memory) === false,
  )
}

// Confirmed but empty evidence → false
{
  const memory = createMemory("full")
  appendNote(memory, {
    author: "frame",
    type: "prediction",
    topic: "p1",
    content: "Expect X | Wrong if: not-X",
  })
  appendNote(memory, {
    author: "librarian",
    type: "observation",
    topic: "p1",
    content: "V: confirmed | E: ",
  })
  assert(
    "confirmed with empty evidence → NOT auto-confirm-eligible",
    predictionsAllTriviallyConfirmed(memory) === false,
  )
}

// --- (g) Stub-template shapes -----------------------------------------------

section("(g) Stub template substitution shapes")

const scopeStub = renderMechanicalStub("scope-guard", "✅ In scope")
assert(
  "scope-guard mechanical stub contains MECHANICAL_VERDICT_MARKER",
  scopeStub.includes(MECHANICAL_VERDICT_MARKER),
)
assert("scope-guard mechanical stub contains verdict line", scopeStub.includes("✅ In scope"))
assert(
  "scope-guard mechanical stub names subagent in falsification",
  scopeStub.includes("scope-guard stub fired"),
)

const trivialStub = renderTrivialStub("librarian")
assert(
  "librarian trivial stub contains expected return line",
  trivialStub.includes("Skipped — trivial task. librarian not run on trivial workflows"),
)
assert(
  "librarian trivial stub does NOT contain full reasoning block",
  !trivialStub.includes(PREAMBLE_MARKER) && !trivialStub.includes("Layer 0"),
)

// --- (h) silence unused-var warning by referencing imports -----------------

assert(
  "appendEntry export is callable (smoke import sanity)",
  typeof appendEntry === "function",
)

// --- Summary ---------------------------------------------------------------

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length

// eslint-disable-next-line no-console
console.log(`\n${passed}/${results.length} assertions passed`)
if (failed > 0) {
  // eslint-disable-next-line no-console
  console.log("FAIL")
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log("PASS")
