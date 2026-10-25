import { add, cos, DIRECTION, div, eq, floor, gt, INDEX, ite, lt, min, mul, ne, neg, pick, rand, sin, sub, variable, vx, vz } from '../dsl'
import { append, flash, mesh, repeat, set, when } from '../steps'
import type { EffectDef, EffectStep } from '../types'

/**
 * The weapon in the player's hands (the Arsenal gallery's first-person effects: the muzzle flash and smoke of `createEffects`, the backblast of a launched rocket, the rocket's
 * trail and the flame jet of a flamethrower) as recipes of the Workshop engine, drawn as the gallery draws them: as solids (cones, spheres, icosahedra) with the gallery's sizes,
 * segment counts, materials, timing and growth, not as sprites. They are written in the weapon's own axes, the gallery's: x along the barrel, y up, z to the right. A player
 * says how big (`values`), where the weapon points (`direction`, the barrel in the world) and how it is turned (`orientation`, the quaternion, pitch and roll included), and
 * seeds the numbers the effect draws, which it draws in the order the gallery drew them.
 */
const PI = Math.PI
/** The gallery's `smoke`: a sphere of 10 by 8 segments, a grey that rises, slows and grows by 2.1 a second while it fades. */
const SMOKE = { color: 0x8a8a86, width: 10, height: 8, gravity: -0.08, drag: 2.2, growth: 2.1 }
/** Default muzzle smoke numbers (the `smokeless` profile of `@adatechnology/game-weapons`). */
const DEFAULT_SMOKE = { puffs: 2, radius: 0.01, opacity: 0.14, life: 0.7, drift: 0.2, rise: 0.06, growth: 2.1, flash: 1 } as const
/** The flash lasts 55 ms and its group grows from 0.6 to 1.5 times its size (`0.6 + min(1, age / 0.055) * 0.9`). */
const FLASH_SECONDS = 0.055
const FLASH_RAMP = [0.6, 0.9] as const
const FLASH_OPACITY = 0.95
/** The gallery's palette for flame bits: orange, yellow and dark red, and a pale additive core. */
const FLAME_COLORS = [0xff7a22, 0xffc040, 0xc8361a, 0xfff0b0]
const FLAME_ADDITIVE = 3
const ORIGIN = [0, 0, 0] as const

const SIZE = variable('size')
const FLASH_SCALE = variable('flash')
const fallback = (name: string, defaultValue: number): unknown => ite(ne(variable(name), undefined), variable(name), defaultValue)
const wide = (width: number): unknown => mul(sub(rand(), 0.5), width)

/** The gallery's `smoke(position, velocity, size, life, opacity)`; the keys are in the order the gallery drew its numbers. `world` is a velocity that is not turned with the weapon. */
const puff = (point: unknown, velocity: unknown, world: unknown, radius: unknown, life: unknown, opacity: unknown, growth: unknown = SMOKE.growth): EffectStep =>
  mesh({
    shape: 'sphere',
    p: point,
    v: velocity,
    wv: world,
    r: radius,
    seg: SMOKE.width,
    seg2: SMOKE.height,
    life,
    c0: SMOKE.color,
    a: opacity,
    fade: true,
    lit: true,
    g: SMOKE.gravity,
    drag: SMOKE.drag,
    grow: growth,
  })

/** The gallery's `flameBit`: an icosahedron of one of four colours, tumbling, thrown, rising, growing and slowing. The numbers are drawn in the gallery's order, the colour after the life. */
const flameBit = (point: unknown, velocity: unknown, world: unknown, radius: unknown, life: unknown): EffectStep[] => [
  set('bitPoint', point),
  set('bitVelocity', velocity),
  set('bitWorld', world),
  set('bitRadius', radius),
  set('bitLife', life),
  set('bitColour', floor(mul(rand(), FLAME_COLORS.length))),
  mesh({
    shape: 'icosahedron',
    p: variable('bitPoint'),
    v: variable('bitVelocity'),
    wv: variable('bitWorld'),
    r: variable('bitRadius'),
    seg: 1,
    rot: [mul(rand(), 3), mul(rand(), 3), 0],
    spin: [3, 4, 2],
    life: variable('bitLife'),
    c0: pick(FLAME_COLORS, variable('bitColour')),
    add: eq(variable('bitColour'), FLAME_ADDITIVE),
    a: 0.9,
    fade: true,
    g: -1.4,
    drag: 1.4,
    grow: 2.2,
  }),
]

/** One piece of the flash: additive, 55 ms, in the group that grows and is rolled by `roll`. */
const flashPiece = (shape: 'cone' | 'cone_open' | 'sphere', radius: unknown, height: unknown, width: number, at: unknown, rot: unknown, color: number): EffectStep =>
  mesh({ shape, r: radius, ...(height === undefined ? {} : { h: height }), seg: width, seg2: shape === 'sphere' ? 8 : 1, p: ORIGIN, at, rot, roll: variable('roll'), ramp: FLASH_RAMP, life: FLASH_SECONDS, c0: color, a: FLASH_OPACITY, add: true })

/**
 * `muzzleFlash` of the gallery (size `k`): an open cone, four small cones and a sphere, additive for 55 ms and growing, a short orange light that holds its strength, and six
 * puffs of smoke. It draws the four angles of the small cones, the roll of the group, then the velocity and life of each puff.
 */
