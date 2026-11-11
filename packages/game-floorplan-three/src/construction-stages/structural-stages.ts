import type * as THREE_NS from 'three'
import { PLASTER_PER_FACE, applyPanels, pillarSectionForWidth, applySlabPanels, beamDepthFor, deepenBondBeams, resolveSlabPanels } from '@adatechnology/game-floorplan-structure'
import type { Outbuilding, PlanStructure, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { Three } from '../kernel-types.js'
import { addStageBox, buildMasonryPanel, createMasonryBatches, masonryMeshes } from './masonry-stage.js'
import { cutOf, subtractRects, wallLineOf } from './wall-plane.js'
import type { WallRect } from './wall-plane.js'

export interface StructuralStageGroups {
  readonly foundation: THREE_NS.Group
  /** The pillars' starter bars out of the footings: seen while the foundation is open, inside the pillars once they are cast. */
  readonly starterBars: THREE_NS.Group
  readonly frame: THREE_NS.Group
  readonly masonry: THREE_NS.Group
  readonly roofFraming: THREE_NS.Group
}

/** A solid of the frame as it is drawn: plan box and heights, after it was fitted to the others (a beam stops under the slab it carries). */
interface Solid {
  readonly id: string
  aabb: [number, number, number, number]
  y0: number
  y1: number
  readonly floor: number
}

/** How far an outbuilding's ground beam reaches past each face of its wall, metres. */
const GROUND_BEAM_LIP = 0.025
/** Top of the ground beams and footings: the masonry starts on it. */
const FOUNDATION_TOP = 0.08
const EPS = 1e-4
/** How far a beam or a pillar reaches into the slab cast on it. */
const SLAB_BITE = 0.04
const PANEL_LAP = 0.01
/** The slab's edge stands this far out of the outer faces of what carries it: never on their plane. */
const SLAB_LIP = 0.005

function addRebarCage(THREE: Three, parent: THREE_NS.Group, box: readonly [number, number, number, number], yBase: number, height: number, rebarMat: THREE_NS.Material): void {
  const [u0, v0, u1, v1] = box
  // the bars sit inside the ground beams too (a pillar is wider than the beam under it): no bar face on a beam face
  const inset = Math.min(0.045, (u1 - u0) * 0.25, (v1 - v0) * 0.25)
  const r = 0.006
  for (const x of [u0 + inset, u1 - inset]) for (const z of [v0 + inset, v1 - inset]) addStageBox(THREE, parent, x - r, yBase, z - r, x + r, yBase + height, z + r, rebarMat)
  for (let y = yBase + 0.08; y < yBase + height - 0.03; y += 0.14) addStageBox(THREE, parent, u0 + inset, y, v0 + inset, u1 - inset, y + 0.006, v1 - inset, rebarMat)
}

function createStageMaterials(THREE: Three): Record<string, THREE_NS.Material> {
  return {
    dirt: new THREE.MeshStandardMaterial({ color: 0x8a7250, roughness: 0.96 }),
    footing: new THREE.MeshStandardMaterial({ color: 0x7a766e, roughness: 0.92 }),
    baldrame: new THREE.MeshStandardMaterial({ color: 0x5c5852, roughness: 0.88 }),
    slab0: new THREE.MeshStandardMaterial({ color: 0xa6a298, roughness: 0.86 }),
    // pillars, beams and slabs are cast in one concrete: where they meet, they are one surface
    concrete: new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.82 }),
    lintel: new THREE.MeshStandardMaterial({ color: 0x848078, roughness: 0.8 }),
    rebar: new THREE.MeshStandardMaterial({ color: 0x523a28, roughness: 0.55, metalness: 0.65 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xb85a3a, roughness: 0.88 }),
    block: new THREE.MeshStandardMaterial({ color: 0x989690, roughness: 0.88 }),
    mortar: new THREE.MeshStandardMaterial({ color: 0xc2bdb2, roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa87e4c, roughness: 0.82 }),
    log: new THREE.MeshStandardMaterial({ color: 0x78502e, roughness: 0.86 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0x8e949a, roughness: 0.45, metalness: 0.6 }),
    drywall: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.85 }),
  }
}

const overlapArea = (a: readonly number[], b: readonly number[]): number =>
  Math.max(0, Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)) * Math.max(0, Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!))

/** Plaster each side of a bare wall: the bricks, and the bond beams and lintels cast in the wall's line, are this much narrower than the finished wall. */
const PLASTER = PLASTER_PER_FACE

