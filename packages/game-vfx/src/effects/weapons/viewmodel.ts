import { add, cos, exp, floor, INDEX, lt, min, mul, neg, pick, rand, rnd, sin, variable } from '../dsl'
import { flash, repeat, set, spawn, when } from '../steps'
import type { EffectDef, EffectStep } from '../types'

/**
 * The weapon in the player's hands (the Arsenal gallery's first-person effects: the muzzle flash and smoke of `createEffects`, the backblast of a launched rocket, the rocket's
 * trail and the flame jet of a flamethrower) as recipes of the Workshop engine. The gallery draws them as meshes in metres; these spawn sprites into the pools every other
 * effect uses, with the gallery's numbers. The gallery's axes (x along the barrel, y up, z to the right) become the recipe's: forward is -z, up is y, right is +x. A player
 * says how big (`values`) and where the weapon points (`direction`, turned about the vertical axis only).
 *
 * What a sprite cannot copy: a mesh grows by `1 + 2.1 dt` a frame, which is exponential, and a sprite grows linearly from its first size to its last, so each puff gets the last
 * size the mesh reaches in its life (`exp(2.1 life)`); a cone, a spike and a sphere become one round sprite each; a sprite fades out over its life, the flash mesh does not.
 */
const SMOKE_GROWTH = 2.1
const FLAME_GROWTH = 2.2
const SMOKE_COLOR = 0x8a8a86
/** The flash lasts 55 ms and its group grows from 0.6 to 1.5 times its size. */
const FLASH_SECONDS = 0.055
const FLASH_FROM = 0.6
const FLASH_GROWTH = 1.5 / 0.6
/** The gallery's palette for flame bits: orange, yellow and dark red, and a pale additive core. */
const FLAME_COLORS = [0xff7a22, 0xffc040, 0xc8361a, 0xfff0b0]
const FLAME_ADDITIVE = 3
const ORIGIN = [0, 0, 0] as const

const SIZE = variable('size')
const LIFE = variable('life')
const ahead = (distance: unknown): unknown => [0, 0, neg(distance)]
const wide = (width: number): unknown => rnd(-width / 2, width / 2)

/** A puff of smoke: a sphere of `radius` (a sprite of twice that), fading linearly from `opacity`, rising and slowing, grown to what the mesh reaches in `life`. */
const puff = (point: unknown, velocity: unknown, radius: unknown, life: unknown, opacity: unknown): EffectStep[] => [
  set('life', life),
  spawn('normal', { p: point, v: velocity, sp: 0, life: LIFE, size: mul(2, radius), grow: exp(mul(SMOKE_GROWTH, LIFE)), c0: SMOKE_COLOR, a: opacity, g: -0.08, drag: 2.2, fi: 0 }),
]

/** A bit of flame: one of the four colours, thrown, rising, growing and slowing. */
const flameBit = (point: unknown, velocity: unknown, radius: unknown, life: unknown): EffectStep[] => {
  const shared = { p: point, v: velocity, sp: 0, life: LIFE, size: mul(2, radius), grow: exp(mul(FLAME_GROWTH, LIFE)), a: 0.9, g: -1.4, drag: 1.4, fi: 0 }
  return [
    set('life', life),
    set('colour', floor(mul(rand(), FLAME_COLORS.length))),
    when(
      lt(variable('colour'), FLAME_ADDITIVE),
      [spawn('normal', { ...shared, c0: pick(FLAME_COLORS, variable('colour')) })],
      [spawn('add', { ...shared, c0: FLAME_COLORS[FLAME_ADDITIVE] })],
    ),
  ]
}


