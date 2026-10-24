import type { ScreenState } from './types'

const DECAY = { shake: 5, white: 7, red: 2.2, side: 3, chroma: 3, desat: 0.7, gasSeconds: 5, beat: 6 } as const
export const INITIAL_FLASH_DECAY = 6

export function createScreenState(): ScreenState {
  return { shake: 0, flash: 0, flashDecay: INITIAL_FLASH_DECAY, white: 0, red: 0, directionLeft: 0, directionRight: 0, chroma: 0, desat: 0, gas: 0, beat: 0 }
}

export function resetScreenState(state: ScreenState): void {
  Object.assign(state, createScreenState())
}

/**
 * The decays of the Lab (L1087, L1092: flash by its own rate, shake by 5 per second) and the Workshop (W354-355: white, red, the two sides, chroma,
 * desaturation, gas and the heartbeat), with the same constants.
 */
export function updateScreen(state: ScreenState, dt: number): void {
  state.flash *= Math.exp(-state.flashDecay * dt)
  state.shake *= Math.exp(-DECAY.shake * dt)
  state.white *= Math.exp(-DECAY.white * dt)
  state.red *= Math.exp(-DECAY.red * dt)
  state.directionLeft *= Math.exp(-DECAY.side * dt)
  state.directionRight *= Math.exp(-DECAY.side * dt)
  state.chroma *= Math.exp(-DECAY.chroma * dt)
  state.desat *= Math.exp(-DECAY.desat * dt)
  state.gas = Math.max(0, state.gas - dt / DECAY.gasSeconds)
  state.beat *= Math.exp(-DECAY.beat * dt)
}
