import { INDEX, pick, rnd, variable } from '../dsl'
import { behavior, cue, emit, repeat, set } from '../steps'
import type { EffectDef } from '../types'

/** Where the three zombies stand in the fog (W1084). */
const SPOTS_X = [-3, 1, 5]
const SPOTS_Z = [-1, -2.4, 0.4]

/**
 * W1073-1080 (the page's `neblina`): a low layer of mist that drifts slowly, fine ash falling in a spiral and the lamp's cone of light, with three
 * zombies standing in the fog (each turned at random). The fog density (0.075) and the cone are cues for whoever owns the scene.
 */
export const FOG_AND_ASH: EffectDef = {
  id: 'fog_and_ash',
  pageId: 'neblina',
  team: 'world',
  budget: { particles: 120, lights: 1 },
  loop: 0,
  view: { eye: [3, 1.8, 7.5], target: [-3, 1.2, -1] },
  setup: [
    cue('fog', { density: 0.075 }),
    cue('lamp_cone', { visible: true }),
    cue('zombie_visible', { index: -1, visible: false }),
    repeat(
      SPOTS_X.length,
      set('turn', rnd(-0.6, 0.6)),
      behavior('walkers', 'place', { index: INDEX, x: pick(SPOTS_X, INDEX), z: pick(SPOTS_Z, INDEX), facing: variable('turn') }),
    ),
  ],
  timeline: [],
  tick: [
    emit('fog', 'normal', 5, { p: [rnd(-14, 10), rnd(0.2, 1.1), rnd(-3, 8)], v: [rnd(0.15, 0.35), 0, rnd(-0.05, 0.05)], sp: 0, life: [9, 13], size: [3, 5], grow: 1.4, c0: 0x7d8aa0, a: 0.13, fi: 0.35 }),
    emit('ash', 'normal', 14, { p: [rnd(-10, 8), rnd(4, 6), rnd(-3, 7)], v: [rnd(0.1, 0.4), -0.35, rnd(-0.1, 0.1)], sp: [0.05, 0.15], life: [8, 12], size: [0.025, 0.04], c0: 0xa09a90, a: 0.75, fi: 0.1, gnd: 1 }),
  ],
}
