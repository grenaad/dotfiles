/**
 * Plan-output structural templates per task type.
 *
 * Source of truth for what sections a plan must contain. The plugin injects
 * the matching template into the planner's prompt at tool.execute.before
 * (Phase 3 — TS leverage E).
 *
 * Required-section lists derived from these templates power the
 * checkRequiredSections enforcement (Phase 4 — TS leverage A).
 */

export type TaskType = "feature" | "fix" | "refactor" | "investigate" | "docs"

export const TASK_TYPES: readonly TaskType[] = [
  "feature",
  "fix",
  "refactor",
  "investigate",
  "docs",
] as const

export function isTaskType(s: unknown): s is TaskType {
  return typeof s === "string" && (TASK_TYPES as readonly string[]).includes(s)
}

const FEATURE_TEMPLATE = `## What you asked for
- <2-4 bullets paraphrasing the user's request, in your own words>
- ...

If this is wrong, stop me now.

## Scope & Goals
One paragraph. Concrete deliverable. What "done" looks like.

## Alternatives Considered
- **Option A — <name>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- **Option B — <name>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- (Optional **Option C** if 3 alternatives are warranted.)

## Assumptions
Bullet list. Each assumption explicit — especially anything inferred from clarifications
or framing rather than stated by the user.

## Out of Scope
5–15 bullets. Each names something a reader might expect but the plan is NOT doing,
with a one-line justification.

## Architecture Decisions
Bullet per decision. Each: decision + one-sentence rationale. Include rejected
alternatives where the tradeoff is non-obvious.

## Scaffolding Policy
If the plan creates files, directories, or runs project-init commands: specify
which generated files to keep, overwrite, merge, or delete. Name init flags
explicitly (e.g. \`uv init --app --package\`). State lockfile handling. If no
scaffolding occurs, write "Not applicable — no scaffolding in this plan."

## Tooling Configuration
Pick ONE linter, ONE formatter, ONE type-checker, ONE test-runner. Give the
config snippet for each. If async code exists, include async test-runner config.

## Dependencies
Two subsections — Runtime and Dev. Each dep: name, version floor, one-line
justification. Note transitive deps to AVOID. State the dependency-declaration
format chosen (pick exactly one).

## Implementation Steps
Numbered. Each step: concrete file path(s), what changes, why. No vague verbs.

## Sanity Check
- Does the approach in Architecture Decisions actually solve the Ask?
- Are there constraints from framing I forgot?
- Is there a simpler approach I dismissed in Alternatives Considered?

End with one line: \`Sanity check passed — proceeding to matrices.\` OR \`Reconsidering: <what changes>\` followed by any revisions to sections above.

## Edge Case → Handling Matrix
Table: Edge Case | Where Handled (file:layer) | Mechanism. Every edge case
from <edge_cases> MUST appear as a row.

## Test Plan
Traceability table: Edge Case | Test Name | Assertion. Every row from the Edge
Case matrix MUST have at least one test row. Add happy-path tests too.

## Verification
Ordered numbered commands with pass criteria. Format:
  1. <command> — expect: <criterion>
End with one optional manual smoke entry including shutdown procedure.`

const FIX_TEMPLATE = `## What you asked for
- <2-4 bullets paraphrasing the user's request, in your own words>
- ...

If this is wrong, stop me now.

## Scope & Goals
One paragraph. What is broken; what "fixed" looks like.

## Alternatives Considered
- **Option A — <fix approach>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- **Option B — <fix approach>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- (Optional Option C: e.g. "revert and avoid", "feature-flag off", "wait for upstream patch".)

## Assumptions
Bullet list. Especially anything about the bug's reach you have NOT verified.

## Reproduction
Exact steps to reproduce + expected vs actual behaviour. If no repro is
possible, state why and what evidence stands in for one (logs, traces, reports).

## Root Cause
ONE named root cause with mechanism. If multiple candidates remain, pick the
likeliest and list rejected ones with reasoning. A plan with 3+ unresolved
candidate causes will be flagged needs-revision.

## Fix Strategy
Chosen approach in one paragraph. Then: rejected alternatives + why; blast
radius (what code/users/data this touches); risk of making it worse.

## Implementation Steps
Numbered. Each step: concrete file path(s), what changes, why. Minimal diff.

## Sanity Check
- Does the Fix Strategy address the named Root Cause directly?
- Could the Regression Test below actually fail before the fix?
- Are there constraints from framing I forgot?

End with \`Sanity check passed — proceeding to regression test.\` OR \`Reconsidering: <what changes>\`.

## Regression Test
The test that MUST fail before the fix and pass after. Name the test, name
the assertion. Without this, the fix is not provable.

## Rollback Plan
How to revert if this fix breaks something else: which commits, which
config flags, what monitoring to watch.

## Verification
Ordered numbered commands with pass criteria. Include repro from above as
the first verification step.`

