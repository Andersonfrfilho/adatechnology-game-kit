import { round2, touches } from './geometry'
import { applySlabPanels, resolveSlabPanels } from './slab-panels'
import type { Structure, StructurePart } from './types'

/** Most metres under the underside of a beam the top of a wall that carries it can stop (the bond beam between them); a wall may also rise past it, into the slab. */
const BEARING_GAP = 0.6
const EPS = 1e-6
/** Metres from a beam's axis a grouted core still takes its bearing (half the beam and half the core's cell). */
export const BEARING_CORE_REACH = 0.15

/** Where a beam bears across a wall: the wall and the plan coordinate along it of the beam's axis. */
export interface BeamBearing {
  readonly beam: StructurePart
  readonly wall: StructurePart
  readonly at: number
}

const alongU = (part: StructurePart): boolean => part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]

/** Whether a grouted core of `wall` takes the bearing at `at`. */
export const groutedAt = (wall: StructurePart, at: number): boolean => (wall.grout ?? []).some((station) => Math.abs(station - at) <= BEARING_CORE_REACH)

/**
 * The concentrated loads beams put on bearing walls: each beam that crosses a wall under it (on the wall, or on the bond beam over it), at its axis. A beam
 * along a wall (a bond beam, a lintel) bears on it all along and is not one. Structural masonry grouts a core under each (NBR 16868, local bearing).
 */
export function beamBearings(parts: readonly StructurePart[]): BeamBearing[] {
  const out: BeamBearing[] = []
  for (const beam of parts) {
    // (a rafter is the roof's timber, laid every metre along the bond beam: a load along it, not a point load)
    if (beam.role !== 'beam' || beam.beamKind === 'bond_beam' || beam.beamKind === 'ground_beam' || /lintel|sill|rafter|ridge/.test(beam.id)) continue
    const beamAlongU = alongU(beam)
    for (const wall of parts) {
      if (wall.role !== 'wall' || wall.y0 >= beam.y0 - EPS || wall.y1 < beam.y0 - BEARING_GAP || !touches(wall.aabb, beam.aabb, -EPS) || alongU(wall) === beamAlongU) continue
      const [u0, v0, u1, v1] = beam.aabb
      const at = round2(beamAlongU ? (v0 + v1) / 2 : (u0 + u1) / 2)
      // (a beam that only touches the end of the wall bears on its end core)
      const [from, to] = alongU(wall) ? [wall.aabb[0], wall.aabb[2]] : [wall.aabb[1], wall.aabb[3]]
      if (at > from + EPS && at < to - EPS) out.push({ beam, wall, at })
    }
  }
  return out
}

/**
 * Structural masonry: the cores under the beams the slab will have (`applySlabPanels`), grouted on the plan's walls (`grout`), so the plan, its validator, its
 * spec and its drawing all carry them. The slab's beams are only laid when it is cut into panels, so they are worked out on a copy here.
 */
export function addBearingCores(structure: Structure): void {
  const framed = applySlabPanels({ parts: structure.parts, supports: structure.supports }, structure, resolveSlabPanels(true)!)
  const walls = structure.parts.filter((part) => part.role === 'wall' && part.grout)
  for (const { wall, at } of beamBearings([...framed.parts.filter((part) => part.role === 'beam'), ...walls])) {
    if (!groutedAt(wall, at)) wall.grout = [...wall.grout!, at].sort((a, b) => a - b)
  }
}
