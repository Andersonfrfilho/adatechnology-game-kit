import type { ExplosionDef, VfxProfile, VfxProfileName } from './types'

/**
 * The pool sizes of the three profiles. `high` is the bench and the goldens (the Lab's caps L131/240/295/367 and the Workshop's W221), `medium` the
 * game's default (G67747/67762), `low` close to the game's own budgets (G68074, G68108).
 */
export const PROFILES: Readonly<Record<VfxProfileName, VfxProfile>> = {
  high: { puffs: 2600, sparks: 3200, glows: 320, chunks: 300, sprites: { add: 9000, normal: 9000 }, streaks: 3000, debris: 500 },
  medium: { puffs: 1300, sparks: 1600, glows: 160, chunks: 150, sprites: { add: 1500, normal: 600 }, streaks: 1000, debris: 120 },
  low: { puffs: 260, sparks: 800, glows: 80, chunks: 120, sprites: { add: 600, normal: 300 }, streaks: 400, debris: 60 },
}

/** The Lab's per-event meters (L1043-1044): 400 GPU particles, 40 physics debris, and 4 + 2 lights. */
export const EVENT_BUDGET = { particles: 400, debris: 40, blastLights: 4, fireLights: 2 } as const

/** Particles an explosion makes on the GPU, the number of the Lab's effect sheet (L1033): fireballs, smoke, dust, shrapnel, the mushroom and the embers. */
export function estimateCost(def: ExplosionDef): number {
  const mushroom = def.mushroom ? def.mushroom.count + def.mushroom.stem : 0
  return def.fireballs + def.smoke.count + def.dust.count + def.shrapnel.count + mushroom + (def.shrapnel.embers ?? 0)
}