const REFACTOR_TEMPLATE = `## What you asked for
- <2-4 bullets paraphrasing the user's request, in your own words>
- ...

If this is wrong, stop me now.

## Scope & Goals
One paragraph. What code is being restructured and what shape it should take.

## Alternatives Considered
- **Option A — <target shape>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- **Option B — <target shape>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- (Optional Option C: e.g. "leave as-is and document why", "minimal extraction only".)

## Assumptions
Bullet list. Especially about which consumers depend on which behaviours.

## Current Shape
Describe the existing structure: key files, layers, responsibilities. Brief.

## Target Shape
Describe the post-refactor structure. Name the principle or pattern driving it
(clean architecture, hexagonal, DDD, single-responsibility split, etc.).
Include rejected alternative shapes if the choice is non-obvious.

## Behaviour Invariants
Numbered list of behaviours that MUST NOT change: public API signatures,
side-effect ordering, error types raised, performance characteristics
consumers rely on, persisted data format, etc. A refactor plan without
explicit invariants will be flagged needs-revision.

## Out of Scope
Things tempting to also fix during this refactor but explicitly deferred.

## Migration Steps
Ordered, each step independently committable and leaving the code working.
Each step: concrete file path(s), what moves/splits/renames, why.

## Sanity Check
- Does the Target Shape actually achieve the user's stated goal?
- Do the Migration Steps preserve every Behaviour Invariant?
- Is there a simpler refactor dismissed in Alternatives Considered?

End with \`Sanity check passed — proceeding to equivalence tests.\` OR \`Reconsidering: <what changes>\`.

## Equivalence Tests
Tests that prove behaviour preservation: which existing tests must still pass,
which new tests cover behaviour previously untested but invariant. Map each
invariant from above to a test.

## Verification
Ordered numbered commands. Include the equivalence test suite as the
gating step.`

const INVESTIGATE_TEMPLATE = `## What you asked for
- <2-4 bullets paraphrasing the user's request, in your own words>
- ...

If this is wrong, stop me now.

## Scope & Goals
One paragraph. The question(s) being answered and why.

## Alternatives Considered
For investigate tasks, "Alternatives" refers to investigation approaches OR (if the question is "should we adopt X?") to candidate answers:
- **Approach A / Answer A — <name>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- **Approach B / Answer B — <name>**: <one-line description>. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- (Optional Approach C.)

## Assumptions
Bullet list. What you are taking as given.

## Question(s)
Numbered, precisely worded questions. Each question MUST be answerable from
the findings below.

## Methodology
How the question was approached: sources consulted, search terms, what was
explicitly NOT consulted and why.

## Findings
Evidence, organized. Cite every claim with source (URL, file:line, or
authoritative reference). Surface contradictions between sources.

## Tradeoffs
If comparing options: table with columns Option | Pro | Con | When to pick.

## Recommendation
Chosen answer + confidence (high/medium/low) + caveats. If no answer is
warranted by the evidence, state "No recommendation — <reason>" explicitly.
Vague findings dumps without a recommendation will be flagged needs-revision.

## Sanity Check
- Does the Recommendation actually answer the Question(s)?
- Is the confidence level justified by the evidence cited in Findings?
- Did I dismiss an alternative answer too quickly?

End with \`Sanity check passed.\` OR \`Reconsidering: <what changes>\`.

## Open Questions
What remains unresolved and would require more investigation.

## Verification
How a reader can validate the recommendation: reproducible queries, citations
to re-check, follow-up reading. No code-execution steps.`

