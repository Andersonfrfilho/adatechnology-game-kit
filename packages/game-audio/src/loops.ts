import type { LoopRecipe } from './recipe'

/** jogo L62112: a loop's nodes exist only once its volume reaches 0.002. */
export const LOOP_START_ABOVE = 0.002
/** jogo L62125–62126: `setTargetAtTime` time constants. */
export const LOOP_SMOOTHING = { volume: 0.15, frequency: 0.08 } as const

/** What the realizer does for one `set`: create the nodes first (once), then glide the volume and, for an oscillator, the frequency. */
export type LoopAction = { readonly create: boolean; readonly volume: number; readonly frequency?: number }

export type LoopState = {
  /** `null` while the loop has no nodes and the volume is still below the start threshold. */
  set(state: { readonly volume?: number; readonly frequency?: number }): LoopAction | null
  /** Whether the nodes exist. */
  readonly created: boolean
  /** The nodes were torn down (`stop`): the next audible `set` creates them again. */
  reset(): void
}

/**
 * The game's `loopSet` as state: nodes on the first volume at or above `startAbove`, then every `set` glides. The volume set last is kept, so a
 * `set` of only the frequency keeps the level. `chain_loop` recipes open with their nodes already made (`open` is true).
 */
export function createLoopState(recipe: LoopRecipe, open = false): LoopState {
  const startAbove = recipe.startAbove ?? LOOP_START_ABOVE
  let created = open
  let volume = recipe.volume ?? 0
  return {
    set(state) {
      volume = state.volume ?? volume
      const create = !created
      if (create && !(volume >= startAbove)) return null
      created = true
      const frequency = recipe.source.kind === 'osc' && state.frequency ? state.frequency : undefined
      return { create, volume, ...(frequency === undefined ? {} : { frequency }) }
    },
    get created() {
      return created
    },
    reset() {
      created = false
    },
  }
}
