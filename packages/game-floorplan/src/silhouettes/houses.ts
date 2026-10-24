import { createSilhouetteBuilder } from './builder'
import { createSilhouetteRandom } from './random'
import type { RandomSource, Silhouette } from './types'

const LIT_WINDOW = 0xffb45e
const DARK_WINDOW = 0x10151b
const DEFAULT_ROOF = 0x5a3a2a

type Seeded = { random?: RandomSource; seed?: number }

const randomOf = (o: Seeded): RandomSource => o.random ?? createSilhouetteRandom(o.seed ?? 7)

/** Window colour: a lit one glows (emissive), a dark one is a plain dark pane. */
const pane = (isLit: boolean) => ({ color: isLit ? LIT_WINDOW : DARK_WINDOW, emissive: isLit })

export type TwoStoreyParams = Seeded & { x: number; z: number; width: number; depth: number; color: number; roofColor?: number; ry?: number }

/** Two-storey house with a balcony slab, pitched roof and four windows. */
export function createTwoStoreyHouse(p: TwoStoreyParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const { width: w, depth: d } = p
  const g = b.group(p.x, 0, p.z, p.ry)
  b.box(0, 0, 0, w, 6, d, p.color, { parent: g })
  b.prism(0, 6, 0, w + 0.4, 1.4, d + 0.4, p.roofColor ?? DEFAULT_ROOF, g)
  b.box(0, 3.1, d / 2 + 0.5, w * 0.6, 0.15, 1, 0x6a6a66, { parent: g })
  for (const floor of [0, 1]) {
    for (const side of [-1, 1]) {
      const { color, emissive } = pane(b.random() < 0.12)
      b.box(side * w * 0.26, 1.1 + floor * 3, d / 2 + 0.03, 1.1, 1.2, 0.04, color, { parent: g, emissive })
    }
  }
  b.box(0, 0, d / 2 + 0.02, 1, 2.1, 0.05, 0x2a1d14, { parent: g })
  return b.finish({ x: p.x, z: p.z, width: w, depth: d, height: 7.4 })
}

export type SlabHouseParams = Seeded & { x: number; z: number; width: number; depth: number; floors: number; color: number }

/** Reinforced-concrete slab house of one to three floors, with water tank, side stair and sometimes rebar starters. */
export function createSlabHouse(p: SlabHouseParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const { width: w, depth: d, floors } = p
  const g = b.group(p.x, 0, p.z, 0)
  for (let floor = 0; floor < floors; floor++) {
    const isTop = floor === floors - 1
    b.box(0, floor * 2.9, 0, w, 2.9, d, isTop && b.random() < 0.5 ? 0x9a6a50 : p.color, { parent: g })
    const { color, emissive } = pane(b.random() < 0.1)
    b.box(0, floor * 2.9 + 1.1, d / 2 + 0.03, 1, 1, 0.04, color, { parent: g, emissive })
  }
  b.cylinder(w * 0.25, floors * 2.9, -d * 0.2, 0.55, 0.55, 0.9, 0x2a5aa0, g, 10)
  for (let level = 0; level < floors; level++) b.box(w / 2 + 0.4, level * 2.9, 0, 0.8, 0.18, 1.2, 0x7a7a74, { parent: g })
  if (b.random() < 0.6) for (let index = 0; index < 4; index++) b.box(-w * 0.3 + index * 0.4, floors * 2.9, 0, 0.02, 1, 0.02, 0x8a8a8a, { parent: g })
  return b.finish({ x: p.x, z: p.z, width: w, depth: d, height: floors * 2.9 + 1 })
}

export type ColonialParams = Seeded & { x: number; z: number; width: number; color: number; hasDoor: boolean }

/** Colonial terrace house: parapet, roof behind it and a row of doors or windows. */
export function createColonialHouse(p: ColonialParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const { width: w } = p
  const g = b.group(p.x, 0, p.z, 0)
  b.box(0, 0, 0, w, 4.2, 10, p.color, { parent: g })
  b.box(0, 4.2, 4.6, w, 0.8, 0.25, p.color, { parent: g })
  b.prism(0, 4.2, -0.4, w, 1.4, 9.6, 0x7a4a32, g)
  const count = Math.max(1, Math.floor(w / 2.2))
  for (let index = 0; index < count; index++) {
    const u = (index - (count - 1) / 2) * 2.2
    const isDoor = index === 0 && p.hasDoor
    const lit = isDoor ? false : b.random() < 0.15
    const color = isDoor ? 0x3a2416 : lit ? LIT_WINDOW : 0x2a3a4a
    b.box(u, 1.0, 5.02, 0.9, 2.0, 0.05, color, { parent: g, emissive: lit })
  }
  return b.finish({ x: p.x, z: p.z, width: w, depth: 10, height: 6 })
}

export type ChaletParams = Seeded & { x: number; z: number; color?: number; ry?: number }

