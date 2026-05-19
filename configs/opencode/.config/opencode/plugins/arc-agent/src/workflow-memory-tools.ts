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
import { appendNote, getFull, recall } from "./workflow-memory"
import { isSubagent, RECALL_EXCERPT_CHARS, type SubagentType, type WorkflowNote } from "./types"

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
    "Call workflow_recall again with a different query, or `workflow_recall_full` is not exposed — " +
      "use entry/note ids in subsequent reasoning as references.",
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
      .enum(["observation", "concern", "pattern", "retraction"])
      .optional()
      .describe("Note-only: filter by note type."),
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
        "Your own subagent name (e.g. 'skeptic'). Must be one of the analysis-specialist " +
          "subagents; other authors are rejected.",
      ),
    type: z
      .enum(["observation", "concern", "pattern", "retraction"])
      .describe(
        "observation = neutral finding; concern = potential issue surfaced; " +
          "pattern = recurring shape worth flagging; retraction = withdraw a prior note.",
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
          author: "skeptic", // best-effort placeholder for the log shape
          note_id: "<rejected>",
          type: args.type as WorkflowNote["type"],
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
          type: args.type as WorkflowNote["type"],
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
