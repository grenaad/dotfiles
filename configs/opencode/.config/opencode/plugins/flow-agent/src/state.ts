/**
 * flow-agent per-session state.
 *
 * Lives in memory for the lifetime of the opencode process. Keyed by the
 * main session ID so multiple flows can run side-by-side.
 */

import type { FlowState } from "./types"

const STATES = new Map<string, FlowState>()

export function getState(sessionID: string): FlowState {
  let s = STATES.get(sessionID)
  if (!s) {
    s = {}
    STATES.set(sessionID, s)
  }
  return s
}

export function clearState(sessionID: string): void {
  STATES.delete(sessionID)
}
