/**
 * Session-scoped state store for arc-agent.
 * Keyed by sessionID. Cleared when a session ends (best-effort via event hook).
 */

import { createMemory } from "./workflow-memory"
import { evictParentCache } from "./workflow-memory-tools"
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
  evictParentCache(sessionID)
}

export function allStates(): Map<string, ArcState> {
  return store
}

/**
 * Get-or-init workflow memory for a session. Lazy: not created until the
 * first capture. Idempotent for the same session.
 */
export function ensureWorkflowMemory(state: ArcState): WorkflowMemoryState {
  if (!state.workflowMemory) {
    state.workflowMemory = createMemory()
  }
  return state.workflowMemory
}

/**
 * Reset workflow memory. Used when starting a fresh workflow within the
 * same session. v0.25.1: dropped frame/reframe/taskShape state — those
 * fields no longer exist on ArcState.
 */
export function resetWorkflowMemory(state: ArcState): void {
  state.workflowMemory = createMemory()
  state.taskType = undefined
  state.normalizedVerdict = undefined
  state.lastPlan = undefined
  state.planQualityMeasured = undefined
}