/** A beam cast in a wall's line (a bond beam, a lintel, a slab's beam over a partition) as wide as the wall's bricks: the plaster covers both later. */
function toCoreWidth(b: Solid): Solid {
  const alongU = b.aabb[2] - b.aabb[0] >= b.aabb[3] - b.aabb[1]
  const width = alongU ? b.aabb[3] - b.aabb[1] : b.aabb[2] - b.aabb[0]
  if (width > 0.25 || width - 2 * PLASTER < 0.1) return b
  b.aabb = alongU ? [b.aabb[0], b.aabb[1] + PLASTER, b.aabb[2], b.aabb[3] - PLASTER] : [b.aabb[0] + PLASTER, b.aabb[1], b.aabb[2] - PLASTER, b.aabb[3]]
  return b
}

const solidOf = (p: StructurePart): Solid => ({ id: p.id, aabb: [...p.aabb] as Solid['aabb'], y0: p.y0, y1: p.y1, floor: p.floor ?? 0 })

const isLintel = (id: string): boolean => /lintel|sillbeam|sill_beam/.test(id)
const isGroundBeam = (p: StructurePart): boolean => p.beamKind === 'ground_beam' || /^(ground_beam_|base_beam_)/.test(p.id)
const isFoundation = (p: StructurePart): boolean =>
  isGroundBeam(p) || (p.role === 'slab' && p.floor === 0 && !p.id.includes('top') && p.y0 < 0.3) || /^(footing_pier_|joist_|foundation_raft)/.test(p.id)

/** The concrete of a foundation part as it is drawn (ground beams and footings stand to `FOUNDATION_TOP`, the ground slab a little over the ground). */
function foundationSolid(p: StructurePart): Solid & { readonly kind: 'baldrame' | 'footing' | 'slab0' } {
  const [u0, v0, u1, v1] = p.aabb
  if (isGroundBeam(p)) return { id: p.id, aabb: [u0, v0, u1, v1], y0: Math.min(p.y0, -0.25), y1: Math.max(p.y1, FOUNDATION_TOP), floor: 0, kind: 'baldrame' }
  if (p.id.startsWith('footing_pier_')) return { id: p.id, aabb: [u0 - 0.06, v0 - 0.06, u1 + 0.06, v1 + 0.06], y0: Math.min(p.y0, -0.45), y1: Math.max(p.y1, 0.03), floor: 0, kind: 'footing' }
  return { id: p.id, aabb: [u0, v0, u1, v1], y0: -0.08, y1: 0.02, floor: 0, kind: 'slab0' }
}

/**
 * Slabs reach the outer faces of the bond beams they rest on, and every beam or pillar under a slab stops just inside it: a beam and the slab over it
 * never share a face on one plane (their tops on one plane were the flickering bands of the ceiling), nor leave a seam for light to leak through.
 */
