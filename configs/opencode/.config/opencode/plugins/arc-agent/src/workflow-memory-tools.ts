/**
 * v0.19 — Tools exposed to subagents for querying workflow memory.
 *
 * Two tools are registered:
 *   workflow_recall — read entries and notes by subagent / topic / keyword
 *   workflow_note   — write a structured note (analysis specialists only)
 *
 * Both are best-effort: failures return empty/rejected payloads, never throw.
 * Memory is suppressed on ultra/trivial triviality (workflowMemory will be
 * missing or trivial); the tools degrade gracefully in that case.
 */

import { tool } from "@opencode-ai/plugin"

import { getState } from "./state"
import { log } from "./log"
import {
  appendNote,
  getFull,
  parseInsufficiency,
  parsePredictionObservation,
  parseUnknownNote,
  recall,
  unknownsStatus,
} from "./workflow-memory"
import {
  isSubagent,
  NOTE_TYPE_VALUES,
  NOTE_TYPES,
  RECALL_EXCERPT_CHARS,
  UNKNOWN_STATUSES,
  type SubagentType,
} from "./types"

const z = tool.schema

/**
 * Format a recall hit for the model. Keep it tight — recall output is
 * intermediate context, not a render artifact.
 */
function formatRecallHits(
  hits: ReturnType<typeof recall>,
  memorySize: { entries: number; notes: number },
): string {
  if (hits.length === 0) {
    if (memorySize.entries === 0 && memorySize.notes === 0) {
      return "Workflow memory is empty — this is the first step in the workflow, or memory is suppressed on triviality."
    }
    return `No results match (workflow memory has ${memorySize.entries} entries, ${memorySize.notes} notes). Try a broader query.`
  }

  const lines: string[] = []
  lines.push(`Found ${hits.length} result(s); newest first. Excerpts ≤${RECALL_EXCERPT_CHARS} chars.`)
  lines.push("")
  for (const h of hits) {
    const tag =
      h.kind === "note"
        ? `[note ${h.id}] ${h.subagent}/${h.noteType} topic="${h.topic}"`
        : `[entry ${h.id}] ${h.subagent}`
    lines.push(`${tag} (size=${h.size}):`)
    lines.push(h.excerpt)
    lines.push("")
  }
  lines.push(
    "Call workflow_recall again with a different query, or workflow_recall_full(id) " +
      "to fetch the verbatim body of any result.",
  )
  return lines.join("\n")
}

export const workflowRecallTool = tool({
  description:
    "Query the workflow-memory store for prior subagent outputs and analysis-specialist " +
    "notes WITHIN the current planning workflow. Use this when you need context from an " +
    "earlier step that was not threaded into your prompt — e.g. an earlier specialist's " +
    "note about a recurring pattern, or the verbatim output of a specific subagent. " +
    "Returns compact excerpts (newest first). Memory is cleared at the start of each " +
    "new workflow; this is NOT a cross-session store.",
  args: {
    query: z
      .string()
      .optional()
      .describe(
        "Free-text keyword search (lowercased substring across outputs, tags, topics, " +
          "and subagent names). Omit to list all results matching the other filters.",
      ),
    subagent: z
      .string()
      .optional()
      .describe(
        "Filter by author subagent (e.g. 'frame', 'librarian', 'skeptic'). Must be a " +
          "valid subagent type or the filter is ignored.",
      ),
    topic: z
      .string()
      .optional()
      .describe(
        "Note-only: substring match against note topic anchors (e.g. 'expectation:' " +
          "matches all expectation notes). Lowercased.",
      ),
    noteType: z
      .enum(NOTE_TYPE_VALUES)
      .optional()
      .describe(
        "Note-only: filter by note type. v0.20 adds 'unknown' (unknowns " +
          "ledger), 'contradiction' (cross-layer findings + re-frame triggers), " +
          "'assumption' (assumption-ledger). v0.21 adds 'prediction' (frame's " +
          "testable beliefs) and 'insufficiency' (rejected existing mechanisms).",
      ),
    kind: z
      .enum(["entry", "note", "both"])
      .optional()
      .describe("Restrict to entries, notes, or both (default: both)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Result cap (default 5, max 20)."),
  },
  async execute(args, context) {
    try {
      const s = getState(context.sessionID)
      const memory = s.workflowMemory
      if (!memory) {
        await log({
          kind: "workflow.recall",
          session: context.sessionID,
          query_keys: Object.keys(args).filter((k) => (args as Record<string, unknown>)[k] !== undefined),
          result_count: 0,
          empty: true,
        })
        return {
          title: "workflow_recall: empty",
          output:
            "Workflow memory is not initialized yet (no prior subagent captures, or this " +
            "workflow is in a triviality fast-path that skips memory).",
        }
      }

      const subagentArg = args.subagent
      const subagent: SubagentType | undefined = subagentArg && isSubagent(subagentArg) ? subagentArg : undefined

      const hits = recall(memory, {
        query: args.query,
        subagent,
        topic: args.topic,
        noteType: args.noteType,
        kind: args.kind,
        limit: args.limit,
      })

      await log({
        kind: "workflow.recall",
        session: context.sessionID,
        query_keys: Object.keys(args).filter((k) => (args as Record<string, unknown>)[k] !== undefined),
        result_count: hits.length,
        empty: false,
      })

      return {
        title: `workflow_recall: ${hits.length} result(s)`,
        output: formatRecallHits(hits, {
          entries: memory.entries.length,
          notes: memory.notes.length,
        }),
        metadata: { ids: hits.map((h) => h.id) },
      }
    } catch (err) {
      await log({
        kind: "error",
        session: context.sessionID,
        hook: "tool:workflow_recall",
        error: (err as Error).message,
      })
      return {
        title: "workflow_recall: error",
        output: "Workflow-memory recall failed (best-effort; continue without it).",
      }
    }
  },
})

