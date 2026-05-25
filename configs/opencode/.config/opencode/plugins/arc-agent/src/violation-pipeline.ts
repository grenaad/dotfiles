/**
 * Shared v0.26 violation pipeline.
 *
 * Runs the pure detector, writes workflow_notes for the top violations, and
 * emits one structured log record. Notes are telemetry only; the text-complete
 * hook does not enqueue a follow-up turn.
 */

import { ensureWorkflowMemory } from "./state"
import { log } from "./log"
import { appendNote } from "./workflow-memory"
import { detectViolations, detectFalsifierUnreadFiles } from "./violation-detector"
import type { ArcState, SubagentType, TaskType, Violation } from "./types"

/** v0.26: per-workflow cap on violation notes. */
export const VIOLATION_DISPATCH_CAP = 2
export const PRIMARY_INVESTIGATION_CALL_SOFT_CEILING = 40
export const ASSISTANT_TEXT_PART_SOFT_CEILING = 8

export type ViolationDetectionSource = "experimental.text.complete" | "event.session.idle"

export interface ViolationPipelineResult {
  violations: Violation[]
  dispatched: SubagentType[]
  capHit: boolean
}

function severityRank(v: Violation): number {
  const order: Record<string, number> = { high: 0, med: 1, low: 2 }
  return order[v.severity] ?? 99
}

function detectTurnBudgetExceeded(state: ArcState): Violation | null {
  const count = state.investigationToolCalls ?? 0
  if (count <= PRIMARY_INVESTIGATION_CALL_SOFT_CEILING) return null
  return {
    kind: "turn-budget-exceeded",
    severity: "med",
    evidence:
      `Plan synthesis happened after ${count} investigation tool calls ` +
      `(soft ceiling ${PRIMARY_INVESTIGATION_CALL_SOFT_CEILING}). Synthesize earlier and move remaining uncertainty to ` +
      `## What I couldn't verify / ## Open Decisions for the user.`,
  }
}

function detectAssistantTurnChurn(state: ArcState): Violation | null {
  const count = state.assistantTextParts ?? 0
  if (count <= ASSISTANT_TEXT_PART_SOFT_CEILING) return null
  return {
    kind: "assistant-turn-churn",
    severity: "low",
    evidence:
      `Plan emitted after ${count} assistant text completions ` +
      `(soft ceiling ${ASSISTANT_TEXT_PART_SOFT_CEILING}). Batch investigation wider and synthesize earlier.`,
  }
}

const OPTIONAL_DOC_SCOPE_RE =
  /\b(?:stream(?:ing)?|image(?: input)?|image_url|multimodal|function calling|tool calling|reasoning_effort|batch mode|async client|async api)\b/i

function detectOptionalDocScopeCreep(plan: string, state: ArcState): Violation | null {
  if (!state.optionalDocScopeExpansionQuestion) return null
  if (detectViolations(plan, "feature").some((v) => v.kind === "optional-doc-scope-creep")) return null
  if (!OPTIONAL_DOC_SCOPE_RE.test(plan)) return null
  return {
    kind: "optional-doc-scope-creep",
    severity: "med",
    evidence:
      "Question tool recommended optional pasted-doc feature expansion, and the final plan includes optional capability terms. " +
      "Recommended scope should match the existing interface unless the user explicitly asks broader.",
  }
}

export async function detectAndPersistViolations(input: {
  sessionID: string
  state: ArcState
  plan: string
  taskType: TaskType
  source: ViolationDetectionSource
}): Promise<ViolationPipelineResult> {
  const violations = detectViolations(input.plan, input.taskType)
  const turnBudgetViolation = detectTurnBudgetExceeded(input.state)
  if (turnBudgetViolation) violations.push(turnBudgetViolation)
  const assistantTurnViolation = detectAssistantTurnChurn(input.state)
  if (assistantTurnViolation) violations.push(assistantTurnViolation)
  const optionalDocViolation = detectOptionalDocScopeCreep(input.plan, input.state)
  if (optionalDocViolation) violations.push(optionalDocViolation)
  // v0.26.7 — falsifier-references-unread-file detector. Needs ArcState's
  // readFiles set, so it lives outside the pure detector list.
  const falsifierViolation = detectFalsifierUnreadFiles(input.plan, input.state.readFiles)
  if (falsifierViolation) violations.push(falsifierViolation)
  violations.sort((a, b) => severityRank(a) - severityRank(b))
  const dispatched: SubagentType[] = []
  let capHit = false

  if (violations.length > 0) {
    const memory = ensureWorkflowMemory(input.state)
    for (const v of violations) {
      if (!v.suggestedSubagent) continue
      if (dispatched.length >= VIOLATION_DISPATCH_CAP) {
        capHit = true
        break
      }

      const result = appendNote(memory, {
        author: "orchestrator",
        type: "concern",
        topic: `violation:${v.kind}`,
        content: `${v.evidence} -> suggested audit: ${v.suggestedSubagent}`,
        refs: [],
      })
      if (result.ok) dispatched.push(v.suggestedSubagent)
    }
  }

  input.state.violationsDetected = true

  await log({
    kind: "workflow.violation",
    session: input.sessionID,
    task_type: input.taskType,
    source: input.source,
    violations: violations.map((v) => ({
      kind: v.kind,
      severity: v.severity,
      suggested_subagent: v.suggestedSubagent,
    })),
    dispatched_subagents: dispatched,
    total_count: violations.length,
    cap_hit: capHit,
  })

  return { violations, dispatched, capHit }
}