/** `muzzleFlash` of the gallery (size `k`): a cone, four spikes and a core, additive for 55 ms and growing, a short orange light, and six puffs of smoke. */
const MUZZLE_FLASH: EffectDef = {
  id: 'viewmodel_muzzle_flash',
  pageId: 'event:viewmodel_muzzle_flash',
  team: 'weapons',
  budget: { particles: 12, lights: 1 },
  loop: 0.1,
  timeline: [
    flash(ORIGIN, 0xffb060, mul(4, SIZE), FLASH_SECONDS, mul(2, SIZE)),
    spawn('add', { p: ahead(mul(0.042, SIZE)), sp: 0, life: FLASH_SECONDS, size: mul(FLASH_FROM, 0.085, SIZE), grow: FLASH_GROWTH, c0: 0xffb347, fi: 0 }),
    repeat(
      4,
      set('angle', add(mul(INDEX, Math.PI / 2), mul(rand(), 0.6))),
      spawn('add', {
        p: [mul(sin(variable('angle')), 0.016, SIZE), mul(cos(variable('angle')), 0.016, SIZE), neg(mul(0.012, SIZE))],
        sp: 0,
        life: FLASH_SECONDS,
        size: mul(FLASH_FROM, 0.04, SIZE),
        grow: FLASH_GROWTH,
        c0: 0xffb347,
        fi: 0,
      }),
    ),
    spawn('add', { p: ahead(mul(0.008, SIZE)), sp: 0, life: FLASH_SECONDS, size: mul(FLASH_FROM, 0.032, SIZE), grow: FLASH_GROWTH, c0: 0xfff1c0, fi: 0 }),
    repeat(6, ...puff(ORIGIN, [wide(0.14), rnd(0.03, 0.15), neg(rnd(0.15, 0.5))], mul(0.013, SIZE), rnd(1.3, 1.9), 0.45)),
  ],
}

/**
 * One puff of smoke the gallery's `smoke(position, velocity, size, life, opacity)` throws: a hot barrel's, a rocket's trail, the smoke of a flame on the ground. The numbers come as
 * `values` (`vx`, `vy`, `vz` in the world, `radius`, `life`, `opacity`), so the weapon keeps its own random draws. Play it without a `direction`.
 */
const SMOKE_PUFF: EffectDef = {
  id: 'weapon_smoke_puff',
  pageId: 'event:weapon_smoke_puff',
  team: 'weapons',
  budget: { particles: 1 },
  loop: 0.1,
  timeline: [...puff(ORIGIN, [variable('vx'), variable('vy'), variable('vz')], variable('radius'), variable('life'), variable('opacity'))],
}

/** A rocket leaving the tube, seen from the rear of it: 26 puffs thrown back and 14 bits of fire. The weapon points ahead (-z), so back is +z. */
const BACKBLAST: EffectDef = {
  id: 'launcher_backblast',
  pageId: 'event:launcher_backblast',
  team: 'weapons',
  budget: { particles: 40 },
  loop: 0.1,
  timeline: [
    repeat(26, ...puff(ORIGIN, [wide(1.4), wide(0.8), add(rnd(1.5, 4.5), wide(1.4))], rnd(0.03, 0.06), rnd(1.8, 3.2), 0.5)),
    repeat(14, ...flameBit(ORIGIN, [wide(1), wide(0.6), add(rnd(2, 4), wide(1))], 0.02, 0.25)),
  ],
}

/**
 * A frame of a flamethrower's jet: `floor(420 dt scale)` bits of fire thrown ahead and up (`dt` and `scale` are the values), and a puff of smoke downwind half the time.
 * It is played every frame the nozzle burns.
 */
const FLAME_JET: EffectDef = {
  id: 'flame_jet',
  pageId: 'event:flame_jet',
  team: 'weapons',
  budget: { particles: 30 },
  loop: 0.1,
  timeline: [
    repeat(
      floor(mul(420, variable('dt'), variable('scale'))),
      set('speed', mul(rnd(2.2, 3.3), variable('scale'))),
      ...flameBit(
        [0, 0, neg(mul(rand(), variable('speed'), min(variable('dt'), 0.3)))],
        [wide(0.35), rnd(-0.09, 0.21), add(neg(variable('speed')), wide(0.35))],
        rnd(0.02, 0.042),
        rnd(0.4, 0.75),
      ),
    ),
    when(lt(rand(), 0.5), puff([0, 0, neg(add(mul(1.1, variable('scale')), rnd(0, 0.4)))], [0, 0.35, -0.6], 0.03, 1.6, 0.4)),
  ],
}

export const VIEWMODEL_EFFECTS: readonly EffectDef[] = [MUZZLE_FLASH, SMOKE_PUFF, BACKBLAST, FLAME_JET]