export const workflowRecallFullTool = tool({
  description:
    "Fetch the verbatim body of a workflow-memory entry or note by its id (as returned " +
    "by `workflow_recall`). Use sparingly — only when the excerpt isn't sufficient.",
  args: {
    id: z.string().describe("Entry or note id, e.g. 'frame-001' or 'note-skeptic-002'."),
  },
  async execute(args, context) {
    try {
      const s = getState(context.sessionID)
      const memory = s.workflowMemory
      if (!memory) {
        return { title: "workflow_recall_full: empty", output: "Workflow memory is not initialized." }
      }
      const result = getFull(memory, args.id)
      if (result.kind === "miss") {
        return {
          title: "workflow_recall_full: miss",
          output: `No entry or note with id "${args.id}".`,
        }
      }
      if (result.kind === "entry") {
        const e = result.entry
        return {
          title: `entry ${e.id} (${e.subagent}, ${e.size} chars${e.truncated ? ", truncated" : ""})`,
          output: e.output,
        }
      }
      const n = result.note
      return {
        title: `note ${n.id} (${n.author}/${n.type}, topic="${n.topic}")`,
        output: n.content,
      }
    } catch (err) {
      await log({
        kind: "error",
        session: context.sessionID,
        hook: "tool:workflow_recall_full",
        error: (err as Error).message,
      })
      return { title: "workflow_recall_full: error", output: "Lookup failed." }
    }
  },
})

