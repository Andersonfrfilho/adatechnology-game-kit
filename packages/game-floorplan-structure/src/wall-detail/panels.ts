import type { JointKind } from '@adatechnology/game-contracts'

import { round2 } from '../geometry'
import type { Opening, Rect, StructurePart, Support } from '../types'

export interface PanelStyle {
  lintelMaterial: string
  lintelAssembly?: string
  /** Joint of a lintel on its piers and of the wall above it on the lintel. */
  lintelJoint: JointKind
  wallJoint: JointKind
  /** Depth of the lintel over an opening of the given width, metres (default `LINTEL_DEPTH`): a wide opening needs a deeper beam. */
  lintelDepth?: (span: number) => number
  /** A concrete sill beam (contraverga) under each window, `SILL_BEAM_DEPTH` deep and bearing `LINTEL_BEARING` on the piers: masonry walls have one. */
  sillBeam?: boolean
}

export interface WallSplit {
  pieces: StructurePart[]
  /** What the pieces rest on among themselves (lintel on piers, spandrel on lintel). */
  internal: Support[]
  /** Pieces that rest on what the wall rests on. */
  base: string[]
  /** Pieces that carry what rests on the wall. */
  top: string[]
}

export const LINTEL_DEPTH = 0.2
export const LINTEL_BEARING = 0.2
/** Depth of the sill beam under a window of a masonry wall, metres (a contraverga is usually 10 cm). */
export const SILL_BEAM_DEPTH = 0.1
/** A lintel is at least a tenth of its span deep (span: the opening plus one bearing, h = L/10). */
const LINTEL_SPAN_RATIO = 10
const MIN_PIECE = 0.05

interface Frame {
  alongU: boolean
  from: number
  to: number
  cross: [number, number]
}

const frameOf = (wall: StructurePart): Frame => {
  const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1]
  return alongU ? { alongU, from: wall.aabb[0], to: wall.aabb[2], cross: [wall.aabb[1], wall.aabb[3]] } : { alongU, from: wall.aabb[1], to: wall.aabb[3], cross: [wall.aabb[0], wall.aabb[2]] }
}

const boxOf = (frame: Frame, from: number, to: number): Rect => (frame.alongU ? [from, frame.cross[0], to, frame.cross[1]] : [frame.cross[0], from, frame.cross[1], to])

interface Draft {
  id: string
  role: StructurePart['role']
  material: string
  assembly?: string
  from: number
  to: number
  y0: number
  y1: number
  /** Volume that counts for the mass share (pieces tile the wall: a lintel keeps the bearing it shares with the piers). */
  volume: number
}

/**
 * Cuts a wall at its windows: piers between them at full height, a sill wall under each window, a lintel over it that bears 0.2 m on the piers and the wall
 * above the lintel up to the top. The mass of the wall is shared among the pieces by volume, so the total is the wall's.
 */
