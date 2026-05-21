/**
 * Workflow-memory store: intra-workflow cross-turn memory.
 *
 * v0.25.1: simplified for the integrated orchestrator. The orchestrator does
 * the investigation and writes summary notes; the 5 surviving advisory
 * subagents (review, critic, confidence-auditor, cost-checker, falsifier)
 * read notes for fresh-eyes context.
 *
 * Append-only. In-memory only. Cleared between workflows.
 */

import {
  ENTRY_MAX_CHARS,
  NOTE_MAX_CHARS,
  NOTE_TOPIC_MAX_CHARS,
  NOTE_TYPE_AUTHORIZATION,
  RECALL_DEFAULT_LIMIT,
  RECALL_EXCERPT_CHARS,
  RECALL_MAX_LIMIT,
  WRITE_NOTE_SUBAGENTS,
  type SubagentType,
  type WorkflowEntry,
  type WorkflowMemoryState,
  type WorkflowNote,
} from "./types"

// --- Construction -----------------------------------------------------------

export function createMemory(): WorkflowMemoryState {
  return {
    startedAtMs: Date.now(),
    entries: [],
    notes: [],
    nextEntrySeq: 1,
    nextNoteSeqByAuthor: {},
  }
}

// --- Writes -----------------------------------------------------------------

export interface AppendEntryInput {
  subagent: SubagentType | "orchestrator"
  output: string
}

/**
 * Append an entry. Truncates output to ENTRY_MAX_CHARS at a paragraph boundary
 * when possible.
 */
export function appendEntry(
  state: WorkflowMemoryState,
  input: AppendEntryInput,
): WorkflowEntry {
  const seq = state.nextEntrySeq++
  const id = `${input.subagent}-${String(seq).padStart(3, "0")}`
  const originalSize = input.output.length

  let body = input.output
  let truncated = false
  if (body.length > ENTRY_MAX_CHARS) {
    const cut = bestCutAt(body, ENTRY_MAX_CHARS)
    body =
      body.slice(0, cut).trimEnd() +
      "\n\n[arc-agent: workflow-memory truncated this entry]"
    truncated = true
  }

  const entry: WorkflowEntry = {
    id,
    seq,
    subagent: input.subagent,
    tMs: Date.now() - state.startedAtMs,
    output: body,
    size: originalSize,
    truncated,
    tags: extractTags(body),
  }
  state.entries.push(entry)
  return entry
}

/**
 * Append a note. Validates the author is in WRITE_NOTE_SUBAGENTS (or is the
 * orchestrator) and that the per-author type authorization permits the type.
 */
export function appendNote(
  state: WorkflowMemoryState,
  input: {
    author: SubagentType | "orchestrator"
    type: WorkflowNote["type"]
    topic: string
    content: string
    refs?: string[]
  },
): { ok: true; note: WorkflowNote } | { ok: false; reason: string } {
  // Orchestrator can write any note type.
  if (input.author !== "orchestrator") {
    if (!WRITE_NOTE_SUBAGENTS.has(input.author)) {
      return {
        ok: false,
        reason: `subagent "${input.author}" is not authorized to write notes`,
      }
    }
    const allowedTypes = NOTE_TYPE_AUTHORIZATION[input.author]
    if (!allowedTypes || !allowedTypes.includes(input.type)) {
      return {
        ok: false,
        reason: `subagent "${input.author}" is not authorized to write notes of type "${input.type}" (allowed: ${(allowedTypes ?? []).join(", ") || "none"})`,
      }
    }
  }

  if (input.topic.length === 0) {
    return { ok: false, reason: "topic is required" }
  }
  if (input.content.length === 0) {
    return { ok: false, reason: "content is required" }
  }

  const topic = input.topic.slice(0, NOTE_TOPIC_MAX_CHARS).toLowerCase().trim()
  const content = input.content.slice(0, NOTE_MAX_CHARS).trim()

  const seq = (state.nextNoteSeqByAuthor[input.author] ?? 0) + 1
  state.nextNoteSeqByAuthor[input.author] = seq
  const id = `note-${input.author}-${String(seq).padStart(3, "0")}`

  const note: WorkflowNote = {
    id,
    seq,
    author: input.author,
    tMs: Date.now() - state.startedAtMs,
    type: input.type,
    topic,
    content,
    refs: (input.refs ?? []).slice(0, 8),
  }
  state.notes.push(note)
  return { ok: true, note }
}

// --- Reads / Recall ---------------------------------------------------------

export interface RecallQuery {
  query?: string
  subagent?: SubagentType | "orchestrator"
  topic?: string
  noteType?: WorkflowNote["type"]
  kind?: "entry" | "note" | "both"
  limit?: number
}

export interface RecallHit {
  kind: "entry" | "note"
  id: string
  seq: number
  subagent: SubagentType | "orchestrator"
  tMs: number
  excerpt: string
  size: number
  topic?: string
  noteType?: WorkflowNote["type"]
  tags?: string[]
}

