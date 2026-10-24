import type { Behavior } from '../behavior'

/** A smear of blood that runs down the windshield from a hit (`wsMarks`, W1156). */
export interface BloodStreak {
  readonly x: number
  readonly y: number
  readonly dx: number
  readonly dy: number
  readonly width: number
}

export interface Crack {
  readonly x: number
  readonly y: number
  /** Each ray is a list of `[dx, dy]` segments that start at the impact. */
  readonly rays: readonly (readonly (readonly [number, number])[])[]
  readonly rings: readonly number[]
}

const FULL_TURN_ROUNDED = 6.28
const SHORT_RAYS = 7
const LONG_RAYS = 12
const STREAKS_PER_HIT = 5

/** `crackAt` (W62-63): the star of cracks a hit leaves in glass. Its draws depend on the lengths it draws, so the model keeps the same loop. */
export function createCracksBehavior(): Behavior {
  let cracks: Crack[] = []
  let streaks: BloodStreak[][] = []
  return {
    reset() {
      cracks = []
      streaks = []
    },
    act(host, action, args) {
      if (action === 'blood_streaks') {
        const { x, y } = args as { readonly x: number; readonly y: number }
        const random = host.engine.random
        const group: BloodStreak[] = []
        for (let index = 0; index < STREAKS_PER_HIT; index++) {
          group.push({ x: x - 18 + index * 8, y: y - 10, dx: random.between(-3, 3), dy: random.between(18, 40), width: random.between(5, 9) })
        }
        streaks.push(group)
        return
      }
      if (action !== 'crack') return
      const { x, y, big } = args as { readonly x: number; readonly y: number; readonly big: boolean }
      const random = host.engine.random
      const count = big ? LONG_RAYS : SHORT_RAYS
      const rays: [number, number][][] = []
      for (let ray = 0; ray < count; ray++) {
        let angle = (ray / count) * FULL_TURN_ROUNDED + random.between(-0.3, 0.3)
        const segments: [number, number][] = []
        let remaining = big ? random.between(40, 110) : random.between(15, 45)
        while (remaining > 0) {
          const length = random.between(6, 14)
          angle += random.between(-0.35, 0.35)
          segments.push([Math.cos(angle) * length, Math.sin(angle) * length])
          remaining -= length
        }
        rays.push(segments)
      }
      cracks.push({ x, y, rays, rings: big ? [12, 26] : [8] })
    },
    query(_host, name) {
      if (name === 'cracks') return cracks
      if (name === 'streaks') return streaks
      throw new Error(`cracks: unknown query ${name}`)
    },
    update() {},
  }
}
