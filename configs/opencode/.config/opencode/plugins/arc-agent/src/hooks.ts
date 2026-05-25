/**
 * v0.25.1 hook implementations for the integrated orchestrator.
 *
 * Orchestrator does its own investigation/drafting; plugin's only job:
 *   1. experimental.text.complete — mechanically scan completed plan text for
 *      v0.26 adoption-gap violations and write workflow notes.
 *   2. tool.execute.before — inject slim preamble + enforce ceilings on the
 *      5 surviving subagent dispatches (review, critic, confidence-auditor,
 *      cost-checker, falsifier).
 *   3. tool.execute.after — capture review verdict; capture entry into
 *      workflow memory; fire plan-quality measurement when the orchestrator
 *      dispatches `review` (the prompt-to-review contains the drafted plan).
 *   4. event — session cleanup.
 *
 * Every hook is wrapped in a top-level try/catch so plugin errors are logged
 * and the workflow continues unchanged.
 */

import type { Hooks } from "@opencode-ai/plugin"
import type { createOpencodeClient, Event } from "@opencode-ai/sdk"
import { dirname, join, relative } from "node:path"
import { existsSync } from "node:fs"

import { clearState, ensureWorkflowMemory, getState, resetWorkflowMemory } from "./state"
import { log } from "./log"
import { appendEntry } from "./workflow-memory"
import { extractTaskType, hasPlanHeading, normalizeVerdict } from "./analyzers"
import {
  CONVENTIONS_MARKER,
  DELEGATION_PREAMBLE,
  PREAMBLE_MARKER,
  REASONING_CONVENTIONS,
} from "./constants"
import { measurePlanQuality } from "./plan-quality"
import { detectAndPersistViolations } from "./violation-pipeline"
import { CEILINGS, isSubagent, isTaskToolArgs, type ArcState, type SubagentType } from "./types"
import { evictParentCache, resolveRootSessionID } from "./workflow-memory-tools"

type Client = ReturnType<typeof createOpencodeClient>

const ENV_DISABLE = "ARC_AGENT_DISABLED" as const
const DISABLED = process.env[ENV_DISABLE] === "1"
const TEXT_COMPLETE_MIN_PLAN_CHARS = 2_000
const MAX_BUFFERED_PLAN_CHARS = 60_000
/**
 * Investigation tool budget for *subagents only*.
 *
 * As of v0.26.11 the budget mechanism is scoped exclusively to advisory
 * subagents dispatched by the orchestrator (review, critic, confidence-
 * auditor, cost-checker, falsifier, unverified-auditor, compound-cause-
 * auditor). Their job is narrow: ingest a plan slice, return a verdict
 * or audit. They should not sprawl through 50 reads/greps before reporting.
 *
 * Primary agents — orchestrator, build, plan, quick-answer, and any other
 * top-level agent the user invokes directly — are NOT budgeted. They are
 * the user's primary working agent and must be free to read/grep/bash as
 * the task requires. Nagging them halfway through real work was a
 * misapplication of the mechanism.
 *
 * Subagent detection is by `parentID` presence on the session. The Task
 * tool always creates child sessions with parentID set; top-level user
 * sessions never have one. This is more robust than maintaining an
 * agent-name allowlist (which drifted out of sync with custom agents).
 */
const INVESTIGATION_TOOL_BUDGET = 18
const INVESTIGATION_TOOLS = new Set(["read", "grep", "glob", "webfetch", "bash"])
const DEPRECATED_SUBAGENTS = new Set([
  "frame",
  "librarian",
  "explore",
  "spike",
  "restater",
  "synthesis",
  "alternatives",
  "delta-mapper",
  "ambiguity-spotter",
  "edgecases",
  "batch-planner",
  "scope-guard",
  "expectation-keeper",
  "unknowns-auditor",
  "frame-validity-check",
  "skeptic",
  "assumption-ledger",
  "decision-options",
  "plan",
])

const childSessionCache = new Map<string, boolean>()

interface SessionGetData {
  data?: { id?: string; parentID?: string; directory?: string }
}

interface PathToolArgs {
  filePath?: unknown
  path?: unknown
}

interface PermissionLike {
  type?: unknown
  pattern?: unknown
  sessionID?: unknown
}


