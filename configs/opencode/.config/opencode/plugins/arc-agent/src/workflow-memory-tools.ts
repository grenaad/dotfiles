/**
 * v0.25.1 — Tools exposed for querying workflow memory.
 *
 * Three tools:
 *   workflow_recall      — read entries and notes by author / topic / keyword
 *   workflow_recall_full — fetch the verbatim body of a recall hit by id
 *   workflow_note        — write a structured note
 *
 * The orchestrator (primary agent) and the 5 surviving subagents can all
 * call these tools. Each tool resolves the caller's `context.sessionID` to
 * the root session via `client.session.get → parentID` so subagent calls
 * land in the orchestrator's ArcState.
 *
 * All tools are best-effort: failures return empty/rejected payloads,
 * never throw.
 */

import { tool } from "@opencode-ai/plugin"
import type { createOpencodeClient } from "@opencode-ai/sdk"

import { getState } from "./state"
import { log } from "./log"
import { appendNote, getFull, recall } from "./workflow-memory"
import {
  NOTE_TYPE_VALUES,
  RECALL_EXCERPT_CHARS,
  isSubagent,
  type SubagentType,
} from "./types"

type Client = ReturnType<typeof createOpencodeClient>

const z = tool.schema

/**
 * Per-process cache of resolved child→root session mappings.
 * The orchestrator → subagent relationship is stable within a workflow.
 *
 * v0.26.12: cache stores both rootSessionID AND rootAgent so callers can
 * gate plugin behavior on whether the workflow is rooted at an orchestrator
 * agent (vs build, plan, quick-answer, etc.). Failures are cached too —
 * a transient SDK hiccup default-denies for the rest of the session rather
 * than triggering retry storms.
 */
interface CachedRoot {
  rootSessionID: string
  rootAgent: string | null
  resolutionFailed: boolean
}

const parentResolutionCache = new Map<string, CachedRoot>()

export function evictParentCache(sessionID: string): void {
  parentResolutionCache.delete(sessionID)
}

const PARENT_WALK_MAX_DEPTH = 8

interface SessionGetData {
  data?: { id?: string; parentID?: string; agent?: string }
}

export async function resolveRootSessionID(
  client: Client,
  sessionID: string,
): Promise<CachedRoot> {
  const cached = parentResolutionCache.get(sessionID)
  if (cached) return cached

  let current = sessionID
  let currentAgent: string | null = null
  const visited = new Set<string>([current])

  for (let depth = 0; depth < PARENT_WALK_MAX_DEPTH; depth++) {
    let session: { id?: string; parentID?: string; agent?: string } | undefined
    try {
      const result = (await client.session.get({
        path: { id: current },
      })) as SessionGetData
      session = result.data
    } catch {
      const out: CachedRoot = { rootSessionID: current, rootAgent: currentAgent, resolutionFailed: true }
      parentResolutionCache.set(sessionID, out)
      return out
    }
    currentAgent = session?.agent ?? null
    if (!session || !session.parentID) {
      const out: CachedRoot = { rootSessionID: current, rootAgent: currentAgent, resolutionFailed: false }
      parentResolutionCache.set(sessionID, out)
      return out
    }
    if (visited.has(session.parentID)) {
      const out: CachedRoot = { rootSessionID: current, rootAgent: currentAgent, resolutionFailed: false }
      parentResolutionCache.set(sessionID, out)
      return out
    }
    current = session.parentID
    visited.add(current)
  }

  const out: CachedRoot = { rootSessionID: current, rootAgent: currentAgent, resolutionFailed: false }
  parentResolutionCache.set(sessionID, out)
  return out
}

