import type { ToolHand } from '@adatechnology/game-contracts'

/** What the magazine change of a tool in each hand asks of the room. */
export interface DualReloadHost {
  /** Whether the tool of the hand has rounds to take (a magazine not full, rounds in reserve). */
  needs(hand: ToolHand): boolean
  /** Starts the reload of the tool of the hand; false when it does not start. */
  startReload(hand: ToolHand): boolean
  reloading(hand: ToolHand): boolean
  /** The tool of the hand goes against the body to free that hand (`on`), or comes back to it, in `seconds`. */
  stow(hand: ToolHand, on: boolean, seconds: number): void
}

export type DualReloadPhase = 'stow' | 'reload' | 'draw'

export interface DualReload {
  /** Changes the magazines of the hands given, in order, one after the other; does nothing while a change runs. */
  start(order: readonly ToolHand[]): void
  step(dt: number): void
  /** True from the first stow to the last draw: neither tool fires (one hand works the magazine, the other is on its way). */
  readonly busy: boolean
  /** The tool being reloaded now and how far the change is, or null. */
  readonly current: { readonly hand: ToolHand; readonly phase: DualReloadPhase } | null
  /** Whether the tool of the hand is put away now (it stays away until its draw begins). */
  stowed(hand: ToolHand): boolean
  /** Stops at once: the tool put away comes back to its hand. */
  cancel(): void
}

const otherHand = (hand: ToolHand): ToolHand => (hand === 'R' ? 'L' : 'R')

/**
 * The magazine change with a tool in each hand, as a person does it: the other tool goes against the body (tucked in the belt) to free its hand, the free hand changes the magazine,
 * the tool comes back to its hand; then the same the other way round. `stowSeconds` is read at each move (the rule of the arsenal).
 */
export function createDualReload(host: DualReloadHost, stowSeconds: () => number): DualReload {
  let queue: ToolHand[] = []
  let current: { hand: ToolHand; phase: DualReloadPhase; left: number } | null = null

  const next = (): void => {
    let hand = queue.shift()
    while (hand && !host.needs(hand)) hand = queue.shift()
    if (!hand) {
      current = null
      return
    }
    const seconds = stowSeconds()
    current = { hand, phase: 'stow', left: seconds }
    host.stow(otherHand(hand), true, seconds)
  }
  const draw = (hand: ToolHand): void => {
    const seconds = stowSeconds()
    current = { hand, phase: 'draw', left: seconds }
    host.stow(otherHand(hand), false, seconds)
  }

  return {
    start(order) {
      if (current) return
      queue = [...order]
      next()
    },
    step(dt) {
      if (!current) return
      if (current.phase === 'reload') {
        if (!host.reloading(current.hand)) draw(current.hand)
        return
      }
      current.left -= dt
      if (current.left > 0) return
      if (current.phase === 'draw') {
        next()
        return
      }
      current.phase = 'reload'
      if (!host.startReload(current.hand)) draw(current.hand)
    },
    get busy() {
      return current !== null
    },
    get current() {
      return current ? { hand: current.hand, phase: current.phase } : null
    },
    stowed(hand) {
      return current !== null && current.phase !== 'draw' && otherHand(current.hand) === hand
    },
    cancel() {
      if (current && current.phase !== 'draw') host.stow(otherHand(current.hand), false, 0)
      current = null
      queue = []
    },
  }
}
