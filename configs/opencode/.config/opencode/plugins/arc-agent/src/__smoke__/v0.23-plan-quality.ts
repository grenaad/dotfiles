/**
 * v0.23 unit smoke — plan-quality measurement parser.
 *
 * Exercises measurePlanQuality() against 6 fixture plans covering the
 * spectrum of plan quality: load-bearing, form-filled, contradiction-
 * acknowledging, oversized, ungrounded-insufficient, and edge cases
 * (empty plan, no Falsification section).
 *
 * Each fixture asserts the full 6-signal output. Total assertions: 36
 * across 7 stages.
 *
 * Run via:
 *   bunx tsx src/__smoke__/v0.23-plan-quality.ts
 *
 * Exits 0 on success, 1 on any failure.
 */

import { measurePlanQuality } from "../plan-quality"
import type { ArcState } from "../types"

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

function mkState(predictionsContradicted = 0): ArcState {
  return {
    sessionID: "ses_test_v023",
    hookErrors: [],
    predictionsContradicted,
  }
}

// --- Fixtures ---------------------------------------------------------------

/**
 * F1 — A load-bearing feature plan. Concrete file:line refs, checkable
 * Wrong-if, no forbidden phrases, in-contract section lengths.
 */
const PLAN_FEATURE_GOOD = `## What you asked for
- Add a /health endpoint mirroring APIRouter convention.

## Scope & Goals
A new health endpoint at app/health/routes.py:1, mirroring the convention in src/api/translation/routes.py:1.

## Existing Solutions Check (re-affirmed)
- **APIRouter pattern** — Sufficient: extend by adding app/health/routes.py:1 with a new APIRouter.
- **FastAPI built-in /health** — Insufficient: lacks DB pool readiness check because the request lifecycle doesn't observe pool state.

## Alternatives Considered
- **Option A — single-file extension**: append /health to existing routes. Pros: minimal diff. Cons: violates module boundary. Picked? no, because routes already split per-domain.
- **Option B — per-domain module**: app/health/routes.py:1. Pros: matches convention. Cons: one more file. Picked? YES, because mirrors src/api/translation/routes.py:1 exactly.

## Choice Justification (axis-by-axis)
- Scope: B wins, single new file vs cross-cutting change.
- Complexity: B equal to A; same APIRouter usage at routes.py:8.

## Assumptions
- DB pool exposed via app/db.py:12.

## Out of Scope
- Liveness vs readiness separation deferred.

## Architecture Decisions
- New APIRouter at app/health/routes.py:1, mounted at app/main.py:34.
- Pool check uses async with pool.acquire() at routes.py:14 with a 200ms timeout.
- Returns 503 when pool exhausted, observable at /health under load test.

## Scaffolding Policy
Not applicable — no scaffolding in this plan.

## Tooling Configuration
ruff + mypy + pytest already configured at pyproject.toml:1.

## Dependencies
None new.

## Implementation Steps
1. Create app/health/__init__.py:1 (empty).
2. Create app/health/routes.py:1 with APIRouter; add GET /health returning {status: ok} or 503.
3. Mount router at app/main.py:34.

## Sanity Check
- Approach answers Ask: yes — mirrors existing module split.
- Constraints from framing: pool exposure verified at app/db.py:12.
- Simpler approach dismissed: single-file rejected because convention is multi-module.

Sanity check passed — proceeding to matrices.

## Edge Case → Handling Matrix
| Edge | Where | Mechanism |
|---|---|---|
| Pool exhausted | routes.py:14 | timeout returns 503 |

## Test Plan
| Edge | Test | Assertion |
|---|---|---|
| Pool exhausted | test_health_under_load | exhaust pool, expect 503 |

## Verification
1. \`pytest tests/test_health.py\` — expect: all pass
2. \`curl localhost:8000/health\` — expect: 200 with {status: ok}

## Falsification
Wrong if: the /health endpoint returns 200 when the DB connection pool is exhausted (verifiable: kill pool via tests/util/pool_killer.py:1, curl, expect 503).
`