/** Wooden chalet on a stone base with a steep roof and a chimney. */
export function createChalet(p: ChaletParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const g = b.group(p.x, 0, p.z, p.ry)
  b.box(0, 0, 0, 7, 0.8, 9, 0x5a5650, { parent: g })
  b.box(0, 0.8, 0, 7, 4.2, 9, p.color ?? 0x6b4a30, { parent: g })
  b.prism(0, 5, 0, 7.6, 4, 9.6, 0x2c2a28, g)
  b.box(2.2, 5, -1, 0.8, 4.2, 0.8, 0x5a5650, { parent: g })
  const { color, emissive } = pane(b.random() < 0.3)
  b.box(0, 1.6, 4.52, 1.3, 1.3, 0.04, color, { parent: g, emissive })
  b.box(0, 6.2, 4.6, 1, 1, 0.04, DARK_WINDOW, { parent: g })
  return b.finish({ x: p.x, z: p.z, width: 7.6, depth: 9.6, height: 9 })
}

export type CompanyHouseParams = Seeded & { x: number; z: number; color?: number }

/** Company-town house with a low front fence. */
export function createCompanyHouse(p: CompanyHouseParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const g = b.group(p.x, 0, p.z, 0)
  b.box(0, 0, 0, 6, 3, 9, p.color ?? 0xd8d0c0, { parent: g })
  b.prism(0, 3, 0, 6.4, 1.6, 9.4, 0x8a4a32, g)
  b.box(0, 0, 4.52, 0.9, 2.1, 0.05, 0x3a2a1c, { parent: g })
  b.box(1.8, 1.1, 4.52, 1, 1, 0.04, DARK_WINDOW, { parent: g })
  b.fence(-3.2, 6.5, 3.2, 6.5, 0.9, 0xe0d8c8, g)
  return b.finish({ x: p.x, z: p.z, width: 6.4, depth: 13, height: 4.6 })
}

export type StiltHouseParams = Seeded & { x: number; z: number; color?: number }

/** House on stilts with a ramp-like entry platform. */
export function createStiltHouse(p: StiltHouseParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const g = b.group(p.x, 0, p.z, 0)
  for (const a of [-2, 2]) for (const c of [-3, 3]) b.cylinder(a, -1.5, c, 0.12, 0.12, 3.1, 0x3a2a1c, g, 6)
  b.box(0, 1.5, 0, 5, 0.2, 7, 0x5a4630, { parent: g })
  b.box(0, 1.7, 0, 4.6, 2.6, 6.4, p.color ?? 0x6a5a46, { parent: g })
  b.prism(0, 4.3, 0, 5.2, 1.1, 7, 0x7a7a78, g)
  b.box(0, 1.5, 5, 1.2, 0.15, 4, 0x5a4630, { parent: g })
  return b.finish({ x: p.x, z: p.z, width: 5.2, depth: 9, height: 5.4 })
}

export type FarmhouseParams = Seeded & { x: number; z: number }

/** Farm house with a long covered porch on six posts. */
export function createFarmhouse(p: FarmhouseParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const g = b.group(p.x, 0, p.z, 0)
  b.box(0, 0, 0, 15, 3.2, 11, 0xd8cfb8, { parent: g })
  b.prism(0, 3.2, 0, 17, 2.2, 13, 0x8a4a32, g)
  b.box(0, 0, 6.8, 15, 0.25, 2.6, 0x6a5a46, { parent: g })
  for (let index = 0; index < 6; index++) b.cylinder(-7 + index * 2.8, 0, 7.8, 0.1, 0.1, 3.2, 0x5a4630, g, 6)
  b.box(-3, 1.0, 5.52, 1.2, 1.2, 0.04, LIT_WINDOW, { parent: g, emissive: true })
  return b.finish({ x: p.x, z: p.z, width: 17, depth: 13, height: 5.4 })
}

export type DetachedHouseParams = Seeded & { x: number; z: number; width: number; depth: number; color: number; roofColor?: number; ry?: number; isBoarded?: boolean }

/** One-storey detached house; boarded windows get two crossed planks each. */
export function createDetachedHouse(p: DetachedHouseParams): Silhouette {
  const b = createSilhouetteBuilder(randomOf(p))
  const { width: w, depth: d } = p
  const g = b.group(p.x, 0, p.z, p.ry)
  b.box(0, 0, 0, w, 3, d, p.color, { parent: g })
  b.prism(0, 3, 0, w + 0.5, 1.6, d + 0.5, p.roofColor ?? DEFAULT_ROOF, g)
  b.box(0, 0, d / 2 + 0.02, 1, 2.1, 0.05, 0x2a1d14, { parent: g })
  for (const side of [-1, 1]) {
    const { color, emissive } = pane(b.random() < 0.15)
    b.box(side * w * 0.28, 1.1, d / 2 + 0.03, 1.1, 1.1, 0.04, color, { parent: g, emissive })
    if (p.isBoarded || b.random() < 0.3) for (const k of [-1, 1]) b.box(side * w * 0.28, 1.5 + k * 0.25, d / 2 + 0.08, 1.3, 0.14, 0.04, 0x6b4a2a, { parent: g, rz: k * 0.15 })
  }
  return b.finish({ x: p.x, z: p.z, width: w + 0.5, depth: d + 0.5, height: 4.6 })
}