function seatSlabs(slabs: Solid[], carriers: Solid[], beams: readonly Solid[]): void {
  // each slab with its own panels: another slab on the floor (an outbuilding's) never stands for its edge
  const slabOf = (s: Solid): string => `${s.floor}:${s.id.replace(/_p\d+$/, '')}`
  for (const key of new Set(slabs.map(slabOf))) {
    const own = slabs.filter((s) => slabOf(s) === key)
    const f = own[0]!.floor
    const bounds = [Math.min(...own.map((s) => s.aabb[0])), Math.min(...own.map((s) => s.aabb[1])), Math.max(...own.map((s) => s.aabb[2])), Math.max(...own.map((s) => s.aabb[3]))]
    const under = carriers.filter((c) => c.floor === f && own.some((s) => overlapArea(c.aabb, s.aabb) > EPS && c.y1 > s.y0 - 0.05 && c.y1 <= s.y1 + EPS))
    if (!under.length) continue
    // the edge is cast against the bond beam's face, flush with the wall: a pillar deeper than the wall stands out under it, the slab does not follow it
    // (a side is reached by the beams that run along it: the end of a crossing bond beam reaches past the wall's bricks)
    const along = (alongU: boolean): Solid[] => {
      const own = under.filter((c) => beams.includes(c) && c.aabb[2] - c.aabb[0] >= c.aabb[3] - c.aabb[1] === alongU)
      return own.length ? own : under
    }
    const [acrossU, acrossV] = [along(false), along(true)]
    const reach = [Math.min(...acrossU.map((c) => c.aabb[0])), Math.min(...acrossV.map((c) => c.aabb[1])), Math.max(...acrossU.map((c) => c.aabb[2])), Math.max(...acrossV.map((c) => c.aabb[3]))]
    for (const s of own) {
      for (const k of [0, 1] as const) if (Math.abs(s.aabb[k] - bounds[k]!) < EPS && reach[k]! < s.aabb[k] + SLAB_LIP && s.aabb[k] - reach[k]! < 0.3) s.aabb[k] = reach[k]! - SLAB_LIP
      for (const k of [2, 3] as const) if (Math.abs(s.aabb[k] - bounds[k]!) < EPS && reach[k]! > s.aabb[k] - SLAB_LIP && reach[k]! - s.aabb[k] < 0.3) s.aabb[k] = reach[k]! + SLAB_LIP
    }
    // the panels of one slab overlap a little where they meet (one concrete): no seam between them for the sun's shadow to leak through
    for (const s of own) {
      for (const k of [0, 1] as const) if (s.aabb[k] > bounds[k]! + EPS) s.aabb[k] -= PANEL_LAP
      for (const k of [2, 3] as const) if (s.aabb[k] < bounds[k]! - EPS) s.aabb[k] += PANEL_LAP
    }
  }
  for (const c of carriers) {
    const over = slabs.filter((s) => overlapArea(c.aabb, s.aabb) > EPS && c.y1 > s.y0 - 0.05 && c.y1 <= s.y1 + EPS && c.y0 < s.y0 - EPS)
    // cast together: the beam runs a little into the slab (one concrete, one colour), so no seam is left for the sun's shadow to leak light through
    // (into every slab it carries: one thinner than the others over it has its bottom higher)
    if (over.length) c.y1 = Math.max(...over.map((s) => s.y0 + Math.min(SLAB_BITE, (s.y1 - s.y0) / 2)))
  }
}

/**
 * A lintel or sill beam as it is cast: not inside a deeper bond beam that already spans the opening (it is dropped), shortened to the faces of the pillars
 * at its ends (its end on a pillar's face flickered), and under the beam above it.
 */
function fitLintel(l: Solid, beams: readonly Solid[], columns: readonly Solid[]): Solid | null {
  const wall = wallLineOf(l.aabb)
  for (const b of beams) {
    if (overlapArea(l.aabb, b.aabb) < EPS || b.y1 <= l.y0 + EPS || b.y0 >= l.y1 - EPS) continue
    if (b.y0 <= l.y0 + EPS) return null
    l.y1 = Math.min(l.y1, b.y0)
  }
  let a0 = wall.a0, a1 = wall.a1
  const mid = (a0 + a1) / 2
  for (const c of columns) {
    const cut = cutOf(wall, c.aabb, c.y0, c.y1)
    if (!cut || cut.y1 <= l.y0 || cut.y0 >= l.y1) continue
    if (cut.a1 <= mid) a0 = Math.max(a0, cut.a1)
    else if (cut.a0 >= mid) a1 = Math.min(a1, cut.a0)
  }
  if (a1 - a0 < 0.05 || l.y1 - l.y0 < 0.02) return null
  l.aabb = wall.alongU ? [a0, l.aabb[1], a1, l.aabb[3]] : [l.aabb[0], a0, l.aabb[2], a1]
  return l
}