/**
 * F2 — A form-filled feature plan. Vague reasons, no file:line refs, bare
 * Wrong-if, forbidden phrases in design sections, ungrounded Insufficient.
 */
const PLAN_FEATURE_BAD = `## What you asked for
- Add a health endpoint.

## Scope & Goals
A new health endpoint for cleaner separation between modules.

## Existing Solutions Check (re-affirmed)
- **APIRouter** — Insufficient: different domain.

## Alternatives Considered
- **Option A**: do it. Pros: works. Cons: none. Picked? YES.

## Choice Justification
N/A.

## Assumptions
- Things will work.

## Out of Scope
- The kitchen sink.

## Architecture Decisions
- Add health endpoint for better organization.
- Pick approach that feels right.
- Use APIRouter because it's more maintainable.

## Scaffolding Policy
N/A.

## Tooling Configuration
Existing.

## Dependencies
None.

## Implementation Steps
1. Create the file.
2. Integrate it.
3. Handle errors appropriately.

## Sanity Check
Sanity check passed.

## Edge Case → Handling Matrix
| Edge | Where | Mechanism |
|---|---|---|
| Errors | code | handle |

## Test Plan
| Edge | Test | Assertion |
|---|---|---|
| Errors | test_it | passes |

## Verification
1. Run tests — expect: pass

## Falsification
Wrong if: the design is wrong.
`

/**
 * F3 — Plan that acknowledges a contradicted prediction. State has
 * predictionsContradicted=2. Plan references P3 inside Architecture
 * Decisions.
 */
const PLAN_WITH_CONTRADICTION_ACK = `## What you asked for
- Add /health endpoint.

## Scope & Goals
Match the multi-module routes convention.

## Existing Solutions Check (re-affirmed)
- **Multi-module APIRouter** — Sufficient: extend the pattern at app/health/routes.py:1.

## Alternatives Considered
- **A**: single-file. **B**: multi-module. Picked B.

## Choice Justification
- Scope: B mirrors src/api/translation/routes.py:1 exactly.

## Assumptions
- Pool exposed.

## Out of Scope
- Liveness vs readiness.

## Architecture Decisions
- Frame predicted P3: APIRouter pattern lives in a single file. Synthesis contradicted P3 — the codebase splits routes across modules at src/api/users/routes.py:1 and src/api/translation/routes.py:1. The plan mirrors the split: app/health/routes.py:1, not app/health.py.
- Pool check at routes.py:14 with 200ms timeout.

## Scaffolding Policy
N/A.

## Tooling Configuration
Existing.

## Dependencies
None.

## Implementation Steps
1. Create app/health/__init__.py:1.
2. Create app/health/routes.py:1.

## Sanity Check
Sanity check passed — design respects the contradicted prediction.

## Edge Case → Handling Matrix
| Edge | Where | Mechanism |
|---|---|---|
| Pool out | routes.py:14 | 503 |

## Test Plan
| Edge | Test | Assertion |
|---|---|---|
| Pool out | test_pool | 503 |

## Verification
1. pytest — pass

## Falsification
Wrong if: the endpoint returns 200 when the pool is exhausted (verifiable via tests/test_health_under_load.py:1).
`

/**
 * F4 — Plan with predictionsContradicted > 0 but NO acknowledgment in any
 * design section. Should fail contradictionAcknowledged.
 */
const PLAN_MISSING_CONTRADICTION_ACK = PLAN_FEATURE_GOOD // no P# / "contradicted" / "previously assumed"

/**
 * F5 — Plan with oversized Architecture Decisions (30 bullets) and oversized
 * Falsification (5 lines).
 */