function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastNL = slice.lastIndexOf("\n\n")
  const cut = lastNL > max * 0.8 ? lastNL : slice.lastIndexOf("\n")
  const body = (cut > 0 ? slice.slice(0, cut) : slice).trimEnd()
  return body + `\n\n[truncated by arc-agent: prompt was ${text.length} chars, ceiling ${max}]`
}

/**
 * Prepend delegation preamble + REASONING CONVENTIONS if not already present.
 * v0.25.1: single (slim) variant — all 5 survivor subagents are short verdict-
 * emitters or fresh-eyes auditors that don't need the full DeepSeek lecture.
 */
function injectPreamble(prompt: string): string {
  const head = prompt.slice(0, 500)
  const hasPreamble = head.includes(PREAMBLE_MARKER)
  const hasConventions =
    head.includes(CONVENTIONS_MARKER) || prompt.slice(0, 2000).includes(CONVENTIONS_MARKER)
  if (hasPreamble && hasConventions) return prompt
  const pieces: string[] = []
  if (!hasPreamble) pieces.push(DELEGATION_PREAMBLE, "")
  if (!hasConventions) pieces.push(REASONING_CONVENTIONS, "")
  pieces.push(prompt)
  return pieces.join("\n")
}

function hasFalsificationHeading(text: string): boolean {
  return /^#{1,3}\s+Falsification\b/im.test(text)
}

function accumulatePlanCandidate(state: ArcState, text: string): string | null {
  const prior = state.pendingPlanText
  if (!prior && !hasPlanHeading(text)) return null

  const combined = prior ? `${prior}\n\n${text}` : text
  state.pendingPlanText =
    combined.length > MAX_BUFFERED_PLAN_CHARS
      ? combined.slice(combined.length - MAX_BUFFERED_PLAN_CHARS)
      : combined
  return state.pendingPlanText
}

function isCompletePlanCandidate(text: string): boolean {
  return (
    text.length >= TEXT_COMPLETE_MIN_PLAN_CHARS &&
    hasPlanHeading(text) &&
    hasFalsificationHeading(text)
  )
}

function isLikelyFinalPlanMissingFalsification(text: string): boolean {
  if (text.length < TEXT_COMPLETE_MIN_PLAN_CHARS) return false
  if (!hasPlanHeading(text)) return false
  if (hasFalsificationHeading(text)) return false
  const planishHeadings = text.match(
    /^#{2,3}\s+(?:What you asked for|Findings|Diagnosis|Assumptions|Architecture Decisions|Change Set|Implementation Steps|Recommendation|Verification|Test Plan|Open Decisions for the user|What I couldn't verify)\b/gim,
  ) ?? []
  return planishHeadings.length >= 3
}

function questionArgsHaveOptionalDocScopeRisk(args: unknown): boolean {
  if (typeof args !== "object" || args === null) return false
  const questions = (args as { questions?: unknown }).questions
  if (!Array.isArray(questions)) return false
  const optionalCapabilityRe =
    /\b(?:stream(?:ing)?|image(?: input)?|image_url|multimodal|function calling|tool calling|reasoning_effort|batch mode|async client|async api)\b/i
  const deferRe = /\b(?:defer|no public|text \+ structured|match current|existing surface|current surface|minimal|smallest)\b/i
  for (const q of questions) {
    if (typeof q !== "object" || q === null) continue
    const options = (q as { options?: unknown }).options
    if (!Array.isArray(options)) continue
    for (const opt of options) {
      if (typeof opt !== "object" || opt === null) continue
      const label = String((opt as { label?: unknown }).label ?? "")
      const description = String((opt as { description?: unknown }).description ?? "")
      const text = `${label} ${description}`
      if (!/\(Recommended\)/.test(label)) continue
      if (!optionalCapabilityRe.test(text)) continue
      if (deferRe.test(text)) continue
      return true
    }
  }
  return false
}