function formatRecallHits(
  hits: ReturnType<typeof recall>,
  memorySize: { entries: number; notes: number },
): string {
  if (hits.length === 0) {
    if (memorySize.entries === 0 && memorySize.notes === 0) {
      return "Workflow memory is empty — this is the first step in the workflow."
    }
    return `No results match (workflow memory has ${memorySize.entries} entries, ${memorySize.notes} notes). Try a broader query.`
  }

  const lines: string[] = []
  lines.push(
    `Found ${hits.length} result(s); newest first. Excerpts ≤${RECALL_EXCERPT_CHARS} chars.`,
  )
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

export function makeWorkflowRecallTool(client: Client) {
  return tool({
    description:
      "Query the workflow-memory store for prior subagent outputs and notes " +
      "WITHIN the current planning workflow. Use this when you need context " +
      "from an earlier step. Returns compact excerpts (newest first). " +
      "Memory is cleared at the start of each new workflow; this is NOT a " +
      "cross-session store.",
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
          "Filter by author (e.g. 'orchestrator', 'review', 'cost-checker').",
        ),
      topic: z
        .string()
        .optional()
        .describe(
          "Note-only: substring match against note topic anchors. Lowercased.",
        ),
      noteType: z
        .enum(NOTE_TYPE_VALUES)
        .optional()
        .describe(
          "Note-only: filter by type. Categories: observation (neutral finding), " +
            "concern (potential issue), pattern (recurring shape), retraction (withdraw).",
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
        const { rootSessionID } = await resolveRootSessionID(client, context.sessionID)
        const s = getState(rootSessionID)
        const memory = s.workflowMemory
        if (!memory) {
          await log({
            kind: "workflow.recall",
            session: rootSessionID,
            query_keys: Object.keys(args).filter(
              (k) => (args as Record<string, unknown>)[k] !== undefined,
            ),
            result_count: 0,
            empty: true,
          })
          return {
            title: "workflow_recall: empty",
            output: "Workflow memory is not initialized yet (no prior captures).",
          }
        }

        const subagentArg = args.subagent
        let subagentFilter: SubagentType | "orchestrator" | undefined
        if (subagentArg === "orchestrator") {
          subagentFilter = "orchestrator"
        } else if (subagentArg && isSubagent(subagentArg)) {
          subagentFilter = subagentArg
        }

        const hits = recall(memory, {
          query: args.query,
          subagent: subagentFilter,
          topic: args.topic,
          noteType: args.noteType,
          kind: args.kind,
          limit: args.limit,
        })

        await log({
          kind: "workflow.recall",
          session: rootSessionID,
          query_keys: Object.keys(args).filter(
            (k) => (args as Record<string, unknown>)[k] !== undefined,
          ),
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
}

export function makeWorkflowRecallFullTool(client: Client) {
  return tool({
    description:
      "Fetch the verbatim body of a workflow-memory entry or note by its id " +
      "(as returned by workflow_recall). Use sparingly — only when the " +
      "excerpt isn't sufficient.",
    args: {
      id: z
        .string()
        .describe("Entry or note id, e.g. 'orchestrator-001' or 'note-review-002'."),
    },
    async execute(args, context) {
      try {
        const { rootSessionID } = await resolveRootSessionID(client, context.sessionID)
        const s = getState(rootSessionID)
        const memory = s.workflowMemory
        if (!memory) {
          return {
            title: "workflow_recall_full: empty",
            output: "Workflow memory is not initialized.",
          }
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
}

export function makeWorkflowNoteTool(client: Client) {
  return tool({
    description:
      "Write a structured note into workflow memory. Notes are short " +
      "cross-turn signals (observations, concerns, patterns, retractions) " +
      "that later turns or fresh-eyes subagents can recall. Bounded: topic " +
      "≤80 chars, content ≤200 chars.",
    args: {
      author: z
        .string()
        .describe(
          "Your own agent name (e.g. 'orchestrator', 'review', 'critic'). Must be " +
            "the primary orchestrator or one of the 5 surviving subagents AND " +
            "authorized for the chosen `type`.",
        ),
      type: z
        .enum(NOTE_TYPE_VALUES)
        .describe(
          "Note category. observation = neutral finding; concern = potential issue; " +
            "pattern = recurring shape; retraction = withdraw a prior note.",
        ),
      topic: z
        .string()
        .describe(
          "Short anchor for cross-step matching, e.g. 'pattern:auth-drift' or " +
            "'concern:race-condition'. Lowercased; substring-matched on recall.",
        ),
      content: z.string().describe("Body of the note (≤200 chars after trim)."),
      refs: z
        .array(z.string())
        .optional()
        .describe("Optional entry/note ids this note references."),
    },
    async execute(args, context) {
      try {
        const { rootSessionID, resolutionFailed } = await resolveRootSessionID(
          client,
          context.sessionID,
        )
        const s = getState(rootSessionID)
        const memory = s.workflowMemory
        if (!memory) {
          await log({
            kind: "workflow.note.memory-uninitialized",
            session: context.sessionID,
            root_session: rootSessionID,
            resolution_failed: resolutionFailed || undefined,
            author: args.author,
            type: args.type,
            topic: args.topic,
          })
          return {
            title: "workflow_note: memory not initialized",
            output: "Workflow memory has not been initialized yet. Note not recorded.",
          }
        }

        const authorArg = args.author
        let author: SubagentType | "orchestrator"
        if (authorArg === "orchestrator") {
          author = "orchestrator"
        } else if (isSubagent(authorArg)) {
          author = authorArg
        } else {
          await log({
            kind: "workflow.note",
            session: rootSessionID,
            author: authorArg,
            note_id: "<rejected>",
            type: args.type,
            topic: args.topic,
            rejected: true,
          })
          return {
            title: "workflow_note: rejected",
            output: `Author "${authorArg}" is not a recognized agent. Note not recorded.`,
          }
        }

        const result = appendNote(memory, {
          author,
          type: args.type,
          topic: args.topic,
          content: args.content,
          refs: args.refs,
        })

        if (!result.ok) {
          await log({
            kind: "workflow.note",
            session: rootSessionID,
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
          session: rootSessionID,
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
        return {
          title: "workflow_note: error",
          output: "Note write failed (best-effort; continue).",
        }
      }
    },
  })
}
