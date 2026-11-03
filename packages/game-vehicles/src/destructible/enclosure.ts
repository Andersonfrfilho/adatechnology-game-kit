/**
 * The cabin of a vehicle as a closed space for the smoke, dust and steam of the host's effects (`EffectSink.enclose` of the contracts): a shut car
 * keeps the smoke out. It is open where it is in the real world: a door standing open, a window shattered, a door, glass or roof torn off or burnt
 * away; a bullet hole lets a little in at a rate that grows with its size, and the gaps of a shut door let a trace in.
 */
import type { Enclosure, EnclosureBox, ObjectState, Vec3 } from '@adatechnology/game-contracts'
import type { VehicleContext } from '../api'
import type { LocalBox, PartRole, VehicleModel } from './model'

/** The cabin box a vehicle with an interior records (`kit.interior`), in the vehicle's own space: x along it, `z` the inner half width. */
export interface CabinBox {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
  readonly z: number
}

/** What the cabin enclosure reads of a vehicle: its parts and their state (any `DestructibleImpl` of a vehicle has these). */
export interface CabinSource {
  readonly vehicle: VehicleContext
  readonly model: VehicleModel
  state(): ObjectState
}

export interface CabinEnclosureOptions {
  /** The object the destructible answers in (its `frame` option, where the host placed the vehicle): the holes of `state()` are in its space. Default `vehicle.root`. */
  readonly frame?: any
  /** Gaps of the shut doors and vents, share per second of the smoke pressing on the closed shell (default {@link CABIN_LEAK}). */
  readonly leak?: number
  /** How open a door or lid has to be (share of its full swing) to count as open (default 0.06: ajar). */
  readonly ajar?: number
}

/** The gaps of a shut car (door seals, the vents, the dash): about 2 % per second of what presses on it seeps in. */
export const CABIN_LEAK = 0.02
/** A bullet hole lets the smoke that presses on the patch around it through at this many per second per square metre of hole: a 9 mm hole about 0.2 a second, a slug's 0.8. */
const HOLE_RATE_PER_AREA = 3000
/** A crack in laminated glass opens this much more gap per metre of its length (share of the shut car's gaps). */
const CRACK_GAP_PER_METRE = 0.5
/** How far an opening sticks out through the shell on either side, metres (so smoke about to cross it finds it). */
const THROUGH = 0.18
/** Half size of the patch of shell around a bullet hole that it lets smoke through, metres. */
const HOLE_PATCH = 0.12
/** The full swing of a door or lid in the clips, radians (`createVehicleClips`). */
const FULL_SWING = 1.15
/** The parts that make the shell of the cabin: when one is gone, the cabin is open there. */
const SHELL_ROLES: ReadonlySet<PartRole> = new Set<PartRole>(['door', 'glass', 'roof', 'lid', 'panel', 'pillar'])
const GONE = new Set(['broken', 'melted', 'ashes'])

/** The cabin box of a vehicle, or `null` when it has none (a bike, a vehicle with no interior). */
export function cabinBoxOf(vehicle: VehicleContext): CabinBox | null {
  const cabin = (vehicle.meta as { cabin?: CabinBox }).cabin
  if (!cabin || !(cabin.x1 > cabin.x0) || !(cabin.y1 > cabin.y0) || !(cabin.z > 0)) return null
  return cabin
}

/** How far a door or lid stands open, 0 shut to 1 at the end of its clip: the turn of its drawn hinge from rest (the room poses it by the part id). */
export function swingOf(vehicle: VehicleContext, partId: string): number {
  const pivot = vehicle.vehicle?.getObjectByName?.(partId)
  const q = pivot?.quaternion
  if (!q) return 0
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w as number)))
  return Math.min(1, angle / FULL_SWING)
}

const overlaps = (b: LocalBox, c: CabinBox, margin: number): boolean =>
  Math.abs(b.center[0] - (c.x0 + c.x1) / 2) <= b.size[0] / 2 + (c.x1 - c.x0) / 2 + margin &&
  Math.abs(b.center[1] - (c.y0 + c.y1) / 2) <= b.size[1] / 2 + (c.y1 - c.y0) / 2 + margin &&
  Math.abs(b.center[2]) <= b.size[2] / 2 + c.z + margin