const DOCS_TEMPLATE = `## What you asked for
- <2-4 bullets paraphrasing the user's request, in your own words>
- ...

If this is wrong, stop me now.

## Scope & Goals
One paragraph. What document is being produced and what reader need it serves.

## Alternatives Considered
- **Option A — <doc shape>**: <one-line description, e.g. "README with quick-start + reference">. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- **Option B — <doc shape>**: <one-line description, e.g. "ADR-style decision record" or "Diátaxis tutorial">. Pros: <1-2 bullets>. Cons: <1-2 bullets>. Picked? <YES / no>, because <one sentence>.
- (Optional Option C.)

## Assumptions
Bullet list. Anything inferred about audience, prior knowledge, or scope.

## Audience
Who reads this and why. Their prior knowledge. What they want when they open
this doc.

## Source Material
Existing code, specs, conversations, or external references the doc draws from.
List concrete paths or URLs.

## Document Outline
Section-by-section plan of the doc to be written. Each section: heading + one
sentence of what it covers.

## Files Affected
Paths to create or update. For each: create vs update; rough size estimate.

## Style & Voice
Tone, formatting conventions, code-block style, link style, heading depth.
Cite a style guide if one applies (Diátaxis, ADR template, JSDoc, etc.).

## Sanity Check
- Does the Document Outline serve the named Audience's actual need?
- Are there sections I'm including for completeness that the Audience won't read?
- Did I dismiss a simpler doc shape too quickly?

End with \`Sanity check passed.\` OR \`Reconsidering: <what changes>\`.

## Verification
How to confirm the doc is accurate and useful: examples copy-paste run,
links resolve, terminology consistent with code, scope matches audience.`

export const TASK_TYPE_TEMPLATES: Record<TaskType, string> = {
  feature: FEATURE_TEMPLATE,
  fix: FIX_TEMPLATE,
  refactor: REFACTOR_TEMPLATE,
  investigate: INVESTIGATE_TEMPLATE,
  docs: DOCS_TEMPLATE,
}

/**
 * Required `## <heading>` strings per task type. Powers checkRequiredSections.
 *
 * Conditional sections (Open Questions for investigate, Tradeoffs for investigate)
 * are intentionally NOT in this list — they are advisory, not gating.
 */
export const REQUIRED_SECTIONS_BY_TYPE: Record<TaskType, readonly string[]> = {
  feature: [
    "## What you asked for",
    "## Scope & Goals",
    "## Alternatives Considered",
    "## Assumptions",
    "## Out of Scope",
    "## Architecture Decisions",
    "## Scaffolding Policy",
    "## Tooling Configuration",
    "## Dependencies",
    "## Implementation Steps",
    "## Sanity Check",
    "## Edge Case → Handling Matrix",
    "## Test Plan",
    "## Verification",
  ],
  fix: [
    "## What you asked for",
    "## Scope & Goals",
    "## Alternatives Considered",
    "## Assumptions",
    "## Reproduction",
    "## Root Cause",
    "## Fix Strategy",
    "## Implementation Steps",
    "## Sanity Check",
    "## Regression Test",
    "## Rollback Plan",
    "## Verification",
  ],
  refactor: [
    "## What you asked for",
    "## Scope & Goals",
    "## Alternatives Considered",
    "## Assumptions",
    "## Current Shape",
    "## Target Shape",
    "## Behaviour Invariants",
    "## Out of Scope",
    "## Migration Steps",
    "## Sanity Check",
    "## Equivalence Tests",
    "## Verification",
  ],
  investigate: [
    "## What you asked for",
    "## Scope & Goals",
    "## Alternatives Considered",
    "## Assumptions",
    "## Question(s)",
    "## Methodology",
    "## Findings",
    "## Recommendation",
    "## Sanity Check",
    "## Verification",
  ],
  docs: [
    "## What you asked for",
    "## Scope & Goals",
    "## Alternatives Considered",
    "## Assumptions",
    "## Audience",
    "## Source Material",
    "## Document Outline",
    "## Files Affected",
    "## Style & Voice",
    "## Sanity Check",
    "## Verification",
  ],
}
