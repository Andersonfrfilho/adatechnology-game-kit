import type { AnimationEventSpec } from '@adatechnology/game-contracts'
import type { ModelParts } from '../models/types'
import { cue, move, sound } from './clip-builder'
import type { Tween } from './clip-builder'

/** The magazine goes out, drops away, and a new one rises into the well: the page's `magSwap`, which takes 0.82 s. */
export const MAGAZINE_SWAP_SECONDS = 0.82
/** The new magazine starts to rise here (the `magazine_in` stage). */
export const MAGAZINE_IN_AT = 0.45

export function magazineSwap(parts: ModelParts, start: number): { tweens: Tween[]; events: AnimationEventSpec[]; end: number } {
  const direction = parts.magDir || -1
  const drop = parts.magDrop || 0.15
  return {
    tweens: [
      move('mag', 'y', start, 0.16, 0, direction * drop * 0.6),
      move('mag', 'y', start + 0.16, 0, 0, direction * drop * 2.2),
      move('mag', 'y', start + MAGAZINE_IN_AT, 0.3, direction * drop * 2.2, 0),
    ],
    events: [sound(start, 'mag_release'), cue(start + 0.16, 'drop_magazine', { up: direction > 0 }), sound(start + 0.16, 'mag_out'), sound(start + MAGAZINE_IN_AT, 'mag_insert'), sound(start + MAGAZINE_IN_AT + 0.3, 'mag_seat')],
    end: start + MAGAZINE_SWAP_SECONDS,
  }
}