/** The outbuilding's structure in the terms of the house's: footings, ground beams, corner pillars, bond beams, the slab over them, lintels, sills and walls. */
function outbuildingParts(e: Outbuilding): { parts: StructurePart[]; openings: { readonly id: string; readonly aabb: readonly number[]; readonly y0: number; readonly y1: number }[] } {
  const [a0, b0, a1, b1] = e.aabb
  const ceiling = e.ceiling || 2.6
  const th = e.thickness || 0.15
  const h = th / 2
  const part = (id: string, role: StructurePart['role'], aabb: readonly number[], y0: number, y1: number, material = 'concrete', extra: Partial<StructurePart> = {}): StructurePart =>
    ({ id: `${e.id}_${id}`, role, material, aabb: aabb as StructurePart['aabb'], y0, y1, floor: 0, mass: 0, ...extra }) as StructurePart
  const parts: StructurePart[] = []
  const sides: readonly [string, readonly number[]][] = [
    ['north', [a0 - h, b0 - h, a1 + h, b0 + h]],
    ['south', [a0 - h, b1 - h, a1 + h, b1 + h]],
    ['west', [a0 - h, b0 - h, a0 + h, b1 + h]],
    ['east', [a1 - h, b0 - h, a1 + h, b1 + h]],
  ]
  for (const [side, box] of sides) {
    // the ground beam is wider than the wall it carries (the render and the pillars' faces stand on it, never on its edge)
    const footing = [box[0]! - GROUND_BEAM_LIP, box[1]! - GROUND_BEAM_LIP, box[2]! + GROUND_BEAM_LIP, box[3]! + GROUND_BEAM_LIP]
    parts.push(part(`ground_beam_${side}`, 'beam', footing, -0.25, FOUNDATION_TOP, 'concrete', { beamKind: 'ground_beam' }))
    parts.push(part(`bond_beam_${side}`, 'beam', box, ceiling - 0.2, ceiling, 'concrete', { beamKind: 'bond_beam' }))
  }
  // the corner pillars of NBR 6118 (360 cm², 14 cm the least side) in its walls' core, flush with the outer corner and running in along the wall, as the
  // house's: never out of the walls' faces nor of the slab's edge
  const section = pillarSectionForWidth(th - 2 * PLASTER_PER_FACE)
  const corners: readonly (readonly [number, number, number])[] = [[a0, b0, 1], [a1, b0, -1], [a0, b1, 1], [a1, b1, -1]]
  corners.forEach(([u, v, inward], k) => {
    const outer = u - inward * h, [s0, s1] = inward > 0 ? [outer, outer + section.along] : [outer - section.along, outer]
    parts.push(part(`column_${k}`, 'column', [s0, v - section.across / 2, s1, v + section.across / 2], 0, ceiling))
  })
  parts.push(part('slab', 'slab', [a0 - h, b0 - h, a1 + h, b1 + h], ceiling - 0.1, ceiling))
  const openings: { id: string; aabb: number[]; y0: number; y1: number }[] = []
  const opening = (o: Outbuilding['doors'][number], y0: number, y1: number, sill: boolean): void => {
    const alongU = o.axis === 'u'
    const at = o.at ?? (alongU ? o.u : o.v)
    const pos = o.pos ?? (alongU ? o.v : o.u)
    const w = o.width || 0.85
    const span = (reach: number): number[] => (alongU ? [at - w / 2 - reach, pos - h, at + w / 2 + reach, pos + h] : [pos - h, at - w / 2 - reach, pos + h, at + w / 2 + reach])
    openings.push({ id: o.id, aabb: span(0), y0, y1 })
    parts.push(part(`${o.id}_lintel`, 'beam', span(0.2), y1, y1 + 0.25))
    if (sill) parts.push(part(`${o.id}_sillbeam`, 'beam', span(0.2), y0 - 0.1, y0))
  }
  for (const d of e.doors || []) opening(d, 0, d.height ?? 2.1, false)
  for (const w of e.windows || []) opening(w, w.y0 ?? 1, w.y1 ?? 2, true)
  e.walls.forEach((w, i) => {
    const aabb = w.axis === 'u' ? [w.u0, w.v0 - h, w.u1, w.v0 + h] : [w.u0 - h, w.v0, w.u0 + h, w.v1]
    parts.push(part(`wall_${i}`, 'wall', aabb, 0, ceiling, 'brick'))
  })
  return { parts, openings }
}

/**
 * The masonry of one wall line laid as one: its collinear parts (piers, sills, spandrels, the panels between pillars) of the same storey, build and thickness
 * joined into one part over their whole stretch, with the openings they leave between them as gaps. Laid part by part, every part boundary was a straight
 * seam through the courses; laid as one, the courses run whole and are only cut round what stands in them.
 */
