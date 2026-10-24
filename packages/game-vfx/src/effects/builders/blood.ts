import type { WorkshopEngine } from '../../workshop/engine'
import type { Vec3Tuple } from '../../workshop/types'
import { negated, plus, plusScaled } from '../vector-math'
import { sparkSpec } from './impact-table'

/** The blood colour of each infection age (W116) and how much each bleeds (W392). */
export const BLOOD_COLORS = [0x8a0a0a, 0x5a0c10, 0x3a1c12, 0x1d1914] as const
const BLEED_BY_AGE = [1, 0.7, 0.35, 0.1] as const

/** The dust and dry flakes a decrepit body gives instead of blood. */
function drySplash(engine: WorkshopEngine, point: Vec3Tuple, exitDirection: Vec3Tuple, scale: number): void {
  engine.burst('normal', 16 * scale, { p: point, dir: exitDirection, cone: 1, sp: [0.5, 1.6], drag: 2, life: [0.9, 1.6], size: [0.1, 0.2], grow: 4, c0: 0x2e2822, c1: 0x15130f, a: 0.6, g: -0.15 })
  for (let index = 0; index < engine.scaled(5); index++) engine.debrisPiece({ p: point, dir: exitDirection, cone: 1, sp: [0.5, 2], size: [0.03, 0.008, 0.03], c: 0x1c1916, life: 6 })
  engine.decal([point[0], 0, point[2] + exitDirection[2] * 0.6, 0.25, 0x1a1714, { grow: 0.4, ar: 0.7 }])
}

/** `bloodHit` (W392-398): a mist at the entry, a jet out of the exit and a cloud, by infection age. */
export function bloodHit(engine: WorkshopEngine, point: Vec3Tuple, exitDirection: Vec3Tuple, age: number, scale = 1): void {
  if (age === 3) return drySplash(engine, point, exitDirection, scale)
  const amount = BLEED_BY_AGE[age]!
  const color = BLOOD_COLORS[age]!
  engine.burst('normal', 10 * amount * scale, { p: point, dir: negated(exitDirection), cone: 0.9, sp: [0.2, 0.9], drag: 3, life: [0.25, 0.5], size: [0.08, 0.14], grow: 3, c0: color, a: 0.65 })
  engine.burst('normal', 45 * amount * scale, { p: point, dir: exitDirection, cone: 0.45, sp: [2.5, 6], life: [1, 1.6], size: [0.035, 0.07], c0: color, a: 0.95, g: 9.8, fi: 0, gnd: 3, ds: [0.06, 0.16] })
  engine.burst('normal', 14 * amount * scale, { p: point, dir: exitDirection, cone: 0.5, sp: [1, 2.5], drag: 2.5, life: [0.4, 0.8], size: [0.1, 0.18], grow: 3, c0: color, a: 0.45 })
}

const MATERIAL_NAMES = ['concrete', 'metal', 'wood', 'glass', 'flesh', 'water'] as const
export type ImpactMaterial = (typeof MATERIAL_NAMES)[number]

function waterImpact(engine: WorkshopEngine, point: Vec3Tuple, scale: number): void {
  engine.burst('normal', 22 * scale, { p: point, dir: [0, 1, 0], cone: 0.5, sp: [1.5, 3.5], life: [0.4, 0.7], size: [0.03, 0.06], c0: 0xc8d6e6, a: 0.7, g: 9.8, fi: 0, gnd: 1 })
  engine.ring([plus(point, 0, 0.012, 0), 0.02, 0.6, 0.7, 0x8090a8])
  engine.ring([plus(point, 0, 0.013, 0), 0.02, 0.35, 0.5, 0x8090a8])
}

/** `impact` (W374-391): what a bullet raises on each material. */
export function impact(engine: WorkshopEngine, material: ImpactMaterial, point: Vec3Tuple, normal: Vec3Tuple, scale = 1, age = 0): void {
  if (material === 'flesh') return bloodHit(engine, point, negated(normal), age, scale)
  if (material === 'water') return waterImpact(engine, point, scale)
  const spec = sparkSpec(material)
  if (spec.dust) engine.burst('normal', 14 * scale, { p: point, dir: normal, cone: 0.6, sp: [0.6, 2.4], drag: 2.5, life: [0.6, 1.2], size: [0.08, 0.16], grow: 4, c0: spec.dust, c1: 0x3a3936, a: 0.55, g: -0.1 })
  if (spec.chip) {
    const size = material === 'wood' ? ([0.015, 0.015, 0.09] as const) : material === 'glass' ? ([0.03, 0.004, 0.03] as const) : ([0.03, 0.03, 0.03] as const)
    for (let index = 0; index < engine.scaled(material === 'wood' ? 8 : 6) * scale; index++) {
      engine.debrisPiece({ p: point, dir: normal, cone: 0.8, sp: [1.5, 4], size, k: [0.6, 1.4], c: spec.chip, life: 6 })
    }
  }
  if (spec.spark && engine.quality < 2) {
    engine.burst('streak', spec.spark * scale, { p: point, dir: normal, cone: material === 'metal' ? 0.9 : 0.5, sp: [3, 9], life: [0.15, 0.45], len: 0.025, c0: 0xfff0c0, c1: 0xff5a10, g: 9.8, gnd: 2 })
    engine.burst('add', material === 'metal' ? 3 : 1, { p: point, size: [0.12, 0.2], life: 0.06, c0: 0xffe0a0, fi: 0 })
    if (material === 'metal') engine.flash([plusScaled(point, normal, 0.2), 0xffb060, 2, 0.06, 5])
  }
  if (material === 'glass') engine.burst('add', 5, { p: point, r: 0.15, size: [0.02, 0.05], life: [0.2, 0.5], c0: 0xffffff, a: 0.9, fi: 0.3 })
  if (engine.quality < 2) {
    const size = material === 'glass' ? 0.07 : material === 'metal' ? 0.05 : 0.06
    engine.decal([point[0], point[1], point[2], size, material === 'metal' ? 0x2a2522 : 0x0e0d0c, { n: normal, grow: 0, life: 60 }])
  }
}

export function impactMaterialAt(index: number): ImpactMaterial {
  return MATERIAL_NAMES[index]!
}