export function splitIntoPanels(wall: StructurePart, openings: readonly Opening[], style: PanelStyle): WallSplit {
  const frame = frameOf(wall)
  const own = openings.filter((o) => o.wall === wall.id && o.to > frame.from + MIN_PIECE && o.from < frame.to - MIN_PIECE).sort((a, b) => a.from - b.from)
  if (!own.length) return { pieces: [wall], internal: [], base: [wall.id], top: [wall.id] }
  const drafts: Draft[] = []
  const piers: Draft[] = []
  const lintels: Draft[] = []
  const sillBeams: Draft[] = []
  const spandrels: (Draft | undefined)[] = []
  const height = wall.y1 - wall.y0
  let cursor = frame.from
  const roleOf = wall.role
  const addPier = (to: number): void => {
    if (to - cursor < MIN_PIECE) return
    piers.push({ id: `${wall.id}_pier_${piers.length}`, role: roleOf, material: wall.material, from: cursor, to, y0: wall.y0, y1: wall.y1, volume: (to - cursor) * height })
  }
  own.forEach((opening, k) => {
    addPier(Math.max(cursor, opening.from))
    const span = opening.to - opening.from
    const lintelTop = Math.min(wall.y1, opening.y1 + Math.max(LINTEL_DEPTH, style.lintelDepth?.(span) ?? 0, (span + LINTEL_BEARING) / LINTEL_SPAN_RATIO))
    const lintelFrom = Math.max(frame.from, opening.from - LINTEL_BEARING)
    const lintelTo = Math.min(frame.to, opening.to + LINTEL_BEARING)
    const lintelHeight = lintelTop - opening.y1
    const sillTop = style.sillBeam && opening.y0 - wall.y0 > SILL_BEAM_DEPTH + MIN_PIECE ? opening.y0 - SILL_BEAM_DEPTH : opening.y0
    if (sillTop - wall.y0 > MIN_PIECE) drafts.push({ id: `${wall.id}_sill_${k}`, role: 'partition', material: wall.material, from: opening.from, to: opening.to, y0: wall.y0, y1: sillTop, volume: (opening.to - opening.from) * (sillTop - wall.y0) })
    if (sillTop < opening.y0) sillBeams.push({ id: `${wall.id}_sillbeam_${k}`, role: 'beam', material: style.lintelMaterial, from: lintelFrom, to: lintelTo, y0: sillTop, y1: opening.y0, volume: (lintelTo - lintelFrom) * SILL_BEAM_DEPTH })
    lintels.push({ id: `${wall.id}_lintel_${k}`, role: 'beam', material: style.lintelMaterial, from: lintelFrom, to: lintelTo, y0: opening.y1, y1: lintelTop, volume: (lintelTo - lintelFrom) * lintelHeight })
    spandrels.push(wall.y1 - lintelTop > MIN_PIECE ? { id: `${wall.id}_spandrel_${k}`, role: roleOf, material: wall.material, from: opening.from, to: opening.to, y0: lintelTop, y1: wall.y1, volume: (opening.to - opening.from) * (wall.y1 - lintelTop) } : undefined)
    cursor = opening.to
  })
  addPier(frame.to)
  // the piers give the bearing zone of each lintel and sill beam to it
  for (const pier of piers) {
    for (const lintel of [...lintels, ...sillBeams]) {
      const overlap = Math.max(0, Math.min(pier.to, lintel.to) - Math.max(pier.from, lintel.from))
      pier.volume -= overlap * (lintel.y1 - lintel.y0)
    }
  }
  const all = [...piers, ...drafts, ...sillBeams, ...lintels, ...spandrels.filter((d): d is Draft => d !== undefined)]
  const total = all.reduce((sum, d) => sum + d.volume, 0)
  const pieces = all.map((d): StructurePart => ({
    id: d.id, role: d.role, material: d.material, aabb: boxOf(frame, d.from, d.to), y0: d.y0, y1: d.y1, floor: wall.floor, mass: round2(Math.max(0.1, (wall.mass * d.volume) / total)), host: wall.id,
    ...(d.role === 'beam' ? (style.lintelAssembly ? { assembly: style.lintelAssembly } : {}) : wall.assembly ? { assembly: wall.assembly } : {}),
  }))
  const internal: Support[] = []
  // a sill beam rests on the masonry under the window and bears on the piers at each side
  for (const beam of sillBeams) {
    const sill = drafts.find((d) => d.id === beam.id.replace('_sillbeam_', '_sill_'))
    if (sill) internal.push({ part: beam.id, on: sill.id, joint: style.lintelJoint })
    for (const pier of piers) if (Math.min(pier.to, beam.to) - Math.max(pier.from, beam.from) > 0) internal.push({ part: beam.id, on: pier.id, joint: style.lintelJoint })
  }
  lintels.forEach((lintel, k) => {
    for (const pier of piers) if (Math.min(pier.to, lintel.to) - Math.max(pier.from, lintel.from) > 0) internal.push({ part: lintel.id, on: pier.id, joint: style.lintelJoint })
    const spandrel = spandrels[k]
    if (spandrel) internal.push({ part: spandrel.id, on: lintel.id, joint: style.wallJoint })
  })
  const base = [...piers, ...drafts.filter((d) => d.id.includes('_sill_'))].map((d) => d.id)
  const top = [...piers.map((p) => p.id), ...lintels.map((l, k) => spandrels[k]?.id ?? l.id)]
  return { pieces, internal, base, top }
}
