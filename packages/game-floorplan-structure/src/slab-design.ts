import type { Rect, StructurePart, Support } from './types'

/** Reinforced concrete of the slabs: C25 (NBR 6118), unit weight 25 kN/m³. */
const FCK = 25e3
const FCD = FCK / 1.4
const UNIT_WEIGHT = 25
/** Secant modulus E_cs = 0.85 · 5600 √f_ck (MPa → kPa) and the creep of a long-term deflection (α_f = 1.32, NBR 6118 17.3.2.1.2). */
const MODULUS = 0.85 * 5600 * Math.sqrt(FCK / 1000) * 1000
const CREEP = 1.32
/** Deflection limit of a slab: span / 250 (NBR 6118 13.3, visual acceptability). */
const DEFLECTION_LIMIT = 250
/** Bending at the ductility limit x/d = 0.45 (NBR 6118 14.6.4.3): M_d ≤ 0.251 b d² f_cd. */
const MOMENT_LIMIT = 0.251
/** Cover plus half a bar over the effective depth, metres. */
const COVER = 0.03
/** Floor finish (screed, tiles) and ceiling plaster, kN/m² (NBR 6120). */
export const SLAB_FINISHES = 1
/** Live load on a floor (NBR 6120, dwellings) and on a slab under a roof with no access, kN/m². */
export const FLOOR_LIVE_LOAD = 2
export const CEILING_LIVE_LOAD = 0.5
/** Live load of a roof (NBR 6120, no access), kN/m² of the slab its struts stand on. */
export const ROOF_LIVE_LOAD = 0.5
/** Quasi-permanent share of the live load (ψ2, dwellings), and the load factor of the ultimate limit state. */
const PSI2 = 0.3
const GAMMA = 1.4
const GRAVITY = 9.81
const STEP = 0.01

const isRoofMember = (part: StructurePart): boolean => part.role === 'beam' && /^(rafter|truss)/.test(part.id)

/** A rafter or truss standing on a slab on struts, and the share of its weight and of the roof covering on it the slab takes, kN. */
export interface StrutLoad {
  readonly member: Rect
  readonly load: number
}

/**
 * The roof a slab carries through struts: each rafter or truss resting on it (`on`: the slab, or the panels of one slab) with its own weight and the roof
 * covering on it, shared among what it rests on.
 */
export function roofOn(on: ReadonlySet<string>, structure: { parts: readonly StructurePart[]; supports: readonly Support[] }): StrutLoad[] {
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const members = new Set(structure.supports.filter((s) => on.has(s.on) && s.bears !== false && byId.get(s.part) !== undefined && isRoofMember(byId.get(s.part)!)).map((s) => s.part))
  return [...members].map((id) => {
    const member = byId.get(id)!
    const covering = structure.supports
      .filter((s) => s.on === id && byId.get(s.part)?.role === 'roof')
      .reduce((sum, s) => sum + byId.get(s.part)!.mass / Math.max(1, structure.supports.filter((x) => x.part === s.part && x.bears !== false).length), 0)
    const holds = structure.supports.filter((s) => s.part === id && s.bears !== false)
    // (a member on several panels of one slab counts once for the slab)
    const share = Math.min(1, holds.filter((s) => on.has(s.on)).length) / Math.max(1, new Set(holds.map((s) => (on.has(s.on) ? '' : s.on))).size)
    return { member: member.aabb, load: ((member.mass + covering) * share * GRAVITY) / 1000 }
  })
}

const lengthOver = (member: Rect, leaf: Rect): number => {
  const alongU = member[2] - member[0] >= member[3] - member[1]
  const across = alongU ? Math.min(member[3], leaf[3]) > Math.max(member[1], leaf[1]) : Math.min(member[2], leaf[2]) > Math.max(member[0], leaf[0])
  if (!across) return 0
  return Math.max(0, alongU ? Math.min(member[2], leaf[2]) - Math.max(member[0], leaf[0]) : Math.min(member[3], leaf[3]) - Math.max(member[1], leaf[1]))
}

/** The roof weight that comes onto `leaf`, kN: each strutted member's share spread along its length over the panels `leaves` of its slab. */
export function roofOver(leaf: Rect, leaves: readonly Rect[], struts: readonly StrutLoad[]): { load: number; carried: boolean } {
  let load = 0
  let carried = false
  for (const { member, load: share } of struts) {
    const here = lengthOver(member, leaf)
    const total = leaves.reduce((sum, other) => sum + lengthOver(member, other), 0)
    if (here <= 0 || total <= 0) continue
    load += (share * here) / total
    carried = true
  }
  return { load, carried }
}

/** What a slab panel carries besides its own weight, kN/m²: dead (finishes, the roof on struts) and live. */
export interface SlabLoads {
  readonly dead: number
  readonly live: number
}

/** The loads on a slab of `area` m² carrying `roof` (from `roofLoadOn`): finishes, the roof's weight spread over it and the roof's live load, or a floor's. */
export function slabLoads(slab: Pick<StructurePart, 'id' | 'cover'>, area: number, roof: { load: number; carried: boolean }): SlabLoads {
  const ceiling = slab.cover === true || /ceiling|top/.test(slab.id)
  return {
    dead: SLAB_FINISHES + (area > 0 ? roof.load / area : 0),
    live: (ceiling ? CEILING_LIVE_LOAD : FLOOR_LIVE_LOAD) + (roof.carried ? ROOF_LIVE_LOAD : 0),
  }
}

/** Share of a two-way panel's load its short span takes (strip method: λ⁴ / (1 + λ⁴), λ = long / short); a one-way panel takes it all. */
const shortShare = (short: number, long: number): number => {
  if (long >= 2 * short) return 1
  const ratio = (long / short) ** 4
  return ratio / (1 + ratio)
}

/**
 * Least thickness a panel simply supported on its edges needs for its loads (NBR 6118): its long-term deflection under the quasi-permanent load within
 * span / 250, and its design moment within the ductility limit. Its own weight is counted with the thickness it comes to.
 */
export function slabThicknessFor(leaf: Rect, loads: SlabLoads): number {
  const short = Math.min(leaf[2] - leaf[0], leaf[3] - leaf[1])
  const long = Math.max(leaf[2] - leaf[0], leaf[3] - leaf[1])
  const share = shortShare(short, long)
  let h = 0.08
  for (let k = 0; k < 8; k++) {
    const dead = loads.dead + UNIT_WEIGHT * h
    const quasi = (dead + PSI2 * loads.live) * share
    const deflection = Math.cbrt((12 * (5 / 384) * quasi * short ** 3 * DEFLECTION_LIMIT * (1 + CREEP)) / MODULUS)
    const moment = (GAMMA * (dead + loads.live) * share * short ** 2) / 8
    const bending = Math.sqrt(moment / (MOMENT_LIMIT * FCD)) + COVER
    h = Math.ceil(Math.max(deflection, bending) / STEP - 1e-9) * STEP
  }
  return h
}