function wallRuns(walls: readonly StructurePart[]): { part: StructurePart; gaps: WallRect[] }[] {
  const key = (p: StructurePart): string => {
    const w = wallLineOf(p.aabb)
    return [p.floor ?? 0, w.alongU ? 'u' : 'v', w.line.toFixed(2), w.thickness.toFixed(2), p.assembly ?? '', p.material].join('|')
  }
  const byLine = new Map<string, StructurePart[]>()
  for (const p of walls) {
    const k = key(p)
    const list = byLine.get(k)
    if (list) list.push(p)
    else byLine.set(k, [p])
  }
  const runs: { part: StructurePart; gaps: WallRect[] }[] = []
  for (const list of byLine.values()) {
    const sorted = [...list].sort((a, b) => wallLineOf(a.aabb).a0 - wallLineOf(b.aabb).a0)
    let group: StructurePart[] = []
    let end = -Infinity
    const flush = (): void => {
      if (!group.length) return
      const lines = group.map((g) => wallLineOf(g.aabb))
      const a0 = Math.min(...lines.map((l) => l.a0)), a1 = Math.max(...lines.map((l) => l.a1))
      const y0 = Math.min(...group.map((g) => g.y0)), y1 = Math.max(...group.map((g) => g.y1))
      const first = group[0]!, w = lines[0]!
      const aabb = (w.alongU ? [a0, first.aabb[1], a1, first.aabb[3]] : [first.aabb[0], a0, first.aabb[2], a1]) as StructurePart['aabb']
      const gaps = subtractRects({ a0, a1, y0, y1 }, group.map((g, k) => ({ a0: lines[k]!.a0, a1: lines[k]!.a1, y0: g.y0, y1: g.y1 })))
      runs.push({ part: { ...first, id: group.map((g) => g.id).join('+'), aabb, y0, y1 }, gaps })
      group = []
    }
    for (const p of sorted) {
      const l = wallLineOf(p.aabb)
      if (group.length && l.a0 > end + 0.02) flush()
      group.push(p)
      end = Math.max(end, l.a1)
    }
    flush()
  }
  return runs
}


/** The structure the stages draw: the plan's structure in panels (slab panels on beams, walls cut at their pillars and openings), with the outbuildings. */
function detailedParts(rawStructure: PlanStructure): StructurePart[] {
  const resolved = resolveSlabPanels(true)
  const slabOptions = resolved && rawStructure.levels.length <= resolved.maxStoreys ? resolved : undefined
  const slabbed = slabOptions ? applySlabPanels({ parts: rawStructure.parts, supports: rawStructure.supports }, rawStructure, slabOptions) : { parts: rawStructure.parts, supports: rawStructure.supports }
  const walled = applyPanels(slabbed, rawStructure, 'panels', slabOptions && rawStructure.construction.frame.rebar ? (span) => beamDepthFor(span, slabOptions) : undefined)
  return (slabOptions ? deepenBondBeams(walled, rawStructure, slabOptions) : walled).parts
}

/**
 * The bare structure by construction stage: the foundation (footings, ground beams, starter bars), the frame (pillars, bond beams, slabs) and the masonry
 * (walls, lintels and sills, laid between the frame's members). Every solid is fitted to the ones it touches so that no two of them draw a face on the same plane.
 */
