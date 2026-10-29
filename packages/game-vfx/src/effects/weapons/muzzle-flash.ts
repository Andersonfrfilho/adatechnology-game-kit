import { add, and, eq, INDEX, ite, mod, mul, ne, param, PARAM, pick, rnd, round, variable } from '../dsl'
import { after, call, repeat, set, spawn, when } from '../steps'
import type { EffectDef } from '../types'

const WEAPONS = ['glock', 'ak', 'r870', 'barrett']
const TIP = [-0.8, 1.38, 3.4 - 0.78] as const
const PORT = [-0.76, 1.4, 3.32] as const
const FORWARD = [0, 0, -1] as const
const NORMAL = [0, 0, 1] as const
const WALL_Z = -4.45
const SHOTS = [[0, 0.45, 0.9], [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], [0], [0]]
const SHOT_TIME = pick(pick(SHOTS, PARAM), INDEX)
const AK = 1
const SHOTGUN = 2
const BARRETT = 3

/** W745-761: core, petals and smoke scaled by weapon (the Barrett also vents sideways and lifts dust), with the shot's casing and hit on the wall. */
export const MUZZLE_FLASH: EffectDef = {
  id: 'muzzle_flash',
  pageId: 'muzzle',
  team: 'weapons',
  params: { id: 'weapon', options: ['glock', 'ak', 'r870', 'barrett'], default: 1 },
  budget: { particles: 60, lights: 1 },
  loop: 2.4,
  view: { eye: [1.8, 1.8, 5.2], target: [-0.8, 1.3, 1.4] },
  timeline: [
    repeat(
      param(3, 7, 1, 1),
      after(
        add(0.2, SHOT_TIME),
        call('muzzle', pick(WEAPONS, PARAM), TIP, FORWARD),
        when(ne(PARAM, SHOTGUN), [call('casing', PORT, ite(eq(PARAM, BARRETT), '50', ''))]),
        set('target', [add(-0.8, rnd(-0.4, 0.4)), add(1.4, rnd(-0.3, 0.3)), WALL_Z]),
        when(
          eq(PARAM, SHOTGUN),
          [repeat(8, call('impact', 'concrete', [add(-0.8, rnd(-0.5, 0.5)), add(1.4, rnd(-0.4, 0.4)), WALL_Z], NORMAL, 0.35))],
          [call('impact', 'concrete', variable('target'), NORMAL, ite(eq(PARAM, BARRETT), 2, 1))],
        ),
        when(and(eq(PARAM, AK), eq(mod(round(mul(SHOT_TIME, 10)), 3), 0)), [spawn('streak', { p: TIP, dir: FORWARD, cone: 0, sp: 90, life: 0.09, len: 0.025, c0: 0xffa040, a: 1 })]),
      ),
    ),
    when(eq(PARAM, SHOTGUN), [after(0.75, call('casing', PORT, 'shell'))]),
  ],
}
