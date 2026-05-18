/**
 * Session-scoped state store for arc-agent.
 * Keyed by sessionID. Cleared when a session ends (best-effort via event hook).
 */

import type { ArcState } from "./types"

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
