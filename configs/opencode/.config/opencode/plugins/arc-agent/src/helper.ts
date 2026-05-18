/**
 * Semantic helper that calls the model for transforms where a regex would be brittle.
 *
 * Architecture: we create one child session per main session for helper calls
 * (so we don't pollute the user's main conversation). All helper prompts go to
 * the same child session.
 *
 * Why promptAsync + polling instead of prompt?
 *   The sync `client.session.prompt(...)` endpoint waits for the entire message
 *   lifecycle to complete on the server: streaming, persistence, indexing, and
 *   step-finish events. Empirically (see ses_1c62586acffe6vURzZCuo7mZas) this
 *   adds 12-159 seconds of post-stream finalization wait per call — far longer
 *   than the model's actual completion time.
 *
 *   `promptAsync` returns 204 immediately, then we poll `session.messages` and
 *   detect completion by looking for the latest assistant message's text part
 *   with `time.end` set. That's the earliest moment we have the full response
 *   text in our hands, without waiting for server-side finalization.
 *
 * Honors an optional AbortSignal — caller can race the helper call against a
 * timeout and abort if it overruns. On abort, helperCall calls session.abort
 * server-side and rejects with AbortError; caller logs and falls open.
 */

import type {
  createOpencodeClient,
  Part,
  TextPart,
  AssistantMessage,
  Message,
} from "@opencode-ai/sdk"

import { getState } from "./state"
import { log } from "./log"
import type { HelperLabel } from "./types"

type Client = ReturnType<typeof createOpencodeClient>

interface HelperCallOptions {
  client: Client
  sessionID: string
  /** Known label for logs / observability. Restricted to HelperLabel union. */
  label: HelperLabel
  /** System prompt — kept consistent per session so context caches well */
  system?: string
  /** The user-facing prompt for the helper */
  prompt: string
  /** Optional abort signal; if aborted, helperCall rejects with AbortError. */
  signal?: AbortSignal
}

const DEFAULT_SYSTEM =
  "You are arc-agent, a structured-output assistant. " +
  "You are called by a plugin to perform semantic transforms on text. " +
  "Respond with exactly what the user prompt asks for. " +
  "When asked for JSON, respond with JSON only, no prose, no markdown fences. " +
  "When asked for transformed text, respond with the transformed text only, " +
  "no commentary, no explanation."

/** Poll interval while waiting for the assistant response to complete. */
const POLL_INTERVAL_MS = 500

interface SessionCreateOk {
  data?: { id?: string }
}

interface MessagesResponseOk {
  data?: Array<{ info: Message; parts: Part[] }>
}

async function ensureHelperSession(client: Client, mainSessionID: string): Promise<string> {
  const s = getState(mainSessionID)
  if (s.helperSessionID) return s.helperSessionID

  const created = (await client.session.create({
    body: { parentID: mainSessionID, title: "arc-helper" },
  })) as SessionCreateOk

  const id = created.data?.id
  if (!id) throw new Error("session.create returned no id")
  s.helperSessionID = id
  return id
}

/**
 * Find the most recent assistant message in the messages list, with all its
 * text parts joined and a completion flag.
 *
 * The assistant message is "done" when:
 *   - the message info has `time.completed` set, OR
 *   - at least one text part has `time.end` set
 *
 * The earliest signal is text.time.end — that's set when the model finishes
 * streaming, before any server-side finalization wait.
 */
function findCompletedAssistantText(
  messages: Array<{ info: Message; parts: Part[] }>,
  afterTimestamp: number,
): string | null {
  // Walk from the end (most recent) backwards.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.info.role !== "assistant") continue
    const am = m.info as AssistantMessage
    if (am.time.created < afterTimestamp) continue

    const textParts = m.parts.filter((p): p is TextPart => p.type === "text")
    if (textParts.length === 0) continue

    // Done if message has completed timestamp, or all text parts have time.end
    const messageDone = typeof am.time.completed === "number"
    const textsDone = textParts.every((p) => typeof p.time?.end === "number")

    if (messageDone || textsDone) {
      return textParts.map((p) => p.text).join("\n").trim()
    }

    return null // assistant message present but still streaming
  }
  return null
}

class AbortError extends Error {
  constructor() {
    super("helper call aborted")
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
    const onAbort = () => {
      clearTimeout(timer)
      reject(new AbortError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * Make a helper call. Uses promptAsync + polling to avoid the post-stream
 * finalization wait.
 *
 * Throws AbortError if the optional signal aborts before the response arrives.
 */
export async function helperCall(opts: HelperCallOptions): Promise<string> {
  const start = Date.now()
  const helperID = await ensureHelperSession(opts.client, opts.sessionID)

  try {
    // Fire-and-forget the prompt. Server starts processing asynchronously.
    await opts.client.session.promptAsync({
      path: { id: helperID },
      body: {
        parts: [{ type: "text", text: opts.prompt }],
        system: opts.system ?? DEFAULT_SYSTEM,
      },
    })

    // Poll session.messages until we see a completed assistant response.
    // We use `start` as the floor timestamp so we ignore responses from
    // prior helper calls in the same child session.
    while (true) {
      if (opts.signal?.aborted) throw new AbortError()

      await sleep(POLL_INTERVAL_MS, opts.signal)

      const resp = (await opts.client.session.messages({
        path: { id: helperID },
      })) as MessagesResponseOk

      const messages = resp.data ?? []
      const text = findCompletedAssistantText(messages, start)
      if (text !== null) {
        await log({
          kind: "helper",
          session: opts.sessionID,
          helper_call: opts.label,
          helper_latency_ms: Date.now() - start,
          final_chars: text.length,
        })
        return text
      }
    }
  } catch (err) {
    const isAbort = err instanceof AbortError || (err as Error).name === "AbortError"

    if (isAbort) {
      // Best-effort: tell the server to stop processing so we don't waste tokens
      try {
        await opts.client.session.abort({ path: { id: helperID } })
      } catch {
        /* swallow — abort is best-effort */
      }
    }

    await log({
      kind: "helper",
      session: opts.sessionID,
      helper_call: opts.label,
      helper_latency_ms: Date.now() - start,
      final_chars: 0,
      helper_timeout: isAbort,
    })
    throw err
  }
}

export { AbortError }
