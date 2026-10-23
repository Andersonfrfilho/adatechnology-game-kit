import type { Vec3 } from '../types'
import type { Ctx } from '../ctx'
import { mix, tintGreen } from '../color'
import { clamp } from '../math'

const AUTUMN: Vec3[] = [
  [0.86, 0.56, 0.12],
  [0.8, 0.32, 0.1],
  [0.92, 0.76, 0.2],
  [0.66, 0.3, 0.1],
]
const WINTER_LEAF: Vec3 = [0.45, 0.34, 0.2]

/** Condition + season tint for leaf-like green tissue. `roll` (0..1) varies the autumn color per clump. */
export function leafTint(ctx: Ctx, c: Vec3, deciduous: boolean, roll: number): Vec3 {
  let out = tintGreen(c, ctx.condition)
  if (deciduous) {
    if (ctx.season === 'autumn') out = mix(out, AUTUMN[Math.floor(roll * AUTUMN.length) % AUTUMN.length], 0.8)
    else if (ctx.season === 'winter') out = mix(out, WINTER_LEAF, 0.8)
  }
  return out
}

/** Share of leaf tips kept (0..1+) by condition and season. */
export function leafAmount(ctx: Ctx, deciduous: boolean): number {
  let a = 1
  switch (ctx.condition) {
    case 'dry':
      a = 0.72
      break
    case 'dead':
      a = 0
      break
    case 'overgrown':
      a = 1.15
      break
  }
  if (deciduous) {
    if (ctx.season === 'winter') a *= 0.1
    else if (ctx.season === 'autumn') a *= 0.85
  }
  return clamp(a, 0, 1.3)
}

export function inSeason(ctx: Ctx, seasons: readonly string[] | undefined): boolean {
  return (seasons ?? ['spring', 'summer']).includes(ctx.season)
}
