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

export type ViolationDetectionSource = "experimental.text.complete"

export interface ViolationPipelineResult {
  violations: Violation[]
  dispatched: SubagentType[]
  capHit: boolean
}

export async function detectAndPersistViolations(input: {
  sessionID: string
  state: ArcState
  plan: string
  taskType: TaskType
  source: ViolationDetectionSource
}): Promise<ViolationPipelineResult> {
  const violations = detectViolations(input.plan, input.taskType)
  // v0.26.7 — falsifier-references-unread-file detector. Needs ArcState's
  // readFiles set, so it lives outside the pure detector list.
  const falsifierViolation = detectFalsifierUnreadFiles(input.plan, input.state.readFiles)
  if (falsifierViolation) violations.push(falsifierViolation)
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
