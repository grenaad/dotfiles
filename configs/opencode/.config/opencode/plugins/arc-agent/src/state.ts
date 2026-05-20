/**
 * Session-scoped state store for arc-agent.
 * Keyed by sessionID. Cleared when a session ends (best-effort via event hook).
 */

import { createMemory, markEntrySuperseded } from "./workflow-memory"
import type { ArcState, WorkflowMemoryState } from "./types"

const store = new Map<string, ArcState>()

export function getState(sessionID: string): ArcState {
  let s = store.get(sessionID)
  if (!s) {
    s = { sessionID, hookErrors: [] }
    store.set(sessionID, s)
  }
  return s
}

export function clearState(sessionID: string): void {
  store.delete(sessionID)
}

export function allStates(): Map<string, ArcState> {
  return store
}

/**
 * v0.19 — Get-or-init workflow memory for a session. Lazy: not created until
 * the first subagent capture. Idempotent for the same session.
 */
export function ensureWorkflowMemory(state: ArcState): WorkflowMemoryState {
  if (!state.workflowMemory) {
    state.workflowMemory = createMemory(state.trivialityTier)
  }
  return state.workflowMemory
}

/**
 * v0.19 — Reset workflow memory. Used when restater is called with non-empty
 * memory (signals start of a new workflow within the same session).
 *
 * v0.20 — Also clears frame-rebuild state so a fresh workflow doesn't inherit
 * a pending rebuild directive from the previous one.
 *
 * v0.21 — Also clears taskShape + reframeOfferDeclined so a fresh workflow
 * gets a clean slate for the predict-observe-compare loop.
 */
export function resetWorkflowMemory(state: ArcState): void {
  state.workflowMemory = createMemory(state.trivialityTier)
  state.frameRebuildCount = undefined
  state.frameRebuildPending = undefined
  state.taskShape = undefined
  state.reframeOfferDeclined = undefined
}

/**
 * v0.20 — Mark the current frame entry as superseded by a re-frame, and set
 * the pending-rebuild directive that the next tool.execute.before hook will
 * inject as a preamble. Idempotent: if a rebuild is already pending, returns
 * false without changing state.
 */
export function markFrameSuperseded(
  state: ArcState,
  frameEntryId: string,
  reason: string,
  pivot: string,
  triggeredBy: string,
): boolean {
  if (state.frameRebuildPending) return false
  const memory = state.workflowMemory
  if (memory) markEntrySuperseded(memory, frameEntryId, reason)
  state.frameRebuildPending = { reason, pivot, triggeredBy }
  return true
}

/**
 * v0.20 — Clear the pending rebuild directive (called after frame re-runs).
 * Increments frameRebuildCount so the 1-rebuild cap is enforceable.
 */
export function clearFrameRebuild(state: ArcState): void {
  if (state.frameRebuildPending) {
    state.frameRebuildCount = (state.frameRebuildCount ?? 0) + 1
    state.frameRebuildPending = undefined
  }
}
