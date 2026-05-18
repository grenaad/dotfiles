/**
 * Single-node executor.
 *
 * Uses the same promptAsync + poll pattern as arc-agent's helper:
 *   1. Create (or reuse) a child session of the main session.
 *   2. Fire promptAsync to that child session with the node's prompt,
 *      pinned to deepseek/deepseek-v4-pro with the right --variant.
 *   3. Poll session.messages until the latest assistant text part has
 *      time.end set, then return its text.
 *
 * Each call is wrapped in a deadline (AbortController). On timeout we
 * call session.abort server-side and return a NodeOutput with timedOut=true.
 *
 * Network/parse failures are caught and surfaced as NodeOutput.error so
 * the scheduler can keep going.
 */

import type {
  createOpencodeClient,
  Part,
  TextPart,
  AssistantMessage,
  Message,
} from "@opencode-ai/sdk"

import {
  FLOW_MODEL_PROVIDER,
  FLOW_MODEL_ID,
  NODE_TIMEOUT_SCOUT_MS,
  NODE_TIMEOUT_SYNTHESIZE_MS,
} from "./constants"
import type { EffortTier, NodeDef, NodeOutput, NodeOutputs } from "./types"

type Client = ReturnType<typeof createOpencodeClient>

const POLL_INTERVAL_MS = 500

const SYSTEM_PROMPT =
  "You are a flow-agent dataflow node. You receive a structured prompt that " +
  "describes what to produce. Respond with a single fenced JSON code block " +
  "containing the requested fields, and nothing else. No prose outside the " +
  "code fence. If you must add a 'notes' field, keep it short."

interface SessionCreateOk {
  data?: { id?: string }
}

interface MessagesResponseOk {
  data?: Array<{ info: Message; parts: Part[] }>
}

/**
 * Create a fresh child session for a single node call.
 *
 * Why one session per node?
 *   Nodes in the same wave run in parallel via Promise.all. If they all
 *   shared one child session, the concurrent promptAsync calls would race
 *   and the polling logic (which looks for "latest assistant message after
 *   start") would conflate them. Per-call sessions give clean isolation
 *   and let us inspect each node's prompt/output independently in the DB.
 *
 *   The cost is one session.create per node (no model call — just a UUID
 *   allocation on the server). Negligible.
 */
async function createNodeSession(client: Client, mainSessionID: string, nodeName: string): Promise<string> {
  const created = (await client.session.create({
    body: { parentID: mainSessionID, title: `flow-agent:${nodeName}` },
  })) as SessionCreateOk

  const id = created.data?.id
  if (!id) throw new Error("session.create returned no id")
  return id
}

function timeoutForTier(tier: EffortTier): number {
  return tier === "synthesize" ? NODE_TIMEOUT_SYNTHESIZE_MS : NODE_TIMEOUT_SCOUT_MS
}

/**
 * The v1 OpenCode plugin SDK's promptAsync body does not currently expose
 * the `variant` field (it's a CLI/v2 SDK concept). For v0.1 we pin only the
 * model and rely on the timeout-tier to differentiate scout vs synthesize.
 * Once the SDK exposes variant, set this back to the proper variant.
 *
 * TODO(flow-agent v0.2): wire --variant once SDK supports it.
 */

class AbortError extends Error {
  constructor() {
    super("node call aborted")
    this.name = "AbortError"
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new AbortError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function findCompletedAssistantText(
  messages: Array<{ info: Message; parts: Part[] }>,
  afterTimestamp: number,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.info.role !== "assistant") continue
    const am = m.info as AssistantMessage
    if (am.time.created < afterTimestamp) continue

    const textParts = m.parts.filter((p): p is TextPart => p.type === "text")
    if (textParts.length === 0) continue

    const messageDone = typeof am.time.completed === "number"
    const textsDone = textParts.every((p) => typeof p.time?.end === "number")

    if (messageDone || textsDone) {
      return textParts.map((p) => p.text).join("\n").trim()
    }
    return null
  }
  return null
}