const MUZZLE_FLASH: EffectDef = {
  id: 'viewmodel_muzzle_flash',
  pageId: 'event:viewmodel_muzzle_flash',
  team: 'weapons',
  budget: { particles: 14, lights: 1 },
  loop: 0.1,
  setup: [
    set('size', fallback('size', 1)),
    set('puffs', fallback('puffs', DEFAULT_SMOKE.puffs)),
    set('radius', fallback('radius', DEFAULT_SMOKE.radius)),
    set('opacity', fallback('opacity', DEFAULT_SMOKE.opacity)),
    set('life', fallback('life', DEFAULT_SMOKE.life)),
    set('drift', fallback('drift', DEFAULT_SMOKE.drift)),
    set('rise', fallback('rise', DEFAULT_SMOKE.rise)),
    set('growth', fallback('growth', DEFAULT_SMOKE.growth)),
    set('flash', fallback('flash', DEFAULT_SMOKE.flash)),
  ],
  timeline: [
    set('angles', []),
    repeat(4, append('angles', add(div(mul(INDEX, PI), 2), mul(rand(), 0.6)))),
    set('roll', mul(rand(), PI)),
    when(gt(FLASH_SCALE, 0), [
      flash(ORIGIN, 0xffb060, mul(4, SIZE, FLASH_SCALE), FLASH_SECONDS, mul(2, SIZE, FLASH_SCALE), true, true),
      flashPiece('cone_open', mul(0.013, SIZE, FLASH_SCALE), mul(0.085, SIZE, FLASH_SCALE), 10, [mul(0.042, SIZE, FLASH_SCALE), 0, 0], [0, 0, -PI / 2], 0xffb347),
      repeat(
        4,
        set('angle', pick(variable('angles'), INDEX)),
        flashPiece(
          'cone',
          mul(0.005, SIZE, FLASH_SCALE),
          mul(0.04, SIZE, FLASH_SCALE),
          6,
          [mul(0.012, SIZE, FLASH_SCALE), mul(cos(variable('angle')), 0.016, SIZE, FLASH_SCALE), mul(sin(variable('angle')), 0.016, SIZE, FLASH_SCALE)],
          [variable('angle'), 0, -PI / 2],
          0xffb347,
        ),
      ),
      flashPiece('sphere', mul(0.016, SIZE, FLASH_SCALE), undefined, 12, [mul(0.008, SIZE, FLASH_SCALE), 0, 0], [0, 0, 0], 0xfff1c0),
    ]),
    repeat(
      variable('puffs'),
      puff(
        ORIGIN,
        [add(variable('drift'), mul(rand(), 0.1)), add(variable('rise'), mul(rand(), 0.04)), mul(sub(rand(), 0.5), 0.06)],
        [0, 0, 0],
        mul(variable('radius'), SIZE),
        add(variable('life'), mul(rand(), mul(variable('life'), 0.3))),
        variable('opacity'),
        variable('growth'),
      ),
    ),
  ],
}

/**
 * One puff of smoke the gallery's `smoke(position, velocity, size, life, opacity)` throws: a hot barrel's, a rocket's trail, the smoke of a flame on the ground. The numbers come as
 * `values` (`vx`, `vy`, `vz` in the world, `radius`, `life`, `opacity`), so the weapon keeps its own random draws.
 */
const SMOKE_PUFF: EffectDef = {
  id: 'weapon_smoke_puff',
  pageId: 'event:weapon_smoke_puff',
  team: 'weapons',
  budget: { particles: 1 },
  loop: 0.1,
  timeline: [puff(ORIGIN, undefined, [variable('vx'), variable('vy'), variable('vz')], variable('radius'), variable('life'), variable('opacity'))],
}

/** A rocket leaving the tube, from the rear of it: 26 puffs thrown back (-x) and 14 bits of fire. */
const BACKBLAST: EffectDef = {
  id: 'launcher_backblast',
  pageId: 'event:launcher_backblast',
  team: 'weapons',
  budget: { particles: 40 },
  loop: 0.1,
  timeline: [
    repeat(26, puff(ORIGIN, [neg(add(1.5, mul(rand(), 3))), 0, 0], [wide(1.4), wide(0.8), wide(1.4)], add(0.03, mul(rand(), 0.03)), add(1.8, mul(rand(), 1.4)), 0.5)),
    repeat(14, ...flameBit(ORIGIN, [neg(add(2, mul(rand(), 2))), 0, 0], [wide(1), wide(0.6), wide(1)], 0.02, 0.25)),
  ],
}

/**
 * A frame of a flamethrower's jet: `floor(420 dt scale)` bits of fire thrown along the barrel and up (`dt` and `scale` are the values), and a puff of smoke downwind half the time.
 * It is played every frame the nozzle burns. It needs the `direction` of the barrel for the wind of the smoke.
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
      set('speed', mul(add(2.2, mul(rand(), 1.1)), variable('scale'))),
      ...flameBit(
        [mul(rand(), variable('speed'), min(variable('dt'), 0.3)), 0, 0],
        [variable('speed'), 0, 0],
        [wide(0.35), mul(sub(rand(), 0.3), 0.3), wide(0.35)],
        add(0.02, mul(rand(), 0.022)),
        add(0.4, mul(rand(), 0.35)),
      ),
    ),
    when(lt(rand(), 0.5), [
      puff([add(mul(1.1, variable('scale')), mul(rand(), 0.4)), 0, 0], undefined, [mul(vx(DIRECTION), 0.6), 0.35, mul(vz(DIRECTION), 0.6)], 0.03, 1.6, 0.4),
    ]),
  ],
}

export const VIEWMODEL_EFFECTS: readonly EffectDef[] = [MUZZLE_FLASH, SMOKE_PUFF, BACKBLAST, FLAME_JET]