export const workflowNoteTool = tool({
  description:
    "Write a structured note into workflow memory. Only analysis specialists may call " +
    "this (skeptic, expectation-keeper, assumption-ledger, confidence-auditor, " +
    "scope-guard, falsifier). Notes are for cross-turn signals — patterns, concerns, " +
    "observations that later specialists can recall. Bounded: topic ≤80 chars, " +
    "content ≤200 chars.",
  args: {
    author: z
      .string()
      .describe(
        "Your own subagent name (e.g. 'skeptic', 'frame', 'synthesis'). Must be one " +
          "of the authorized subagents AND authorized for the chosen `type`; other " +
          "combinations are rejected. See NOTE_TYPE_AUTHORIZATION.",
      ),
    type: z
      .enum(NOTE_TYPE_VALUES)
      .describe(
        "Note category. Per-author allowed types are enforced. " +
          "observation = neutral finding (use 'V: confirmed|contradicted|inconclusive | E: ...' " +
          "when reconciling against a prediction P# topic); concern = potential issue; " +
          "pattern = recurring shape; retraction = withdraw a prior note; " +
          "unknown = unknowns-ledger entry (use 'Q: ... | I: ... | S: open|resolved|deferred | " +
          "R: pre_design|user_input|accept_risk | E: ...'); " +
          "contradiction = cross-source or cross-layer contradiction; " +
          "assumption = assumption-ledger entry; " +
          "prediction = frame's testable belief (content: '<claim> | Wrong if: <observable>', " +
          "topic 'P1', 'P2', ...); " +
          "insufficiency = rejected existing mechanism (content: 'M: <mechanism> | I: <named constraint>').",
      ),
    topic: z
      .string()
      .describe(
        "Short anchor for cross-step matching, e.g. 'expectation:postgresql' or " +
          "'pattern:frame-capture-risk'. Lowercased; substring-matched on recall.",
      ),
    content: z.string().describe("Body of the note (≤200 chars after trim)."),
    refs: z
      .array(z.string())
      .optional()
      .describe("Optional entry/note ids this note references (e.g. ['frame-001'])."),
  },
  async execute(args, context) {
    try {
      const s = getState(context.sessionID)
      const memory = s.workflowMemory
      if (!memory) {
        return {
          title: "workflow_note: memory not initialized",
          output:
            "Workflow memory has not been initialized yet (no prior subagent captures, or " +
            "this is a triviality fast-path). Note not recorded.",
        }
      }

      const authorArg = args.author
      if (!isSubagent(authorArg)) {
        await log({
          kind: "workflow.note",
          session: context.sessionID,
          author: authorArg,
          note_id: "<rejected>",
          type: args.type,
          topic: args.topic,
          rejected: true,
        })
        return {
          title: "workflow_note: rejected",
          output: `Author "${authorArg}" is not a recognized subagent type. Note not recorded.`,
        }
      }

      const result = appendNote(memory, {
        author: authorArg,
        type: args.type,
        topic: args.topic,
        content: args.content,
        refs: args.refs,
      })

      if (!result.ok) {
        await log({
          kind: "workflow.note",
          session: context.sessionID,
          author: authorArg,
          note_id: "<rejected>",
          type: args.type,
          topic: args.topic,
          rejected: true,
        })
        return {
          title: "workflow_note: rejected",
          output: `Note rejected: ${result.reason}.`,
        }
      }

      await log({
        kind: "workflow.note",
        session: context.sessionID,
        author: authorArg,
        note_id: result.note.id,
        type: result.note.type,
        topic: result.note.topic,
      })

      // v0.20 — Phase F: unknowns-ledger observability. Emit a structured log
      // for declared / resolved / deferred unknowns so we can iterate on
      // ledger behaviour empirically.
      if (result.note.type === NOTE_TYPES.unknown) {
        const parsed = parseUnknownNote(result.note.content)
        const status = parsed.status
        if (status === UNKNOWN_STATUSES.open) {
          await log({
            kind: "workflow.unknown.declared",
            session: context.sessionID,
            author: authorArg,
            topic: result.note.topic,
            question_excerpt: (parsed.question ?? result.note.content).slice(0, 160),
          })
        } else if (status === UNKNOWN_STATUSES.resolved) {
          await log({
            kind: "workflow.unknown.resolved",
            session: context.sessionID,
            author: authorArg,
            topic: result.note.topic,
            note_id: result.note.id,
            evidence_excerpt: (parsed.evidence ?? "").slice(0, 160),
          })
        } else if (status === UNKNOWN_STATUSES.deferred) {
          await log({
            kind: "workflow.unknown.deferred",
            session: context.sessionID,
            author: authorArg,
            topic: result.note.topic,
            reason_excerpt: (parsed.evidence ?? parsed.investigation ?? "").slice(0, 160),
          })
        }
      }

      // v0.21 — Predict-observe-compare loop observability.
      if (result.note.type === NOTE_TYPES.prediction) {
        await log({
          kind: "workflow.prediction.declared",
          session: context.sessionID,
          topic: result.note.topic,
          claim_excerpt: result.note.content.slice(0, 160),
        })
      } else if (result.note.type === NOTE_TYPES.observation) {
        // Only emit prediction.observed for observations whose topic looks
        // like a prediction id (P1, P2, p3, etc.) — the convention frame
        // emits and researchers reconcile against. Other observations
        // (general findings) don't carry a verdict and shouldn't pollute
        // the prediction log.
        if (/^p\d+$/i.test(result.note.topic)) {
          const parsedObs = parsePredictionObservation(result.note.content)
          await log({
            kind: "workflow.prediction.observed",
            session: context.sessionID,
            author: authorArg,
            topic: result.note.topic,
            verdict: parsedObs.verdict ?? "unparseable",
            evidence_excerpt: (parsedObs.evidence ?? result.note.content).slice(0, 160),
          })
        }
      }

      // v0.21 — Existing-solutions-check observability. Plan/frame writes one
      // insufficiency note per rejected mechanism; aggregate counts are
      // emitted by the orchestrator from frame/plan output parsing (see
      // hooks.ts parseExistingCheck), but each individual write is also
      // queryable via this log line.
      if (result.note.type === NOTE_TYPES.insufficiency) {
        const parsedIns = parseInsufficiency(result.note.content)
        await log({
          kind: "workflow.existing-check.declared",
          session: context.sessionID,
          author: authorArg,
          mechanisms: parsedIns.mechanism ? 1 : 0,
          rejections: parsedIns.insufficiencyReason ? 1 : 0,
        })
      }

      return {
        title: `workflow_note: ${result.note.id} recorded`,
        output: `Note ${result.note.id} recorded (type=${result.note.type}, topic="${result.note.topic}").`,
        metadata: { id: result.note.id },
      }
    } catch (err) {
      await log({
        kind: "error",
        session: context.sessionID,
        hook: "tool:workflow_note",
        error: (err as Error).message,
      })
      return { title: "workflow_note: error", output: "Note write failed (best-effort; continue)." }
    }
  },
})

