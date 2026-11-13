import { beamBearings } from '../beam-bearings'
import { loadFlowsAtRest } from '../loads'
import type { LoadFlow } from '../loads'
import type { MasonryUnit } from '../masonry-units'
import {
  FLANGE_THICKNESSES, GRAVITY, LOAD_GAMMA, MAX_WALL_SLENDERNESS, ONE_SIDED_BEARING_ECCENTRICITY, combinedRatio, designStrength, effectiveHeight, grossArea, sectionModulus,
  slendernessOf, slendernessReduction,
} from '../structural-masonry/design'
import { liveLoads } from '../structural-masonry/live-loads'
import type { LoadedRoom } from '../structural-masonry/live-loads'
import { loadPiers, piersOf } from '../structural-masonry/piers'
import type { LoadedPier } from '../structural-masonry/piers'
import type { Structure, StructurePart } from '../types'
import { STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'
import { endKind, lineOf, onLine, pointOf } from './masonry'
import type { WallLine } from './masonry'

/** What the compressive check of structural masonry reads: the plan's structure, the same built for play (piers, slab panels) and its rooms. */
export interface MasonryStrengthInput {
  readonly structure: Pick<Structure, 'parts' | 'supports' | 'openings' | 'levels'>
  readonly framed: Pick<Structure, 'parts' | 'supports'>
  readonly rooms: readonly LoadedRoom[]
  readonly unit: MasonryUnit
  readonly walls: readonly StructurePart[]
}

/** The design of one pier of a bearing wall, its interlocked flanges included: loads and resistances (N) and the factors behind them. */
export interface PierDesign {
  readonly wall: string
  readonly from: number
  readonly to: number
  /** Metres of the walls interlocked at its ends that work with it (up to `FLANGE_THICKNESSES` t each side of a junction). */
  readonly flange: number
  /** λ = h_ef / t_ef of the wall and R = 1 - (λ / 40)³. */
  readonly slenderness: number
  readonly reduction: number
  /** N_d = 1.4 (G + Q) at mid-height (what rests on the pier and half its own weight), N. */
  readonly normal: number
  /** M_d = 1.4 x (what bears on one face only) x t/6 at the top, N m. */
  readonly moment: number
  /** Gross area of the pier and its flanges, m², and the section modulus of the pier out of its plane, m³. */
  readonly area: number
  readonly modulus: number
  /** (N_d / (A R) + M_d / (1.5 W)) / f_d: the pier holds up to 1. */
  readonly ratio: number
}

interface RawPier extends LoadedPier {
  readonly wall: WallLine
  readonly slenderness: number
  readonly reduction: number
}

/** -1 or +1 for a slab or a beam on one face of the wall (ending on it), 0 for one over both (continuous across it) or in its line. */
function sideOf(part: StructurePart, wall: WallLine): number {
  const [lo, hi] = wall.alongU ? [part.aabb[1], part.aabb[3]] : [part.aabb[0], part.aabb[2]]
  const below = lo < wall.line - wall.half
  const above = hi > wall.line + wall.half
  return below === above ? 0 : below ? -1 : 1
}

/** The piers of every bearing wall with the loads of the load path at rest, the variable loads of NBR 6120 included (`liveLoads`). */
function rawPiers(input: MasonryStrengthInput): RawPier[] {
  const { framed, unit } = input
  const live = liveLoads(framed.parts, framed.supports, { rooms: input.rooms, levels: input.structure.levels })
  const loaded = framed.parts.map((part) => (live.has(part.id) ? { ...part, mass: part.mass + live.get(part.id)! } : part))
  const parts = new Map(loaded.map((part) => [part.id, part]))
  const { loads, flows } = loadFlowsAtRest(loaded, framed.supports)
  const across = new Set(beamBearings([...framed.parts.filter((p) => p.role === 'beam'), ...input.walls]).map((b) => b.beam.id))
  const braced = (id: string): boolean => framed.supports.some((s) => s.on === id && s.bears !== false && (parts.get(s.part)?.role === 'slab' || parts.get(s.part)?.beamKind === 'bond_beam'))
  const out: RawPier[] = []
  for (const wall of input.walls) {
    const line = lineOf(wall)
    // a slab or a beam ending on the wall brings its load from one face; a bond beam in the wall's line passes on the share of one-sided slab it carries
    const sided = (part: StructurePart): number => {
      if (part.role === 'slab' || (part.role === 'beam' && part.beamKind === undefined)) return sideOf(part, line)
      if (part.beamKind !== 'bond_beam') return 0
      const moment = (flows.get(part.id) ?? []).reduce((sum, f: LoadFlow) => sum + (parts.get(f.from)?.role === 'slab' ? sideOf(parts.get(f.from)!, line) * f.load : 0), 0)
      return moment / Math.max(1e-9, loads.get(part.id) ?? 0)
    }
    // the wall as it is built for play: cut into piers at its windows (`applyPanels`), each with its own loads; else the wall, its load by tributary length
    const cut = framed.parts.filter((p) => p.host === wall.id && p.id.startsWith(`${wall.id}_pier_`))
    const pieces = cut.length ? cut : [wall]
    for (const piece of pieces) {
      const along = line.alongU ? [piece.aabb[0], piece.aabb[2]] : [piece.aabb[1], piece.aabb[3]]
      const effective = effectiveHeight(piece.y1 - piece.y0, braced(piece.id))
      const slenderness = slendernessOf(effective, unit.width)
      const windows = cut.length ? [] : input.structure.openings.filter((o) => o.wall === wall.id && o.kind === 'window').map((o): [number, number] => [o.from, o.to])
      const piers = loadPiers({
        wall: piece, alongU: line.alongU, piers: piersOf(Math.max(line.from, along[0]!), Math.min(line.to, along[1]!), windows), flows: flows.get(piece.id) ?? [], parts,
        concentrated: (part) => part.id.startsWith('lintel_') || part.id.includes('_lintel_') || across.has(part.id), sided,
      })
      for (const pier of piers) out.push({ ...pier, wall: line, slenderness, reduction: slendernessReduction(slenderness) })
    }
  }
  return out
}

/** The masonry of `pier` within `reach` of `at` along its wall, as a share of the pier (0..1). */
const shareNear = (pier: RawPier, at: number, reach: number): number => Math.max(0, Math.min(pier.to, at + reach) - Math.max(pier.from, at - reach)) / Math.max(1e-6, pier.to - pier.from)

/**
 * NBR 16868-1 in compression with bending, pier by pier: N_d / (A R) + M_d / (1.5 W) ≤ f_d, N_d = 1.4 (G + Q) at mid-height, M_d = 1.4 x what bears on one
 * face x t/6 (a slab or a beam bearing on one face loads the wall a third of the bearing in from it), A the gross area. A pier that ends at a corner or a T
 * works in compression with the walls interlocked into it there (their masonry within `FLANGE_THICKNESSES` t of the junction, with its share of their
 * loads); its bending out of its plane is taken by its own section.
 */
export function pierDesigns(input: MasonryStrengthInput): PierDesign[] {
  const { unit } = input
  const strength = designStrength(unit)
  const reach = FLANGE_THICKNESSES * unit.width
  const raw = rawPiers(input)
  const lines = [...new Set(raw.map((p) => p.wall))]
  return raw.map((pier): PierDesign => {
    let { top, own } = pier
    let length = pier.to - pier.from
    for (const end of [pier.from, pier.to]) {
      const others = lines.filter((w) => w !== pier.wall && w.part.floor === pier.wall.part.floor)
      if (Math.min(Math.abs(end - pier.wall.from), Math.abs(end - pier.wall.to)) > 1e-3 || !['corner', 'junction'].includes(endKind(pier.wall, end, others))) continue
      const point = pointOf(pier.wall, end)
      for (const flange of raw.filter((q) => q.wall !== pier.wall && q.wall.alongU !== pier.wall.alongU && onLine(q.wall, point))) {
        const share = shareNear(flange, flange.wall.alongU ? point[0] : point[1], reach)
        top += share * flange.top
        own += share * flange.own
        length += share * (flange.to - flange.from)
      }
    }
    const area = grossArea(length, unit)
    const modulus = sectionModulus(pier.to - pier.from, unit)
    const normal = LOAD_GAMMA * (top + own / 2) * GRAVITY
    const moment = LOAD_GAMMA * Math.abs(pier.oneSided) * GRAVITY * unit.width * ONE_SIDED_BEARING_ECCENTRICITY
    return {
      wall: pier.wall.part.id, from: pier.from, to: pier.to, flange: length - (pier.to - pier.from), slenderness: pier.slenderness, reduction: pier.reduction,
      normal, moment, area, modulus, ratio: combinedRatio({ normal, moment, area, modulus, reduction: pier.reduction, strength }),
    }
  })
}

/** The slenderness and compression of the bearing walls of structural masonry (NBR 16868-1). */
export function strengthViolations(input: MasonryStrengthInput): StructuralViolation[] {
  const out: StructuralViolation[] = []
  const designs = pierDesigns(input)
  for (const wall of input.walls) {
    const worst = Math.max(0, ...designs.filter((d) => d.wall === wall.id).map((d) => d.slenderness))
    if (worst > MAX_WALL_SLENDERNESS + 1e-9) out.push({ code: STRUCTURAL_VIOLATION.WALL_TOO_SLENDER, part: wall.id, message: `${wall.id}: λ = h_ef / t_ef = ${worst.toFixed(1)} over ${MAX_WALL_SLENDERNESS}` })
  }
  for (const d of designs) {
    if (d.ratio > 1)
      out.push({
        code: STRUCTURAL_VIOLATION.MASONRY_OVERSTRESSED, part: d.wall,
        message: `${d.wall} pier ${d.from.toFixed(2)}-${d.to.toFixed(2)} m: N_d ${(d.normal / 1e3).toFixed(1)} kN, M_d ${(d.moment / 1e3).toFixed(2)} kN m, (N_d / A R + M_d / 1.5 W) / f_d = ${d.ratio.toFixed(2)} over 1`,
      })
  }
  return out
}
