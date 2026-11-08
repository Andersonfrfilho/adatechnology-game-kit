import { cos, local, mul, or, rnd, scaled, sin, variable, vnorm } from './dsl'
import type { Expr } from './expression'
import { burst, call, debris, repeat, screen, spawn } from './steps'
import type { EffectDef, EffectStep } from './types'

/**
 * The families of material a destruction event plays its effect by (the `{material}` of the stage and collapse entries of `data/event-effects.json`): the
 * same names as `DebrisFamily` of `game-destruction`, kept as strings so this package does not depend on it.
 */
export const DEBRIS_EFFECT_FAMILIES = ['wood', 'masonry', 'glass', 'metal', 'soft', 'soil'] as const
export type DebrisEffectFamily = (typeof DEBRIS_EFFECT_FAMILIES)[number]

/** The variables a host sets (`PlayOptions.values`) to draw the debris and the dust in the colour of the material that broke. */
export const DEBRIS_COLOR_VARIABLE = 'debrisColor'
export const DUST_COLOR_VARIABLE = 'dustColor'

type Vec3 = readonly [number, number, number]

interface FamilyLook {
  /** Debris and dust colours used when the host sets none. */
  readonly debris: number
  readonly dust: number
  /** Size of one piece (a splinter is long and thin, a chip of concrete chunky, a shard flat). */
  readonly piece: Vec3
  readonly spin: number
  /** Share of the masonry cloud this family raises (a wooden house raises far less dust than a brick one; metal none of its own). */
  readonly cloud: number
  readonly sparks: boolean
  readonly glints: boolean
}

const FAMILIES: Readonly<Record<DebrisEffectFamily, FamilyLook>> = {
  wood: { debris: 0x7a5530, dust: 0x9a8a72, piece: [0.015, 0.015, 0.1], spin: 6, cloud: 0.5, sparks: false, glints: false },
  masonry: { debris: 0x9b9a94, dust: 0xa8a49b, piece: [0.035, 0.028, 0.035], spin: 4, cloud: 1, sparks: false, glints: false },
  glass: { debris: 0xa8c8d8, dust: 0xbfd6e2, piece: [0.04, 0.004, 0.04], spin: 14, cloud: 0.25, sparks: false, glints: true },
  metal: { debris: 0x8a8f96, dust: 0x8a857a, piece: [0.04, 0.006, 0.03], spin: 8, cloud: 0.15, sparks: true, glints: false },
  soft: { debris: 0x9a9488, dust: 0xb0aa9e, piece: [0.025, 0.004, 0.02], spin: 6, cloud: 0.3, sparks: false, glints: false },
  soil: { debris: 0x7a6a55, dust: 0x8a7a62, piece: [0.03, 0.025, 0.03], spin: 3, cloud: 1, sparks: false, glints: false },
}

const ORIGIN = [0, 0, 0] as const
const FACING = [0, 0, 1] as const
const UP = [0, 1, 0] as const

const grow = (piece: Vec3, factor: number): Vec3 => [piece[0] * factor, piece[1] * factor, piece[2] * factor]

const debrisTone = (look: FamilyLook): Expr => or(variable(DEBRIS_COLOR_VARIABLE), look.debris)
const dustTone = (look: FamilyLook): Expr => or(variable(DUST_COLOR_VARIABLE), look.dust)

const sparks = (look: FamilyLook, count: number): readonly EffectStep[] => (look.sparks ? [call('spark_at', ORIGIN, FACING, count, 0.9)] : [])
const glints = (look: FamilyLook, count: number): readonly EffectStep[] => (look.glints ? [burst('add', count, { p: ORIGIN, r: 0.2, size: [0.02, 0.05], life: [0.2, 0.5], c0: 0xffffff, a: 0.9, fi: 0.3 })] : [])

/** Stage 1 (W856-871, cut to a hit): the dust a blow shakes loose and a few pieces of the material, in its colour. */
function stageCrack(family: DebrisEffectFamily): EffectDef {
  const look = FAMILIES[family]
  const dust = look.sparks ? [] : [burst('normal', 12, { p: ORIGIN, box: [0.3, 0.05, 0.02], dir: [0, -0.287, 0.958], cone: 0.6, sp: [0.2, 0.8], drag: 1.5, life: [0.8, 1.4], size: [0.08, 0.16], grow: 3, c0: dustTone(look), a: 0.45, g: 0.4 })]
  return {
    id: `stage_crack_${family}`,
    pageId: `event:stage_crack_${family}`,
    team: 'destruction',
    budget: { particles: 16, debris: 6 },
    loop: 2,
    timeline: [
      ...dust,
      ...sparks(look, 8),
      ...glints(look, 4),
      repeat(scaled(look.sparks ? 1 : 4), debris({ p: ORIGIN, box: [0.15, 0.15, 0.02], dir: [0, 0.287, 0.958], cone: 0.6, sp: [1, 2.5], size: look.piece, k: [0.6, 1.4], spin: look.spin, c: debrisTone(look), life: 12 })),
    ],
  }
}

