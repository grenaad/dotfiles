/**
 * flow-agent scheduler.
 *
 * Walks the WAVES list, dispatches each wave's nodes in parallel via
 * Promise.all, accumulates outputs, and returns the final FlowResult.
 *
 * Failure behavior:
 *   - A failed/timed-out node returns a NodeOutput with parsed=false and an
 *     error field; the scheduler keeps going so downstream nodes can at
 *     least see the partial outputs they have.
 *   - The critique wave (Wave 6) is skipped if the draft_plan node succeeded
 *     AND a quick deterministic check passes. This is Q4.c from the design:
 *     lean on TS where we can.
 */

import type { createOpencodeClient } from "@opencode-ai/sdk"

import { runNode } from "./executor"
import { WAVES, CRITIQUE_WAVE_INDEX } from "./graph"
import { log } from "./log"
import { getNodeDef } from "./nodes"
import type { FlowResult, NodeName, NodeOutput, NodeOutputs } from "./types"

type Client = ReturnType<typeof createOpencodeClient>

/** Names of the critique nodes that may be skipped. */
const CRITIQUE_NODES: ReadonlySet<NodeName> = new Set([
  "critique_completeness",
  "critique_traceability",
])

/**
 * Deterministic check: does the draft_plan contain all required section
 * headings? If yes, skip the critique wave to save 2 model calls.
 *
 * This mirrors arc-agent's required-section enforcement (Phase 4) but is
 * a single source of truth inside flow-agent.
 */
const REQUIRED_SECTIONS: readonly string[] = [
  "## What you asked for",
  "## Approach",
  "## Placement",
  "## Signature",
  "## Integration",
  "## Test cases",
  "## Failure modes",
  "## Alternatives Considered",
  "## Sanity Check",
  "## Files touched",
]

/**
 * Defensive lookup for the draft plan's markdown body.
 *
 * The model is supposed to return `{"plan_markdown": "..."}`, but it can
 * make typos (e.g. "plan_markmark") or use variants like "plan_md" or
 * "final_markdown". We accept any string-valued key whose name looks
 * like a plan-content key, and otherwise fall back to the largest
 * string field in the object — that's almost always the plan body.
 */
function extractPlanMarkdown(draftOutput: NodeOutput | undefined): string | null {
  if (!draftOutput?.data) return null
  const data = draftOutput.data

  // 1. Exact match.
  const exact = data["plan_markdown"]
  if (typeof exact === "string" && exact.length > 0) return exact

  // 2. Fuzzy key match: anything with "plan" + a markdown-ish suffix.
  const planKeyPattern = /^(plan|final|draft)[_-]?(markdown|markmark|md|content|body|text)$/i
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && v.length > 0 && planKeyPattern.test(k)) return v
  }

  // 3. Fallback: the largest string field in the object.
  let bestKey: string | null = null
  let bestLen = 0
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && v.length > bestLen) {
      bestLen = v.length
      bestKey = k
    }
  }
  if (bestKey && bestLen >= 500) return data[bestKey] as string
  return null
}

function planLooksComplete(draftOutput: NodeOutput | undefined): boolean {
  const md = extractPlanMarkdown(draftOutput)
  if (!md) return false
  return REQUIRED_SECTIONS.every((h) => md.includes(h))
}

export interface RunDagArgs {
  client: Client
  mainSessionID: string
  ask: string
}

export async function runDag(args: RunDagArgs): Promise<FlowResult> {
  const flowStart = Date.now()
  const outputs: NodeOutputs = {}
  const failures: NodeName[] = []
  const waveDurations: FlowResult["waveDurations"] = []

  await log({
    kind: "flow.start",
    session: args.mainSessionID,
    ask_chars: args.ask.length,
  })

  for (const wave of WAVES) {
    // Decide which nodes in this wave actually run.
    let toRun = wave.nodes
    if (wave.index === CRITIQUE_WAVE_INDEX) {
      // Conditional critique wave.
      if (planLooksComplete(outputs.draft_plan)) {
        // Skip critique entirely.
        toRun = []
      }
    }

    if (toRun.length === 0) {
      await log({
        kind: "wave.end",
        session: args.mainSessionID,
        wave: wave.index,
        duration_ms: 0,
        nodes: [],
      })
      continue
    }

    const waveStart = Date.now()

    // Log wave starts for visibility.
    await Promise.all(
      toRun.map((node) => {
        const def = getNodeDef(node)
        return log({
          kind: "node.start",
          session: args.mainSessionID,
          wave: wave.index,
          node,
          tier: def.tier,
        })
      }),
    )

    // Dispatch all nodes in this wave concurrently.
    const results = await Promise.all(
      toRun.map(async (node) => {
        const def = getNodeDef(node)
        const out = await runNode({
          client: args.client,
          mainSessionID: args.mainSessionID,
          def,
          ask: args.ask,
          upstream: outputs,
        })
        await log({
          kind: "node.end",
          session: args.mainSessionID,
          wave: wave.index,
          node,
          tier: def.tier,
          duration_ms: out.durationMs,
          output_chars: out.raw.length,
          parsed: out.parsed,
          timed_out: out.timedOut,
          error: out.error,
        })
        return { node, out }
      }),
    )

    for (const { node, out } of results) {
      outputs[node] = out
      if (out.timedOut || out.error) failures.push(node)
    }

    const waveMs = Date.now() - waveStart
    waveDurations.push({ wave: wave.index, durationMs: waveMs, nodes: toRun })
    await log({
      kind: "wave.end",
      session: args.mainSessionID,
      wave: wave.index,
      duration_ms: waveMs,
      nodes: toRun,
    })
  }

  // Render the final output deterministically (no model call).
  const rendered = renderFinalPlan(outputs)

  await log({
    kind: "flow.end",
    session: args.mainSessionID,
    total_ms: Date.now() - flowStart,
    failures,
    rendered_chars: rendered.length,
  })

  return {
    outputs,
    totalDurationMs: Date.now() - flowStart,
    waveDurations,
    rendered,
    failures,
  }
}

