import type { PottedSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU } from '../math'
import { jitter, rgb, shade } from '../color'
import { tube } from '../geometry/tube'
import { generate } from '../generate'

/** Plant in a pot: pot shell, soil disc, then the wrapped plant generated at the same lod / condition / season. */
export function generatePotted(spec: PottedSpec, ctx: Ctx): ArchResult {
  const pot = spec.pot ?? {}
  const shape = pot.shape ?? 'terracotta'
  const R = pot.radius ?? 0.2
  const h = pot.height ?? R * 1.6
  const col = rgb(pot.color ?? (shape === 'cachepot' ? 0xe8e2d4 : shape === 'cylinder' ? 0x6a6e72 : 0xb5603c))
  const sides = ctx.pick(shape === 'square' ? 4 : 12, shape === 'square' ? 4 : 8, shape === 'square' ? 4 : 5)
  const prof: { y: number; r: number }[] = []
  switch (shape) {
    case 'terracotta':
      prof.push({ y: 0, r: R * 0.62 }, { y: h * 0.1, r: R * 0.66 }, { y: h * 0.7, r: R * 0.92 }, { y: h * 0.78, r: R * 1.06 }, { y: h * 0.95, r: R * 1.08 }, { y: h * 0.98, r: R * 0.96 })
      break
    case 'cylinder':
      prof.push({ y: 0, r: R * 0.97 }, { y: h * 0.04, r: R }, { y: h * 0.92, r: R }, { y: h * 0.97, r: R * 1.03 }, { y: h * 0.98, r: R * 0.94 })
      break
    case 'square':
      prof.push({ y: 0, r: R * 1.0 }, { y: h * 0.92, r: R * 1.2 }, { y: h * 0.97, r: R * 1.24 }, { y: h * 0.98, r: R * 1.12 })
      break
    default: // cachepot
      prof.push({ y: 0, r: R * 0.8 }, { y: h * 0.12, r: R * 0.95 }, { y: h * 0.55, r: R * 1.12 }, { y: h * 0.88, r: R * 1.04 }, { y: h * 0.95, r: R * 1.06 }, { y: h * 0.98, r: R * 0.95 })
  }
  const path: Vec3[] = prof.map((p) => [0, p.y, 0])
  tube(ctx.wood, path, {
    sides,
    radii: prof.map((p) => p.r),
    color: (t, a) => {
      const c = jitter(col, ctx.rng.fork(1), 0.004, 0.02, 0.02)
      const k = 0.7 + 0.35 * t + 0.04 * Math.cos(a * TAU * 2)
      return t > 0.93 ? shade(c, 1.12) : shade(c, k)
    },
    sway: () => 0,
    end: 'none',
    smooth: shape !== 'square',
  })
  // soil disc
  const soilY = h * 0.93
  const soil: Vec3 = [0.22, 0.15, 0.1]
  const rim = (prof[prof.length - 2]?.r ?? R) * 0.96
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * TAU
    const a1 = ((i + 1) / sides) * TAU
    ctx.wood.flatTri([0, soilY, 0], [Math.cos(a1) * rim, soilY, Math.sin(a1) * rim], [Math.cos(a0) * rim, soilY, Math.sin(a0) * rim], shade(soil, 0.9), soil, soil, 0, 0, 0, [0, 1, 0])
  }
  // inner plant
  const inner = generate(spec.plant, { seed: ctx.rng.fork('plant').seed(), lod: ctx.lod, condition: ctx.condition, season: ctx.season })
  const yOff = soilY - 0.02
  if (inner.parts.wood) ctx.wood.appendMesh(inner.parts.wood, 0, yOff, 0)
  if (inner.parts.spines) ctx.spines.appendMesh(inner.parts.spines, 0, yOff, 0)
  if (inner.parts.foliage) ctx.foliage.appendMesh(inner.parts.foliage, 0, yOff, 0)
  if (inner.parts.flowers) ctx.flowers.appendMesh(inner.parts.flowers, 0, yOff, 0)
  if (inner.parts.fruit) ctx.fruit.appendMesh(inner.parts.fruit, 0, yOff, 0)
  return {
    collider: { kind: 'cylinder', radius: Math.max(R * 1.1, 0.1), height: h },
    bendable: inner.bendable,
    thorny: inner.thorny,
    foliageMaterial: inner.parts.foliage?.material,
  }
}
