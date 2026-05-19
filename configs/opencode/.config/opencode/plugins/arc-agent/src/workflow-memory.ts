/**
 * v0.19 — Workflow-memory store: intra-workflow cross-turn memory.
 *
 * Purpose
 * -------
 * Solves Sub-problem A: a subagent fired at Step 5 may need to know what
 * happened at Step 2 — not just the captured artifact, but the meta-context
 * (which subagent produced it, what tags it carried, what structured notes
 * other specialists left).
 *
 * Design
 * ------
 * - Append-only. Entries are subagent outputs (auto-captured). Notes are
 *   structured cross-turn signals (authored by analysis specialists).
 * - Per-workflow scope. State lives in ArcState.workflowMemory and is cleared
 *   when a new workflow starts (detected via restater after existing entries).
 * - In-memory only. No disk, no network. Reset on session end.
 * - Pure data + pure functions; no model calls, no async I/O.
 *
 * Indexing strategy: linear scan. With workflow sizes ≤ ~30 entries, the
 * complexity of a real index (inverted, trie, etc.) is unjustified.
 */

import {
  ENTRY_MAX_CHARS,
  NOTE_MAX_CHARS,
  NOTE_TOPIC_MAX_CHARS,
  RECALL_DEFAULT_LIMIT,
  RECALL_EXCERPT_CHARS,
  RECALL_MAX_LIMIT,
  WRITE_NOTE_SUBAGENTS,
  type SubagentType,
  type TrivialityTier,
  type WorkflowEntry,
  type WorkflowMemoryState,
  type WorkflowNote,
} from "./types"

// --- Construction -----------------------------------------------------------

export function createMemory(triviality?: TrivialityTier): WorkflowMemoryState {
  return {
    startedAtMs: Date.now(),
    entries: [],
    notes: [],
    nextEntrySeq: 1,
    nextNoteSeqByAuthor: {},
    trivialityAtCreation: triviality,
  }
}

// --- Writes -----------------------------------------------------------------

export interface AppendEntryInput {
  subagent: SubagentType
  output: string
}

/**
 * Append an entry. Truncates output to ENTRY_MAX_CHARS at a paragraph boundary
 * when possible. Returns the appended entry (with stable id assigned).
 */
export function appendEntry(state: WorkflowMemoryState, input: AppendEntryInput): WorkflowEntry {
  const seq = state.nextEntrySeq++
  const id = `${input.subagent}-${String(seq).padStart(3, "0")}`
  const originalSize = input.output.length

  let body = input.output
  let truncated = false
  if (body.length > ENTRY_MAX_CHARS) {
    const cut = bestCutAt(body, ENTRY_MAX_CHARS)
    body = body.slice(0, cut).trimEnd() + "\n\n[arc-agent: workflow-memory truncated this entry]"
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

export type AppendNoteInput =
  | {
      kind: "ok"
      author: SubagentType
      type: WorkflowNote["type"]
      topic: string
      content: string
      refs: string[]
    }
  | {
      kind: "rejected"
      reason: string
    }

/**
 * Append a note. Validates the author is in WRITE_NOTE_SUBAGENTS and that the
 * content / topic fit the size caps. Returns either the appended note or a
 * structured rejection (so callers can log it).
 */
export function appendNote(
  state: WorkflowMemoryState,
  input: {
    author: SubagentType
    type: WorkflowNote["type"]
    topic: string
    content: string
    refs?: string[]
  },
): { ok: true; note: WorkflowNote } | { ok: false; reason: string } {
  if (!WRITE_NOTE_SUBAGENTS.has(input.author)) {
    return { ok: false, reason: `subagent "${input.author}" is not authorized to write notes` }
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
  /** Free-text keyword query. Lowercase substring across output + tags + topic. */
  query?: string
  /** Filter by author subagent. */
  subagent?: SubagentType
  /** Filter by note topic (substring match, case-insensitive). */
  topic?: string
  /** Filter by note type. */
  noteType?: WorkflowNote["type"]
  /** Which store to read: entries-only, notes-only, or both. Default: "both". */
  kind?: "entry" | "note" | "both"
  /** Result cap (default RECALL_DEFAULT_LIMIT, max RECALL_MAX_LIMIT). */
  limit?: number
}

export interface RecallHit {
  kind: "entry" | "note"
  id: string
  /** Sequence number for ordering. */
  seq: number
  /** Author/source subagent. */
  subagent: SubagentType
  /** ms since workflow start. */
  tMs: number
  /** Compact excerpt of the body. */
  excerpt: string
  /** Original full size (chars) of the underlying body. */
  size: number
  /** Note-only: topic anchor. */
  topic?: string
  /** Note-only: type. */
  noteType?: WorkflowNote["type"]
  /** Entry-only: extracted tags. */
  tags?: string[]
}

export function recall(state: WorkflowMemoryState, q: RecallQuery): RecallHit[] {
  const kind = q.kind ?? "both"
  const limit = Math.min(Math.max(1, q.limit ?? RECALL_DEFAULT_LIMIT), RECALL_MAX_LIMIT)
  const needle = q.query?.toLowerCase().trim() ?? ""
  const topicNeedle = q.topic?.toLowerCase().trim() ?? ""

  const hits: RecallHit[] = []

  if (kind === "entry" || kind === "both") {
    for (const e of state.entries) {
      if (q.subagent && e.subagent !== q.subagent) continue
      if (needle.length > 0 && !entryMatches(e, needle)) continue
      // topic filter doesn't apply to entries; skip if topic was the only filter
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

  // Sort by time (newest first) — recency is usually more relevant for recall.
  hits.sort((a, b) => b.tMs - a.tMs)
  return hits.slice(0, limit)
}

/**
 * Fetch the full body of an entry or note by id. Used for follow-up reads
 * after the excerpt-based recall surfaces a candidate.
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

/**
 * Produce a short excerpt of body for recall results. Centers around the
 * match when needle is present; otherwise returns the head.
 */
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

/**
 * Best-effort cut point for entry truncation: prefer paragraph boundary, then
 * line boundary, then word boundary, falling back to hard cut.
 */
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

/**
 * Extract tags from a subagent output for indexing. Pulls:
 *   - markdown section headings (## Foo, ### Bar)
 *   - bolded leading terms (**Key insight**, **Verdict**)
 *   - inline-code identifiers (`<file:line>` shapes — limited)
 *
 * Lowercased, deduped, capped at MAX_TAGS.
 */
const MAX_TAGS = 25
function extractTags(text: string): string[] {
  const tags = new Set<string>()

  // Headings: ## foo or ### bar
  const headingRe = /^#{2,6}\s+(.+?)\s*$/gm
  for (const m of text.matchAll(headingRe)) {
    const raw = (m[1] ?? "").trim().toLowerCase()
    if (raw.length > 0 && raw.length <= 80) tags.add(raw)
  }

  // Bold leading terms: **Foo:** or **Foo**
  const boldLeadRe = /\*\*([^*]+?)\*\*\s*:/g
  for (const m of text.matchAll(boldLeadRe)) {
    const raw = (m[1] ?? "").trim().toLowerCase()
    if (raw.length > 0 && raw.length <= 60) tags.add(raw)
  }

  // Specific verdict words that drive workflow routing.
  const verdictRe = /\b(verdict|picked|delta unchanged|sources are consistent|key insight)\b/gi
  for (const m of text.matchAll(verdictRe)) {
    const w = (m[1] ?? "").toLowerCase()
    if (w) tags.add(w)
  }

  return Array.from(tags).slice(0, MAX_TAGS)
}