const PLAN_OVERSIZED = `## What you asked for
- Build a thing.

## Scope & Goals
Build it.

## Existing Solutions Check (re-affirmed)
- **None** — greenfield.

## Alternatives Considered
- **A**: this. **B**: that. Picked A.

## Choice Justification
- Scope: A is simpler.

## Assumptions
- Standard stack.

## Out of Scope
- Phase 2.

## Architecture Decisions
- Decision 1: choose framework X at config.ts:1.
- Decision 2: choose ORM at db.ts:1.
- Decision 3: choose auth at auth.ts:1.
- Decision 4: choose router at router.ts:1.
- Decision 5: choose logger at log.ts:1.
- Decision 6: choose metrics at metrics.ts:1.
- Decision 7: choose tracing at trace.ts:1.
- Decision 8: choose config at config.ts:1.
- Decision 9: choose DI at di.ts:1.
- Decision 10: choose validation at validate.ts:1.
- Decision 11: choose serialization at serial.ts:1.
- Decision 12: choose caching at cache.ts:1.
- Decision 13: choose retry at retry.ts:1.
- Decision 14: choose backoff at backoff.ts:1.
- Decision 15: choose pool at pool.ts:1.
- Decision 16: choose queue at queue.ts:1.
- Decision 17: choose dispatch at dispatch.ts:1.
- Decision 18: choose store at store.ts:1.
- Decision 19: choose adapter at adapter.ts:1.
- Decision 20: choose port at port.ts:1.
- Decision 21: choose facade at facade.ts:1.
- Decision 22: choose factory at factory.ts:1.
- Decision 23: choose builder at builder.ts:1.
- Decision 24: choose visitor at visitor.ts:1.
- Decision 25: choose observer at observer.ts:1.
- Decision 26: choose strategy at strategy.ts:1.
- Decision 27: choose command at command.ts:1.
- Decision 28: choose mediator at mediator.ts:1.
- Decision 29: choose policy at policy.ts:1.
- Decision 30: choose registry at registry.ts:1.

## Scaffolding Policy
N/A.

## Tooling Configuration
Standard.

## Dependencies
None.

## Implementation Steps
1. Do step 1.
2. Do step 2.

## Sanity Check
Passed.

## Edge Case → Handling Matrix
| Edge | Where | Mechanism |
|---|---|---|
| One | code | handle |

## Test Plan
| Edge | Test | Assertion |
|---|---|---|
| One | t | a |

## Verification
1. test — pass

## Falsification
Wrong if: the design has a flaw that we haven't detected.
This is a multi-line falsification.
Which makes it oversized.
And the contract says ≤ 3 lines.
So this should be flagged.
`

/**
 * F6 — A fix plan with checkable Wrong-if, no forbidden phrases.
 */
const PLAN_FIX_GOOD = `## What you asked for
- Diagnose cache race in tests/test_cache.py.

## Scope & Goals
Fix the intermittent failure of test_cache.py.

## Existing Solutions Check (re-affirmed)
- **asyncio.Lock** — Sufficient: wrap writes in app/cache.py:42 because the existing dict lacks atomicity under concurrent async writes.

## Alternatives Considered
- **A: asyncio.Lock**. **B: copy-on-write**. Picked A — simpler diff.

## Assumptions
- Workers run in a single event loop.

## Reproduction
Run pytest tests/test_cache.py -n4 1000 times; ~30% fail.

## Root Cause
Concurrent writes to app/cache.py:42 dict without synchronization; one write overwrites another's update visible to a concurrent read.

## Failure Chain
### Timeline
2026-05-15 10:23 first failure on CI after deploy of #4521 which added the concurrent worker path.
### Classification
Single mode: lost-update race.
### Root Cause
Unprotected dict mutation at app/cache.py:42.
### Confirmation
1. Timing: failures begin at deploy of #4521 (adds concurrent path).
2. Architectural: dict.update is not atomic across event-loop iterations when await is interleaved between read and write.
### Attribution
Introduced by #4521 commit abc123.

## Fix Strategy
Wrap dict mutation in asyncio.Lock at app/cache.py:42. Lock scope: single update operation. Blast radius: only the cache module; no caller change.

## Implementation Steps
1. Add _lock = asyncio.Lock() at app/cache.py:10.
2. Wrap dict mutation at app/cache.py:42 in async with _lock.
3. Add regression test at tests/test_cache_concurrent.py:1.

## Sanity Check
Sanity check passed — fix addresses named root cause.

## Regression Test
test_cache_concurrent_writes_preserve_consistency at tests/test_cache_concurrent.py:1 asserting cache.get(k) == last_write_value after 1000 concurrent writes.

## Rollback Plan
Revert commit. No DB migration to undo.

## Verification
1. pytest tests/test_cache_concurrent.py — expect: pass 100/100 runs

## Falsification
Wrong if: under 1000 concurrent worker writes the cache returns a value other than last_write_value for the contended key (verifiable: the regression test above, > 99% pass rate over 100 runs).
`

