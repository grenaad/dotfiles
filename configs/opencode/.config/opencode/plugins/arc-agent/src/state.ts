/**
 * Session-scoped state store for arc-agent.
 * Keyed by sessionID. Cleared when a session ends (best-effort via event hook).
 */

import { createMemory } from "./workflow-memory"
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
 */
export function resetWorkflowMemory(state: ArcState): void {
  state.workflowMemory = createMemory(state.trivialityTier)
}
