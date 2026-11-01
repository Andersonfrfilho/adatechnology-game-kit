import { variable } from '../dsl'
import { spawn } from '../steps'
import type { EffectDef } from '../types'

const vector = [variable('vx'), variable('vy'), variable('vz')] as const
const range = (name: string) => [variable(name), variable(name)] as const

const singleParticle = (id: string, system: 'add' | 'normal' | 'streak'): EffectDef => ({
  id,
  pageId: `particle:${id}`,
  team: 'world',
  budget: { particles: 1, lights: 0 },
  loop: 0.001,
  timeline: [
    spawn(system, {
      p: [0, 0, 0],
      v: vector,
      life: range('life'),
      size: range('size'),
      grow: variable('grow'),
      c0: variable('color'),
      a: variable('alpha'),
      g: variable('gravity'),
      drag: variable('drag'),
    }),
  ],
})

/**
 * One sprite per play, every number from `EffectRequest.values` (`vx`, `vy`, `vz`, `life`, `size`, `grow`, `color`, `alpha`, `gravity`, `drag`): how
 * the particle systems of the adapters (vehicle puffs, casings' smoke, interactable fire) hand a particle to the host's effects world and its one budget.
 */
export const SINGLE_PARTICLE_EFFECTS: readonly EffectDef[] = [singleParticle('particle_puff', 'normal'), singleParticle('particle_glow', 'add'), singleParticle('particle_streak', 'streak')]
