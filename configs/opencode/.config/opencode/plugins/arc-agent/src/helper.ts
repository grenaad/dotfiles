/**
 * Semantic helper that calls the model for transforms where a regex would be brittle.
 *
 * Architecture: we create one child session per main session for helper calls
 * (so we don't pollute the user's main conversation). All helper prompts go to
 * the same child session, which gives us caching for free via OpenCode's session
 * context, and keeps token costs lower by re-using the session's context window.
 *
 * Honors an optional AbortSignal — caller can race the helper call against a
 * timeout and abort if it overruns. On abort, helperCall rejects with an
 * AbortError; caller logs and falls open.
 */

import type { createOpencodeClient, Part, AssistantMessage } from "@opencode-ai/sdk"

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

interface SessionCreateOk {
  data?: { id?: string }
}

interface PromptResponseOk {
  data?: {
    info: AssistantMessage
    parts: Part[]
  }
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

function extractText(reply: PromptResponseOk): string {
  const parts = reply.data?.parts ?? []
  const out: string[] = []
  for (const p of parts) {
    if (p.type === "text" && typeof p.text === "string") {
      out.push(p.text)
    }
  }
  return out.join("\n").trim()
}

class AbortError extends Error {
  constructor() {
    super("helper call aborted")
    this.name = "AbortError"
  }
}

/**
 * Race a promise against an abort signal. Resolves with the promise's value or
 * rejects with AbortError if the signal fires first.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new AbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort)
      reject(new AbortError())
    }
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener("abort", onAbort)
        reject(e)
      },
    )
  })
}

/**
 * Make a helper call. Throws on failure (caller decides fail-open policy).
 * Throws AbortError if the optional signal aborts before the call returns.
 */
export async function helperCall(opts: HelperCallOptions): Promise<string> {
  const start = Date.now()
  const helperID = await ensureHelperSession(opts.client, opts.sessionID)

  try {
    const reply = (await withAbort(
      opts.client.session.prompt({
        path: { id: helperID },
        body: {
          parts: [{ type: "text", text: opts.prompt }],
          system: opts.system ?? DEFAULT_SYSTEM,
        },
      }),
      opts.signal,
    )) as PromptResponseOk

    const text = extractText(reply)
    await log({
      kind: "helper",
      session: opts.sessionID,
      helper_call: opts.label,
      helper_latency_ms: Date.now() - start,
      final_chars: text.length,
    })
    return text
  } catch (err) {
    const isAbort = err instanceof AbortError || (err as Error).name === "AbortError"
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