/** Stage 2 (block_wall, W872-886): the ring of dust that rolls out when a wall gives way, as much of it as the family raises, and its pieces. */
function breachDust(family: DebrisEffectFamily): EffectDef {
  const look = FAMILIES[family]
  return {
    id: `breach_dust_${family}`,
    pageId: `event:breach_dust_${family}`,
    team: 'destruction',
    budget: { particles: 90, debris: 16 },
    loop: 5,
    timeline: [
      screen({ add: { shake: 0.25 } }),
      ...sparks(look, 14),
      ...glints(look, 20),
      burst('normal', Math.round(30 * look.cloud), { p: ORIGIN, box: [1.4, 0.8, 0.2], sp: [0.3, 1.2], drag: 1.5, life: [1.5, 2.6], size: [0.4, 0.7], grow: 3, c0: dustTone(look), c1: 0x4a4640, a: 0.45 }),
      repeat(scaled(16), debris({ p: ORIGIN, box: [1.3, 0.8, 0.1], sp: [1, 3], size: grow(look.piece, 2.2), k: [0.5, 1.5], spin: look.spin, c: debrisTone(look), life: 20 })),
      repeat(
        scaled(Math.round(60 * look.cloud)),
        spawn('normal', local('angle', rnd(0, 6.283), {
          p: [rnd(-1.4, 1.4), 0.2, rnd(-0.6, 0.4)],
          dir: vnorm([cos(variable('angle')), 0.3, sin(variable('angle'))]),
          cone: 0.4, sp: [0.8, 2.4], drag: 1.3, life: [2.5, 4.5], size: [0.6, 1], grow: 3, c0: dustTone(look), c1: 0x4a4640, a: 0.45, fi: 0.12,
        })),
      ),
    ],
  }
}

/** Stage 3 and a collapse (building_collapse, W872-886): the slab dropping in blocks and the cloud that rolls along the street, in the family's colours. */
function collapseDust(family: DebrisEffectFamily): EffectDef {
  const look = FAMILIES[family]
  return {
    id: `collapse_dust_${family}`,
    pageId: `event:collapse_dust_${family}`,
    team: 'destruction',
    budget: { particles: 350, debris: 26 },
    loop: 8,
    timeline: [
      screen({ add: { shake: 0.45 } }),
      ...sparks(look, 20),
      repeat(6, debris({ p: ORIGIN, box: [2, 0.05, 0.6], v: [rnd(-0.5, 0.5), rnd(-0.5, 0), rnd(0, 0.8)], sp: 0, size: [rnd(0.5, 1.1), look.piece[1] > 0.01 ? 0.25 : 0.03, rnd(0.4, 0.8)], c: debrisTone(look), spin: 3, life: 30, bounce: 0.1 })),
      repeat(scaled(20), debris({ p: ORIGIN, box: [2.1, 0.1, 0.7], v: [rnd(-1, 1), rnd(-1, 1), rnd(0, 1.5)], sp: 0, size: grow(look.piece, 3.4), k: [0.5, 1.5], spin: look.spin, c: debrisTone(look), life: 30 })),
      repeat(
        scaled(Math.round(70 * look.cloud)),
        spawn('normal', local('angle', rnd(-0.4, 3.5), {
          p: [rnd(-2, 2), 0.2, rnd(-0.5, 0.5)],
          dir: vnorm([mul(cos(variable('angle')), 0.6), 0.25, sin(variable('angle'))]),
          cone: 0.5, sp: [1, 3.2], drag: 1.1, life: [3, 6], size: [0.7, 1.2], grow: 3, c0: dustTone(look), c1: 0x4a4640, a: 0.5, fi: 0.12,
        })),
      ),
    ],
  }
}

const MASONRY = FAMILIES.masonry

/** Rebar laid bare in concrete: chips and dust of the concrete around it (in its colour) and rust off the bars (`rustAt`, W900). */
const REBAR_EXPOSE: EffectDef = {
  id: 'rebar_expose',
  pageId: 'event:rebar_expose',
  team: 'destruction',
  budget: { particles: 24, debris: 8 },
  loop: 2,
  timeline: [
    repeat(scaled(8), debris({ p: ORIGIN, dir: UP, cone: 0.9, sp: [1, 3], size: MASONRY.piece, k: [0.6, 1.4], spin: MASONRY.spin, c: debrisTone(MASONRY), life: 20 })),
    burst('normal', 8, { p: ORIGIN, dir: UP, cone: 0.8, sp: [0.3, 1.2], drag: 2, life: [0.8, 1.4], size: [0.08, 0.15], grow: 3, c0: dustTone(MASONRY), a: 0.4 }),
    call('rust_at', ORIGIN, 6),
  ],
}

/** The stage, breach and collapse effects of every family, and the rebar laid bare. */
export const MATERIAL_EVENT_EFFECTS: readonly EffectDef[] = [
  ...DEBRIS_EFFECT_FAMILIES.flatMap((family) => [stageCrack(family), breachDust(family), collapseDust(family)]),
  REBAR_EXPOSE,
]