// --- Stage 1: F1 — load-bearing feature plan -------------------------------

section("Stage 1 — load-bearing feature plan (F1)")

{
  const state = mkState(0)
  const q = measurePlanQuality(PLAN_FEATURE_GOOD, "feature", state)
  assert(
    "F1 loadBearingRefs >= 5 (concrete file:line refs in design sections)",
    q.loadBearingRefs >= 5,
    `got ${q.loadBearingRefs}`,
  )
  assert("F1 grounded === true", q.grounded === true)
  assert(
    "F1 checkableWrongIf === true (Wrong-if names verifiable condition)",
    q.checkableWrongIf === true,
  )
  assert(
    "F1 forbiddenPhraseCount === 0",
    q.forbiddenPhraseCount === 0,
    `got ${q.forbiddenPhraseCount}`,
  )
  assert(
    "F1 oversizedSections is empty",
    q.oversizedSections.length === 0,
    `got [${q.oversizedSections.join(", ")}]`,
  )
  assert(
    "F1 ungroundedInsufficiencies === 0 (Insufficient names constraint)",
    q.ungroundedInsufficiencies === 0,
    `got ${q.ungroundedInsufficiencies}`,
  )
  assert(
    "F1 contradictionAcknowledged === true (no contradiction debt to acknowledge)",
    q.contradictionAcknowledged === true,
  )
}

// --- Stage 2: F2 — form-filled plan -----------------------------------------

section("Stage 2 — form-filled feature plan (F2)")

{
  const state = mkState(0)
  const q = measurePlanQuality(PLAN_FEATURE_BAD, "feature", state)
  assert(
    "F2 loadBearingRefs === 0 (no file:line in design sections)",
    q.loadBearingRefs === 0,
    `got ${q.loadBearingRefs}`,
  )
  assert("F2 grounded === false", q.grounded === false)
  assert(
    "F2 checkableWrongIf === false (bare 'design is wrong' hedge)",
    q.checkableWrongIf === false,
  )
  assert(
    "F2 forbiddenPhraseCount >= 3 (better organization + feels right + more maintainable)",
    q.forbiddenPhraseCount >= 3,
    `got ${q.forbiddenPhraseCount}`,
  )
  assert(
    "F2 ungroundedInsufficiencies === 1 ('different domain' = no named constraint)",
    q.ungroundedInsufficiencies === 1,
    `got ${q.ungroundedInsufficiencies}`,
  )
}

// --- Stage 3: F3 — contradiction acknowledged -------------------------------

section("Stage 3 — contradiction acknowledgment (F3)")

{
  const state = mkState(2) // 2 contradictions outstanding
  const q = measurePlanQuality(PLAN_WITH_CONTRADICTION_ACK, "feature", state)
  assert(
    "F3 contradictionAcknowledged === true (P3 referenced in Architecture Decisions)",
    q.contradictionAcknowledged === true,
  )
  assert(
    "F3 loadBearingRefs >= 3 (file:line refs in design sections)",
    q.loadBearingRefs >= 3,
    `got ${q.loadBearingRefs}`,
  )
  assert(
    "F3 forbiddenPhraseCount === 0",
    q.forbiddenPhraseCount === 0,
    `got ${q.forbiddenPhraseCount}`,
  )
}