export function recall(state: WorkflowMemoryState, q: RecallQuery): RecallHit[] {
  const kind = q.kind ?? "both"
  const limit = Math.min(
    Math.max(1, q.limit ?? RECALL_DEFAULT_LIMIT),
    RECALL_MAX_LIMIT,
  )
  const needle = q.query?.toLowerCase().trim() ?? ""
  const topicNeedle = q.topic?.toLowerCase().trim() ?? ""

  const hits: RecallHit[] = []

  if (kind === "entry" || kind === "both") {
    for (const e of state.entries) {
      if (q.subagent && e.subagent !== q.subagent) continue
      if (needle.length > 0 && !entryMatches(e, needle)) continue
      if (q.topic && needle.length === 0 && !q.subagent) continue
      hits.push({
        kind: "entry",
        id: e.id,
        seq: e.seq,
        subagent: e.subagent,
        tMs: e.tMs,
        excerpt: makeExcerpt(e.output, needle),
        size: e.size,
        tags: e.tags,
      })
    }
  }

  if (kind === "note" || kind === "both") {
    for (const n of state.notes) {
      if (q.subagent && n.author !== q.subagent) continue
      if (q.noteType && n.type !== q.noteType) continue
      if (topicNeedle.length > 0 && !n.topic.includes(topicNeedle)) continue
      if (needle.length > 0 && !noteMatches(n, needle)) continue
      hits.push({
        kind: "note",
        id: n.id,
        seq: n.seq,
        subagent: n.author,
        tMs: n.tMs,
        excerpt: makeExcerpt(n.content, needle),
        size: n.content.length,
        topic: n.topic,
        noteType: n.type,
      })
    }
  }

  hits.sort((a, b) => b.tMs - a.tMs)
  return hits.slice(0, limit)
}

/**
 * Fetch the full body of an entry or note by id.
 */
export function getFull(
  state: WorkflowMemoryState,
  id: string,
):
  | { kind: "entry"; entry: WorkflowEntry }
  | { kind: "note"; note: WorkflowNote }
  | { kind: "miss" } {
  for (const e of state.entries) {
    if (e.id === id) return { kind: "entry", entry: e }
  }
  for (const n of state.notes) {
    if (n.id === id) return { kind: "note", note: n }
  }
  return { kind: "miss" }
}

// --- Internals --------------------------------------------------------------

function entryMatches(e: WorkflowEntry, needle: string): boolean {
  if (e.output.toLowerCase().includes(needle)) return true
  for (const tag of e.tags) {
    if (tag.toLowerCase().includes(needle)) return true
  }
  if (e.subagent.includes(needle)) return true
  return false
}

function noteMatches(n: WorkflowNote, needle: string): boolean {
  if (n.content.toLowerCase().includes(needle)) return true
  if (n.topic.includes(needle)) return true
  if (n.author.includes(needle)) return true
  return false
}

function makeExcerpt(body: string, needle: string): string {
  if (body.length <= RECALL_EXCERPT_CHARS) return body
  if (needle.length === 0) {
    return body.slice(0, RECALL_EXCERPT_CHARS).trimEnd() + "…"
  }
  const idx = body.toLowerCase().indexOf(needle)
  if (idx < 0) {
    return body.slice(0, RECALL_EXCERPT_CHARS).trimEnd() + "…"
  }
  const half = Math.floor(RECALL_EXCERPT_CHARS / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(body.length, start + RECALL_EXCERPT_CHARS)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < body.length ? "…" : ""
  return prefix + body.slice(start, end).trim() + suffix
}

function bestCutAt(text: string, max: number): number {
  if (text.length <= max) return text.length
  const slice = text.slice(0, max)
  const para = slice.lastIndexOf("\n\n")
  if (para > max * 0.8) return para
  const line = slice.lastIndexOf("\n")
  if (line > max * 0.85) return line
  const space = slice.lastIndexOf(" ")
  if (space > max * 0.9) return space
  return max
}

const MAX_TAGS = 25
function extractTags(text: string): string[] {
  const tags = new Set<string>()

  const headingRe = /^#{2,6}\s+(.+?)\s*$/gm
  for (const m of text.matchAll(headingRe)) {
    const raw = (m[1] ?? "").trim().toLowerCase()
    if (raw.length > 0 && raw.length <= 80) tags.add(raw)
  }

  const boldLeadRe = /\*\*([^*]+?)\*\*\s*:/g
  for (const m of text.matchAll(boldLeadRe)) {
    const raw = (m[1] ?? "").trim().toLowerCase()
    if (raw.length > 0 && raw.length <= 60) tags.add(raw)
  }

  const verdictRe = /\b(verdict|picked|key insight)\b/gi
  for (const m of text.matchAll(verdictRe)) {
    const w = (m[1] ?? "").toLowerCase()
    if (w) tags.add(w)
  }

  return Array.from(tags).slice(0, MAX_TAGS)
}