function normalizePlanText(text: string): { text: string; rewrites: string[] } {
  let next = text
  const rewrites: string[] = []

  if (/^###\s+Falsification\b/im.test(next)) {
    next = next.replace(/^###\s+Falsification\b/im, "## Falsification")
    rewrites.push("promote-falsification-heading")
  }

  if (!/^#{1,3}\s+(Findings|Diagnosis|Key Findings)\b/im.test(next)) {
    if (/^##\s+Coverage Analysis\b/im.test(next)) {
      next = next.replace(/^##\s+Coverage Analysis\b.*$/im, "## Findings")
      rewrites.push("coverage-analysis-to-findings")
    }
  }

  return { text: next, rewrites }
}

async function isChildSession(client: Client, sessionID: string): Promise<boolean> {
  const cached = childSessionCache.get(sessionID)
  if (cached !== undefined) return cached

  try {
    const result = (await client.session.get({ path: { id: sessionID } })) as SessionGetData
    const isChild = Boolean(result.data?.parentID)
    childSessionCache.set(sessionID, isChild)
    return isChild
  } catch {
    // Best-effort guard. If session lookup fails, do not suppress detection.
    childSessionCache.set(sessionID, false)
    return false
  }
}

/**
 * v0.26.12 — Identify whether a session is part of an orchestrator workflow.
 *
 * Returns true iff:
 *   - The session is the orchestrator running as a primary session, OR
 *   - The session is a subagent whose root ancestor's agent is "orchestrator".
 *
 * Returns false on lookup failure (default-deny: build/plan unaffected if
 * the SDK call hiccups). The underlying resolveRootSessionID caches both
 * success and failure, so this helper is O(1) after the first call per
 * session.
 *
 * This is the single gate for plugin behaviors that should not touch
 * non-orchestrator agents (build, plan, quick-answer, custom user agents).
 */
async function isOrchestratorWorkflow(client: Client, sessionID: string): Promise<boolean> {
  const { rootAgent, resolutionFailed } = await resolveRootSessionID(client, sessionID)
  if (resolutionFailed) return false
  return rootAgent === "orchestrator"
}

function privateAlias(path: string): string {
  return path.startsWith("/private/var/") ? path.slice("/private".length) : path
}

async function getSessionDirectory(client: Client, sessionID: string): Promise<string | null> {
  try {
    const result = (await client.session.get({ path: { id: sessionID } })) as SessionGetData
    return result.data?.directory ?? null
  } catch {
    return null
  }
}

function normalizeWorkspacePath(raw: string, directory: string): string | null {
  const value = privateAlias(raw)
  const root = privateAlias(directory)
  if (!value.startsWith(root + "/")) return null
  const rel = relative(root, value)
  if (!rel || rel.startsWith("..") || rel.startsWith("/")) return null
  return rel
}

function normalizeWorkspaceSiblingPath(raw: string, directory: string): string | null {
  const value = privateAlias(raw).replace(/\/\*$/, "")
  const root = privateAlias(directory)
  const parent = dirname(root)
  if (!value.startsWith(parent + "/") || value.startsWith(root + "/")) return null

  const relFromParent = relative(parent, value)
  if (!relFromParent || relFromParent.startsWith("..") || relFromParent.startsWith("/")) return null

  const [top] = relFromParent.split("/")
  if (!top || top === relative(parent, root)) return null
  if (!existsSync(join(root, top))) return null
  return relFromParent
}

function normalizesIntoWorkspace(raw: string, directory: string): boolean {
  const cleaned = raw.replace(/\/\*$/, "")
  return Boolean(normalizeWorkspacePath(cleaned, directory) ?? normalizeWorkspaceSiblingPath(cleaned, directory))
}

function isPermissionLike(x: unknown): x is PermissionLike {
  return typeof x === "object" && x !== null
}

function isPathToolArgs(x: unknown): x is PathToolArgs {
  return typeof x === "object" && x !== null
}

function budgetSentinel(count: number, budget: number = INVESTIGATION_TOOL_BUDGET): string {
  return [
    `TOOL BUDGET EXCEEDED: ${count}/${budget} read/search/fetch calls have completed.`,
    "Stop investigating now. Synthesize the plan with the evidence already gathered.",
    "If uncertainty remains, mark it as ⚠️ in Findings and include it in ## Falsification.",
  ].join("\n")
}

function deprecatedSubagentPrompt(name: string): string {
  return [
    `Deprecated subagent dispatch blocked: ${name}`,
    "Return exactly one sentence: Deprecated subagent blocked; synthesize with current evidence instead.",
    "Do not inspect files, run tools, ask questions, or provide advisory review.",
  ].join("\n")
}

/**
 * Heuristic: detect the orchestrator's plan-draft prompt inside a `review`
 * dispatch. The orchestrator typically dispatches review with a body that
 * contains the full plan text (so review can audit it). If the prompt body
 * contains both `## Falsification` AND a Plan-class heading, we treat it as
 * the orchestrator's plan-draft content and fire plan-quality measurement.
 */
function extractPlanFromReviewPrompt(prompt: string): string | null {
  if (!prompt.includes("## Falsification") && !hasPlanHeading(prompt)) return null
  return prompt
}

export function buildHooks(client: Client): Hooks {
  if (DISABLED) {
    return {
      event: async () => {
        /* disabled */
      },
    }
  }

  return {
    "permission.ask": async (input, output) => {
      try {
        if (!isPermissionLike(input)) return
        if (input.type !== "external_directory") return
        if (typeof input.sessionID !== "string") return
        const directory = await getSessionDirectory(client, input.sessionID)
        if (!directory) return
        const patterns = Array.isArray(input.pattern) ? input.pattern : [input.pattern]
        const raw = patterns.find((p): p is string => typeof p === "string" && normalizesIntoWorkspace(p, directory))
        if (!raw) return
        output.status = "allow"
        await log({
          kind: "workflow.path.permission_allow",
          session: input.sessionID,
          pattern: raw,
        })
      } catch (err) {
        const sessionID = isPermissionLike(input) && typeof input.sessionID === "string" ? input.sessionID : "unknown"
        const s = getState(sessionID)
        s.hookErrors.push({
          hook: "permission.ask",
          t: Date.now(),
          error: (err as Error).message,
        })
        await log({
          kind: "error",
          session: sessionID,
          hook: "permission.ask",
          error: (err as Error).message,
        })
      }
    },

    "experimental.text.complete": async (input, output) => {
      try {
        const s = getState(input.sessionID)
        if (s.violationsDetected) return
        if (await isChildSession(client, input.sessionID)) return
        // v0.26.12: skip plan-text normalization + violation telemetry for
        // non-orchestrator workflows. Build/plan/quick-answer/custom primary
        // agents emit their output unchanged.
        if (!(await isOrchestratorWorkflow(client, input.sessionID))) return

        const normalized = normalizePlanText(output.text)
        if (normalized.rewrites.length > 0) {
          output.text = normalized.text
          await log({
            kind: "workflow.plan.normalize",
            session: input.sessionID,
            rewrites: normalized.rewrites,
          })
        }

        const text = output.text.trim()
        if (text.length === 0) return
        s.assistantTextParts = (s.assistantTextParts ?? 0) + 1

        const planText = accumulatePlanCandidate(s, text)
        if (!planText || !isCompletePlanCandidate(planText)) return

        const taskType = extractTaskType(planText) ?? "fix"
        s.taskType = taskType

        await detectAndPersistViolations({
          sessionID: input.sessionID,
          state: s,
          plan: planText,
          taskType,
          source: "experimental.text.complete",
        })
        s.pendingPlanText = undefined
      } catch (err) {
        const s = getState(input.sessionID)
        s.hookErrors.push({
          hook: "experimental.text.complete",
          t: Date.now(),
          error: (err as Error).message,
        })
        await log({
          kind: "error",
          session: input.sessionID,
          hook: "experimental.text.complete",
          error: (err as Error).message,
        })
      }
    },

    "tool.execute.before": async (input, output) => {
      try {
        if ((input.tool === "read" || input.tool === "grep" || input.tool === "glob") && isPathToolArgs(output.args)) {
          const directory = await getSessionDirectory(client, input.sessionID)
          if (directory) {
            const key = input.tool === "read" ? "filePath" : "path"
            const raw = output.args[key]
            if (typeof raw === "string") {
              const normalized = normalizeWorkspacePath(raw, directory) ?? normalizeWorkspaceSiblingPath(raw, directory)
              if (normalized && normalized !== raw) {
                output.args = { ...output.args, [key]: normalized }
                await log({
                  kind: "workflow.path.normalize",
                  session: input.sessionID,
                  tool: input.tool,
                  field: key,
                  from: raw,
                  to: normalized,
                })
              }
            }
          }
        }

        if (input.tool !== "task") return
        // v0.26.12: subagent-handling logic (preamble injection, ceiling
        // truncation, deprecated rewrites, plan-quality measurement) is
        // orchestrator-only. If a non-orchestrator agent invokes Task
        // directly, that dispatch passes through untouched.
        if (!(await isOrchestratorWorkflow(client, input.sessionID))) return
        if (!isTaskToolArgs(output.args)) return
        if (!isSubagent(output.args.subagent_type)) {
          const requested = output.args.subagent_type
          if (!DEPRECATED_SUBAGENTS.has(requested)) return
          output.args = {
            ...output.args,
            subagent_type: "critic",
            description: "Deprecated subagent dispatch blocked",
            prompt: deprecatedSubagentPrompt(requested),
          }
          await log({
            kind: "workflow.deprecated_subagent.block",
            session: input.sessionID,
            requested_subagent: requested,
            replacement_subagent: "critic",
          })
        }

        const sub: SubagentType = output.args.subagent_type
        const s = getState(input.sessionID)

        let working = output.args.prompt
        const originalChars = working.length

        // Inject slim preamble + reasoning conventions.
        working = injectPreamble(working)

        // Enforce per-subagent ceiling.
        const ceiling = CEILINGS[sub]
        const ceilingHit = working.length > ceiling
        if (ceilingHit) {
          working = truncateAtBoundary(working, ceiling)
        }

        // Plan-quality measurement: only on `review` dispatches, only once
        // per workflow. The orchestrator dispatching review is the signal
        // that a plan has been drafted.
        if (sub === "review" && !s.planQualityMeasured) {
          const planText = extractPlanFromReviewPrompt(output.args.prompt)
          if (planText) {
            const taskType = extractTaskType(planText) ?? "feature"
            s.taskType = taskType
            const q = measurePlanQuality(planText, taskType)
            s.planQualityMeasured = true
            await log({
              kind: "workflow.plan.quality",
              session: input.sessionID,
              task_type: taskType,
              load_bearing_refs: q.loadBearingRefs,
              grounded: q.grounded,
              checkable_wrong_if: q.checkableWrongIf,
              forbidden_phrase_count: q.forbiddenPhraseCount,
              oversized_sections: q.oversizedSections,
            })
          }
        }

        output.args = { ...output.args, prompt: working }

        await log({
          kind: "tool.execute.before",
          session: input.sessionID,
          subagent: sub,
          original_chars: originalChars,
          final_chars: working.length,
          ceiling_hit: ceilingHit,
        })
      } catch (err) {
        const s = getState(input.sessionID)
        s.hookErrors.push({
          hook: "tool.execute.before",
          t: Date.now(),
          error: (err as Error).message,
        })
        await log({
          kind: "error",
          session: input.sessionID,
          hook: "tool.execute.before",
          error: (err as Error).message,
        })
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        if (INVESTIGATION_TOOLS.has(input.tool)) {
          const s = getState(input.sessionID)
          // v0.26.12: counter increments for sessions that might trigger
          // the budget sentinel OR contribute to orchestrator-workflow
          // telemetry. Build/plan as primary sessions don't count.
          // readFiles/greppedPatterns tracking stays universal — it's
          // harmless state used by the falsifier-references-unread-file
          // detector when an orchestrator workflow later inspects it.
          const isSubagent = await isChildSession(client, input.sessionID)
          const isOrchWorkflow = await isOrchestratorWorkflow(client, input.sessionID)
          if (isSubagent || isOrchWorkflow) {
            const count = (s.investigationToolCalls ?? 0) + 1
            s.investigationToolCalls = count
            // Subagent budget enforcement — unchanged from v0.26.11.
            if (isSubagent && count > INVESTIGATION_TOOL_BUDGET) {
              output.output = budgetSentinel(count, INVESTIGATION_TOOL_BUDGET)
              output.title = "tool budget exceeded"
              if (!s.investigationBudgetWarned) {
                s.investigationBudgetWarned = true
                await log({
                  kind: "workflow.tool_budget",
                  session: input.sessionID,
                  tool: input.tool,
                  count,
                  budget: INVESTIGATION_TOOL_BUDGET,
                  action: "warn-output",
                })
              }
            }
          }
          // v0.26.7 — track read files and grep patterns for falsifier audit.
          // Universal: cheap state, only consumed by orchestrator workflows.
          if (input.tool === "read" && isPathToolArgs(input.args)) {
            const fp = input.args.filePath
            if (typeof fp === "string") {
              if (!s.readFiles) s.readFiles = new Set()
              s.readFiles.add(fp)
              // also add basename so falsifier text can match either form
              const base = fp.split("/").pop()
              if (base) s.readFiles.add(base)
            }
          }
          if (input.tool === "grep" && isPathToolArgs(input.args)) {
            const pat = (input.args as { pattern?: unknown }).pattern
            if (typeof pat === "string") {
              if (!s.greppedPatterns) s.greppedPatterns = new Set()
              s.greppedPatterns.add(pat)
            }
          }
        }

        if (input.tool === "question") {
          if (await isOrchestratorWorkflow(client, input.sessionID)) {
            const s = getState(input.sessionID)
            s.questionDispatched = true
            if (questionArgsHaveOptionalDocScopeRisk(input.args)) {
              s.optionalDocScopeExpansionQuestion = true
            }
          }
          return
        }

        if (input.tool !== "task") return
        // v0.26.12: only capture Task results into workflow memory for
        // orchestrator workflows. A build/plan agent invoking Task directly
        // does not feed into the orchestrator's memory store.
        if (!(await isOrchestratorWorkflow(client, input.sessionID))) return
        if (!isTaskToolArgs(input.args)) return
        if (!isSubagent(input.args.subagent_type)) return

        const sub: SubagentType = input.args.subagent_type
        const s = getState(input.sessionID)

        // Surface the subagent output for workflow-memory capture.
        const outputText =
          typeof output.output === "string"
            ? output.output
            : output.output != null
              ? JSON.stringify(output.output)
              : ""

        // Capture into workflow memory (cross-turn recall).
        if (outputText.length > 0) {
          const memory = ensureWorkflowMemory(s)
          const entry = appendEntry(memory, { subagent: sub, output: outputText })
          await log({
            kind: "workflow.capture",
            session: input.sessionID,
            subagent: sub,
            entry_id: entry.id,
            size: entry.size,
            truncated: entry.truncated,
            tag_count: entry.tags.length,
            memory_total_entries: memory.entries.length,
          })
        }

        // Capture review verdict.
        if (sub === "review") {
          const verdict = normalizeVerdict(outputText)
          if (verdict) {
            s.normalizedVerdict = verdict
          }
          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: outputText.length,
            normalized_verdict: verdict ?? undefined,
          })
          return
        }

        await log({
          kind: "tool.execute.after",
          session: input.sessionID,
          subagent: sub,
          original_chars: outputText.length,
        })
      } catch (err) {
        const s = getState(input.sessionID)
        s.hookErrors.push({
          hook: "tool.execute.after",
          t: Date.now(),
          error: (err as Error).message,
        })
        await log({
          kind: "error",
          session: input.sessionID,
          hook: "tool.execute.after",
          error: (err as Error).message,
        })
      }
    },

    event: async ({ event }) => {
      try {
        const e = event as Event
        if (e.type === "session.idle") {
          const props = (e as { properties?: { sessionID?: string } }).properties
          if (props?.sessionID) {
            const s = getState(props.sessionID)
            if (!s.violationsDetected && s.pendingPlanText && isLikelyFinalPlanMissingFalsification(s.pendingPlanText)) {
              if (!(await isChildSession(client, props.sessionID)) && await isOrchestratorWorkflow(client, props.sessionID)) {
                const taskType = extractTaskType(s.pendingPlanText) ?? "fix"
                s.taskType = taskType
                await detectAndPersistViolations({
                  sessionID: props.sessionID,
                  state: s,
                  plan: s.pendingPlanText,
                  taskType,
                  source: "event.session.idle",
                })
                s.pendingPlanText = undefined
              }
            }
          }
        }
        if (e.type === "session.deleted") {
          const props = (e as { properties?: { sessionID?: string } }).properties
          if (props?.sessionID) {
            // Reset workflow memory if it had entries (a workflow ended).
            const s = getState(props.sessionID)
            if (s.workflowMemory && s.workflowMemory.entries.length > 0) {
              resetWorkflowMemory(s)
            }
            childSessionCache.delete(props.sessionID)
            evictParentCache(props.sessionID)
            clearState(props.sessionID)
          }
        }
      } catch {
        /* swallow */
      }
    },
  }
}