// --- Stage 4: F4 — missing contradiction ack --------------------------------

section("Stage 4 — missing contradiction acknowledgment (F4)")

{
  const state = mkState(3) // 3 contradictions outstanding
  const q = measurePlanQuality(PLAN_MISSING_CONTRADICTION_ACK, "feature", state)
  assert(
    "F4 contradictionAcknowledged === false (no P# or 'contradicted' in design sections)",
    q.contradictionAcknowledged === false,
  )
}

// --- Stage 5: F5 — oversized sections ---------------------------------------

section("Stage 5 — oversized sections (F5)")

{
  const state = mkState(0)
  const q = measurePlanQuality(PLAN_OVERSIZED, "feature", state)
  assert(
    "F5 oversizedSections includes Architecture Decisions",
    q.oversizedSections.includes("## Architecture Decisions"),
    `got [${q.oversizedSections.join(", ")}]`,
  )
  assert(
    "F5 oversizedSections includes Falsification",
    q.oversizedSections.includes("## Falsification"),
    `got [${q.oversizedSections.join(", ")}]`,
  )
}

// --- Stage 6: F6 — fix plan -------------------------------------------------

section("Stage 6 — fix plan (F6)")

{
  const state = mkState(0)
  const q = measurePlanQuality(PLAN_FIX_GOOD, "fix", state)
  assert(
    "F6 loadBearingRefs >= 4 (Fix Strategy + Implementation Steps have file:line refs)",
    q.loadBearingRefs >= 4,
    `got ${q.loadBearingRefs}`,
  )
  assert("F6 grounded === true", q.grounded === true)
  assert(
    "F6 checkableWrongIf === true (Wrong-if names threshold + test ref)",
    q.checkableWrongIf === true,
  )
  assert(
    "F6 forbiddenPhraseCount === 0",
    q.forbiddenPhraseCount === 0,
    `got ${q.forbiddenPhraseCount}`,
  )
  assert(
    "F6 ungroundedInsufficiencies === 0 (Sufficient claim with named 'atomicity' constraint)",
    q.ungroundedInsufficiencies === 0,
    `got ${q.ungroundedInsufficiencies}`,
  )
}

// --- Stage 7: edge cases ----------------------------------------------------

section("Stage 7 — edge cases")

{
  const state = mkState(0)
  // Empty plan
  const empty = measurePlanQuality("", "feature", state)
  assert("Empty plan: loadBearingRefs === 0", empty.loadBearingRefs === 0)
  assert("Empty plan: checkableWrongIf === false", empty.checkableWrongIf === false)
  assert("Empty plan: oversizedSections empty", empty.oversizedSections.length === 0)
  assert(
    "Empty plan: contradictionAcknowledged === true (vacuous when 0 contradictions)",
    empty.contradictionAcknowledged === true,
  )

  // Plan missing Falsification
  const noFalsification = `## Architecture Decisions
- Use foo.ts:1.

## Implementation Steps
1. Do x.
`
  const nf = measurePlanQuality(noFalsification, "feature", state)
  assert(
    "Missing Falsification: checkableWrongIf === false",
    nf.checkableWrongIf === false,
  )
  assert(
    "Missing Falsification: loadBearingRefs still counted",
    nf.loadBearingRefs >= 1,
    `got ${nf.loadBearingRefs}`,
  )

  // Vacuous contradictionAcknowledged when state has 0 contradictions
  const vacuousState = mkState(0)
  const vacuous = measurePlanQuality(PLAN_MISSING_CONTRADICTION_ACK, "feature", vacuousState)
  assert(
    "0 contradictions: contradictionAcknowledged === true (vacuous)",
    vacuous.contradictionAcknowledged === true,
  )
}

// --- Summary ----------------------------------------------------------------

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