export function buildStructuralStageGroups(THREE: Three, rawStructure: PlanStructure | undefined, outbuildings?: readonly Outbuilding[]): StructuralStageGroups {
  const foundation = new THREE.Group()
  foundation.name = 'stage:1:foundation'
  const frame = new THREE.Group()
  frame.name = 'stage:2:frame'
  const masonry = new THREE.Group()
  masonry.name = 'stage:3:masonry'
  const roofFraming = new THREE.Group()
  roofFraming.name = 'stage:7:roof_framing'
  const starterBars = new THREE.Group()
  starterBars.name = 'stage:1:starter_bars'
  const groups: StructuralStageGroups = { foundation, starterBars, frame, masonry, roofFraming }
  if (!rawStructure) return groups

  const mats = createStageMaterials(THREE)
  const parts = detailedParts(rawStructure).filter((p) => p.role !== 'roof' && !/^(rafter_|ridge)/.test(p.id))
  const openings: { id: string; aabb: readonly number[]; y0: number; y1: number }[] = []
  for (const e of outbuildings ?? []) {
    const ob = outbuildingParts(e)
    parts.push(...ob.parts)
    openings.push(...ob.openings)
  }

  // the excavated, compacted bed under every footprint
  const footprint = rawStructure.parts.filter((p) => p.floor === 0 || p.y0 <= 0.1)
  if (footprint.length) {
    addStageBox(THREE, foundation, Math.min(...footprint.map((p) => p.aabb[0])) - 0.05, -0.06, Math.min(...footprint.map((p) => p.aabb[1])) - 0.05, Math.max(...footprint.map((p) => p.aabb[2])) + 0.05, 0.006, Math.max(...footprint.map((p) => p.aabb[3])) + 0.05, mats.dirt!, 'foundation_dirt_bed')
  }
  for (const e of outbuildings ?? []) addStageBox(THREE, foundation, e.aabb[0] - 0.15, -0.06, e.aabb[1] - 0.15, e.aabb[2] + 0.15, 0.006, e.aabb[3] + 0.15, mats.dirt!, `${e.id}_dirt_bed`)

  const seen = new Set<string>()
  const foundations = parts.filter(isFoundation).filter((p) => !seen.has(p.id) && !!seen.add(p.id)).map(foundationSolid)
  for (const s of foundations) addStageBox(THREE, foundation, s.aabb[0], s.y0, s.aabb[1], s.aabb[2], s.y1, s.aabb[3], mats[s.kind]!, s.id)

  const columnParts = parts.filter((p) => p.role === 'column' && !isFoundation(p))
  const columns: (Solid & { readonly tank: boolean; readonly material: string })[] = columnParts.map((p) => ({ ...solidOf(p), tank: p.id.startsWith('tank_'), material: p.material }))
  const slabs = parts.filter((p) => p.role === 'slab' && !isFoundation(p)).map(solidOf)
  const beamParts = parts.filter((p) => p.role === 'beam' && !isFoundation(p))
  const beams = beamParts.filter((p) => !isLintel(p.id)).map(solidOf).map(toCoreWidth)
  seatSlabs(slabs.filter((s) => !s.id.startsWith('tank_')), [...beams, ...columns.filter((c) => !c.tank)], beams)

  for (const c of columns) {
    const mat = c.material === 'wood_soft' || c.material === 'wood_hard' ? mats.wood! : c.material === 'steel' ? mats.sheet! : mats.concrete!
    addStageBox(THREE, frame, c.aabb[0], c.y0, c.aabb[1], c.aabb[2], c.y1, c.aabb[3], mat, c.id)
    if (c.tank || c.y0 > 0.1 || c.material !== 'concrete') continue
    if (c.floor === 0) addRebarCage(THREE, starterBars, c.aabb, 0, 0.42, mats.rebar!)
  }
  for (const b of beams) {
    const p = beamParts.find((x) => x.id === b.id)
    addStageBox(THREE, frame, b.aabb[0], b.y0, b.aabb[1], b.aabb[2], b.y1, b.aabb[3], p && (p.material === 'wood_soft' || p.material === 'wood_hard') ? mats.wood! : mats.concrete!, b.id)
  }
  for (const s of slabs) addStageBox(THREE, frame, s.aabb[0], s.y0, s.aabb[1], s.aabb[2], s.y1, s.aabb[3], mats.concrete!, s.id)

  // lintels and sills are cast with the masonry they bear on, never hanging in the frame
  const lintels = beamParts.filter((p) => isLintel(p.id)).map(solidOf).map(toCoreWidth).map((l) => fitLintel(l, beams, columns)).filter((l): l is Solid => l !== null)
  for (const l of lintels) addStageBox(THREE, masonry, l.aabb[0], l.y0, l.aabb[1], l.aabb[2], l.y1, l.aabb[3], mats.lintel!, l.id)

  const batches = createMasonryBatches()
  const unitId = rawStructure.construction.walls.unit
  const laid: Solid[] = []
  const solids: readonly Solid[] = [...foundations, ...columns, ...beams, ...slabs, ...lintels]
  for (const run of wallRuns(parts.filter((x) => x.role === 'wall' || x.role === 'partition'))) {
    const p = run.part
    const wall = wallLineOf(p.aabb)
    // what the run's parts leave open inside it (the windows and doors between its piers, sills and spandrels) stays open
    const cuts: WallRect[] = [...run.gaps]
    for (const s of [...solids, ...laid]) {
      // a pillar seated into a slab still owns its whole storey in the wall: no unit is laid over its head
      const top = columns.includes(s as (typeof columns)[number]) ? s.y1 + 0.3 : s.y1
      const cut = cutOf(wall, s.aabb, s.y0, top)
      if (cut) cuts.push(cut)
    }
    for (const o of openings) {
      const cut = cutOf(wall, o.aabb, o.y0, o.y1)
      if (cut) cuts.push(cut)
    }
    buildMasonryPanel(batches, p, cuts, (p.floor ?? 0) === 0 ? FOUNDATION_TOP : p.y0, typeof unitId === 'string' ? unitId : undefined)
    laid.push(solidOf(p))
  }
  for (const mesh of masonryMeshes(THREE, batches, mats, 'masonry')) masonry.add(mesh)
  return groups
}