/**
 * Pure-TS final render — replaces the former render_final model node.
 *
 * Why TS?
 *   The job is mostly transport: take draft_plan.plan_markdown and (if
 *   critique returned issues) append a small "## Critique Addendum"
 *   section. A model call here is wasteful — it just re-emits the 10k+
 *   char draft to add ~300 chars of bullets, and can time out doing it.
 *
 * Behavior:
 *   1. If draft_plan.plan_markdown is non-empty, that's the body.
 *   2. If the critique wave ran (it isn't always — gated by
 *      planLooksComplete) AND found issues, append an addendum.
 *   3. If everything is missing/empty, return a diagnostic dump for
 *      debugging.
 */
function renderFinalPlan(outputs: NodeOutputs): string {
  const draftMd = extractPlanMarkdown(outputs.draft_plan)
  if (!draftMd) {
    // No plan body — dump everything for debugging.
    const partials = Object.entries(outputs)
      .map(([k, v]) => `### ${k}\n\`\`\`json\n${JSON.stringify(v?.data ?? { error: v?.error }, null, 2)}\n\`\`\``)
      .join("\n\n")
    return `# flow-agent: rendering failed\n\nNo plan content found. Partial outputs:\n\n${partials}`
  }

  const addendum = buildCritiqueAddendum(outputs)
  if (addendum) {
    return draftMd.trimEnd() + "\n\n" + addendum
  }
  return draftMd
}

/**
 * Build a small markdown addendum from the two critique nodes' outputs.
 * Returns empty string when both critiques are absent or empty.
 */
function buildCritiqueAddendum(outputs: NodeOutputs): string {
  const compl = outputs.critique_completeness?.data
  const trace = outputs.critique_traceability?.data

  if (!compl && !trace) return ""

  const lines: string[] = []

  // Completeness
  const missing = Array.isArray(compl?.missing_items) ? (compl["missing_items"] as unknown[]) : []
  const severity = typeof compl?.severity === "string" ? (compl["severity"] as string) : "none"
  if (missing.length > 0 && severity !== "none") {
    lines.push(`**Missing items (severity: ${severity}):**`)
    for (const m of missing.slice(0, 8)) {
      if (typeof m === "object" && m !== null) {
        const o = m as Record<string, unknown>
        lines.push(`- ${o["criterion"] ?? "?"} — ${o["what_is_missing"] ?? "?"}`)
      } else {
        lines.push(`- ${String(m)}`)
      }
    }
  }

  // Traceability
  const orphaned = Array.isArray(trace?.orphaned_findings) ? (trace["orphaned_findings"] as unknown[]) : []
  const unsupported = Array.isArray(trace?.unsupported_claims)
    ? (trace["unsupported_claims"] as unknown[])
    : []

  if (orphaned.length > 0) {
    lines.push(``, `**Orphaned findings (upstream evidence not used in plan):**`)
    for (const o of orphaned.slice(0, 6)) {
      if (typeof o === "object" && o !== null) {
        const obj = o as Record<string, unknown>
        lines.push(`- ${obj["finding"] ?? "?"} (from ${obj["source_node"] ?? "?"})`)
      } else {
        lines.push(`- ${String(o)}`)
      }
    }
  }

  if (unsupported.length > 0) {
    lines.push(``, `**Unsupported claims (no upstream backing):**`)
    for (const u of unsupported.slice(0, 6)) {
      if (typeof u === "object" && u !== null) {
        const obj = u as Record<string, unknown>
        lines.push(`- ${obj["claim"] ?? "?"} — ${obj["why_suspect"] ?? "?"}`)
      } else {
        lines.push(`- ${String(u)}`)
      }
    }
  }

  if (lines.length === 0) return ""
  return "## Critique Addendum\n\n" + lines.join("\n")
}

export { CRITIQUE_NODES, REQUIRED_SECTIONS, planLooksComplete, renderFinalPlan }