/**
 * Extract a JSON object from a model response.
 *
 * Models often wrap JSON in ```json … ``` fences, but the JSON payload may
 * itself contain literal triple-backticks inside string values (e.g. when
 * `plan_markdown` embeds a Python code snippet). A naive non-greedy fence
 * regex stops at the first inner fence and returns truncated JSON.
 *
 * Strategy (in order):
 *   1. If a ```json fenced block exists, take the content between the FIRST
 *      opening ``` and the LAST closing ``` (greedy).
 *   2. Direct JSON.parse.
 *   3. Brace-balanced scan over the original text, returning the first
 *      complete `{ ... }` block that parses.
 *   4. Return null.
 */
function extractJSON(text: string): Record<string, unknown> | null {
  const candidates: string[] = []

  // 1. Greedy fence: opening ```json (or ```), last closing ```.
  const openFence = text.match(/```(?:json)?\s*\n?/)
  if (openFence && openFence.index !== undefined) {
    const start = openFence.index + openFence[0].length
    const tail = text.slice(start)
    const lastFence = tail.lastIndexOf("```")
    if (lastFence > 0) {
      candidates.push(tail.slice(0, lastFence).trim())
    }
  }
  candidates.push(text.trim())

  for (const candidate of candidates) {
    // Direct parse.
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      /* fall through */
    }

    // Brace-balanced scan over THIS candidate. We need string-aware scanning
    // because the JSON may contain `}` inside string literals; a naive depth
    // counter would close too early. Track whether we're inside a string
    // (with escape support) so braces inside strings are ignored.
    const firstBrace = candidate.indexOf("{")
    if (firstBrace < 0) continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = firstBrace; i < candidate.length; i++) {
      const ch = candidate[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (inString) {
        if (ch === "\\") escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          try {
            const parsed = JSON.parse(candidate.slice(firstBrace, i + 1))
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              return parsed as Record<string, unknown>
            }
          } catch {
            /* try next candidate */
          }
          break
        }
      }
    }
  }
  return null
}

export interface RunNodeArgs {
  client: Client
  mainSessionID: string
  def: NodeDef
  ask: string
  upstream: NodeOutputs
}

export async function runNode(args: RunNodeArgs): Promise<NodeOutput> {
  const start = Date.now()
  const deadline = timeoutForTier(args.def.tier)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deadline)

  // Track the per-call child session ID so the catch block can abort it.
  let helperID: string | undefined

  try {
    helperID = await createNodeSession(args.client, args.mainSessionID, args.def.name)
    const prompt = args.def.buildPrompt(args.ask, args.upstream)

    // Fire promptAsync pinned to the chosen model for this tier.
    // Variant pending SDK support — see TODO above.
    await args.client.session.promptAsync({
      path: { id: helperID },
      body: {
        parts: [{ type: "text", text: prompt }],
        system: SYSTEM_PROMPT,
        model: {
          providerID: FLOW_MODEL_PROVIDER,
          modelID: FLOW_MODEL_ID,
        },
      },
    })

    // Poll for completion.
    const callStart = Date.now()
    while (true) {
      if (controller.signal.aborted) throw new AbortError()
      await sleep(POLL_INTERVAL_MS, controller.signal)

      const resp = (await args.client.session.messages({
        path: { id: helperID },
      })) as MessagesResponseOk

      const messages = resp.data ?? []
      const text = findCompletedAssistantText(messages, callStart)
      if (text !== null) {
        const data = extractJSON(text)
        return {
          data,
          raw: text,
          parsed: data !== null,
          durationMs: Date.now() - start,
          timedOut: false,
        }
      }
    }
  } catch (err) {
    const isAbort = err instanceof AbortError || (err as Error).name === "AbortError"

    if (isAbort && helperID) {
      // Tell the server to stop processing this node's child session.
      try {
        await args.client.session.abort({ path: { id: helperID } })
      } catch {
        /* swallow */
      }
    }

    return {
      data: null,
      raw: "",
      parsed: false,
      durationMs: Date.now() - start,
      timedOut: isAbort,
      error: isAbort ? "timeout" : (err as Error).message ?? "unknown error",
    }
  } finally {
    clearTimeout(timer)
  }
}