/**
 * v0.20 — Tool that reports the status of all unknowns in the ledger.
 *
 * Used primarily by `unknowns-auditor` to gate the workflow before plan, but
 * any subagent may call it. Returns grouped buckets (open / resolved /
 * deferred / unparseable) with latest-per-topic semantics.
 */
export const workflowUnknownsStatusTool = tool({
  description:
    "Report the status of all unknowns in the workflow-memory ledger. Returns " +
    "grouped lists (open / resolved / deferred / unparseable). Each entry shows " +
    "the latest note for that topic. Use this to check whether any blocking " +
    "unknowns remain before committing to a plan, or to see which questions " +
    "the workflow surfaced that still need answers.",
  args: {},
  async execute(_args, context) {
    try {
      const s = getState(context.sessionID)
      const memory = s.workflowMemory
      if (!memory) {
        return {
          title: "workflow_unknowns_status: empty",
          output:
            "Workflow memory is not initialized — no unknowns recorded yet (or this is a " +
            "triviality fast-path that skips the unknowns ledger).",
        }
      }

      const report = unknownsStatus(memory)
      const total =
        report.open.length + report.resolved.length + report.deferred.length + report.unparseable.length

      if (total === 0) {
        return {
          title: "workflow_unknowns_status: no unknowns",
          output:
            "No unknown notes have been written this workflow. Either the framer did not " +
            "enumerate any open questions, or the task is in a triviality tier that skips " +
            "the ledger.",
        }
      }

      const formatEntry = (e: { topic: string; latestNoteId: string; author: SubagentType; question?: string; investigation?: string; evidence?: string; rawContent: string }): string => {
        const q = e.question ?? "<unparseable question>"
        const evidence = e.evidence ? ` — evidence: ${e.evidence}` : ""
        const investigation = e.investigation ? ` (I: ${e.investigation})` : ""
        return `  - ${e.topic} [${e.latestNoteId} by ${e.author}]: ${q}${investigation}${evidence}`
      }

      const lines: string[] = []
      lines.push(`Unknowns ledger: ${report.open.length} open / ${report.resolved.length} resolved / ${report.deferred.length} deferred / ${report.unparseable.length} unparseable`)
      lines.push("")

      if (report.open.length > 0) {
        lines.push(`## ${UNKNOWN_STATUSES.open.toUpperCase()} (blocking)`)
        for (const e of report.open) lines.push(formatEntry(e))
        lines.push("")
      }
      if (report.resolved.length > 0) {
        lines.push(`## ${UNKNOWN_STATUSES.resolved.toUpperCase()}`)
        for (const e of report.resolved) lines.push(formatEntry(e))
        lines.push("")
      }
      if (report.deferred.length > 0) {
        lines.push(`## ${UNKNOWN_STATUSES.deferred.toUpperCase()}`)
        for (const e of report.deferred) lines.push(formatEntry(e))
        lines.push("")
      }
      if (report.unparseable.length > 0) {
        lines.push("## UNPARSEABLE (notes that did not follow the Q/I/S/E convention)")
        for (const e of report.unparseable) {
          lines.push(`  - ${e.topic} [${e.latestNoteId} by ${e.author}]: ${e.rawContent.slice(0, 120)}`)
        }
        lines.push("")
      }

      return {
        title: `workflow_unknowns_status: ${report.open.length} open, ${total} total`,
        output: lines.join("\n"),
        metadata: {
          open: report.open.length,
          resolved: report.resolved.length,
          deferred: report.deferred.length,
          unparseable: report.unparseable.length,
        },
      }
    } catch (err) {
      await log({
        kind: "error",
        session: context.sessionID,
        hook: "tool:workflow_unknowns_status",
        error: (err as Error).message,
      })
      return {
        title: "workflow_unknowns_status: error",
        output: "Unknowns status lookup failed (best-effort; continue).",
      }
    }
  },
})