/**
 * The cabin of `source` as an `Enclosure` in world space, or `null` when there is no closed cabin (no interior, the vehicle exploded, every shell
 * part gone). Call it each frame, or when the vehicle moves or changes, and hand it to `EffectSink.enclose`.
 */
export function cabinEnclosure(source: CabinSource, options: CabinEnclosureOptions = {}): Enclosure | null {
  const c = source.vehicle
  const cabin = cabinBoxOf(c)
  const node = c.vehicle
  if (!cabin || !node?.localToWorld) return null
  const state = source.state()
  if (state.destroyed) return null
  // the vehicle's own three.js classes, whatever namespace built it
  const V3 = node.position.constructor as new (x?: number, y?: number, z?: number) => any
  const Quat = node.quaternion.constructor as new () => any
  const mid: Vec3 = [(cabin.x0 + cabin.x1) / 2, (cabin.y0 + cabin.y1) / 2, 0]
  const half: Vec3 = [(cabin.x1 - cabin.x0) / 2, (cabin.y1 - cabin.y0) / 2, cabin.z]
  const ajar = options.ajar ?? 0.06
  const byId = new Map(state.parts.map((p) => [p.id, p]))
  const mainGroup = state.groups[0] ? new Set(state.groups[0]) : null
  const openings: EnclosureBox[] = []
  let crackLength = 0
  const toCabin = (b: LocalBox): EnclosureBox => ({
    center: [b.center[0] - mid[0], b.center[1] - mid[1], b.center[2] - mid[2]],
    halfSize: [b.size[0] / 2 + THROUGH, b.size[1] / 2 + THROUGH, b.size[2] / 2 + THROUGH],
  })
  // the holes of state() are in the frame's space: back to the vehicle's own
  node.updateWorldMatrix?.(true, false)
  const frame = options.frame ?? c.root
  frame?.updateWorldMatrix?.(true, false)
  const inverse = node.matrixWorld.clone().invert()
  for (const def of source.model.parts) {
    if (!SHELL_ROLES.has(def.role) || !overlaps(def.box, cabin, 0.12)) continue
    const part = byId.get(def.id)
    if (!part) continue
    const gone = GONE.has(part.status) || (mainGroup !== null && !mainGroup.has(def.id))
    const swung = (def.role === 'door' || def.role === 'lid') && swingOf(c, def.id) > ajar
    if (gone || swung) {
      openings.push(toCabin(def.box))
      continue
    }
    for (const hole of part.holes) {
      if (!hole.through && def.material !== 'glass') continue
      const area = Math.PI * (hole.diameter / 2) ** 2
      const p = new V3(hole.point[0], hole.point[1], hole.point[2])
      if (frame?.localToWorld) frame.localToWorld(p)
      p.applyMatrix4(inverse)
      openings.push({
        center: [p.x - mid[0], p.y - mid[1], p.z - mid[2]],
        halfSize: [HOLE_PATCH, HOLE_PATCH, HOLE_PATCH],
        // the patch is far bigger than the hole: only a share of what crosses it passes, more for a bigger hole
        rate: Math.min(4, area * HOLE_RATE_PER_AREA),
      })
    }
    for (const crack of part.cracks) crackLength += crack.length
  }
  const center = node.localToWorld(new V3(mid[0], mid[1], mid[2]))
  const q = node.getWorldQuaternion(new Quat())
  const scale = node.getWorldScale(new V3())
  const leak = (options.leak ?? CABIN_LEAK) * (1 + crackLength * CRACK_GAP_PER_METRE)
  return {
    center: [center.x, center.y, center.z],
    halfSize: [half[0] * Math.abs(scale.x), half[1] * Math.abs(scale.y), half[2] * Math.abs(scale.z)],
    orientation: [q.x, q.y, q.z, q.w],
    openings: openings.map((o) => ({ ...o, center: [o.center[0] * scale.x, o.center[1] * scale.y, o.center[2] * scale.z], halfSize: [o.halfSize[0] * Math.abs(scale.x), o.halfSize[1] * Math.abs(scale.y), o.halfSize[2] * Math.abs(scale.z)] })),
    leak,
  }
}
