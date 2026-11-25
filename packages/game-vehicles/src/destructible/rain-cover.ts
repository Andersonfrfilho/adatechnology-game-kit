/**
 * What a vehicle roofs over for the rain (`RainCoverSource` of the contracts): the cabin of a car, bus or truck, from the same cabin box and shell parts as `cabinEnclosure`.
 * An open bed, a cabin with no roof part (a convertible, a jeep with the top off), or a car on its side covers nothing; a roof, pane or door that is gone, and a through-hole
 * of {@link RAIN_OPENING_DIAMETER} or more in the roof or a pane, is an opening where the rain falls in. A moving car only turns its rectangles: the shell is read from the damage state apart, when it changes.
 */
import { createFootprintRainCover } from '@adatechnology/game-contracts'
import type { FootprintRainCoverSource, RainCoverFootprint } from '@adatechnology/game-contracts'
import type { Object3D, Vector3 } from '../three-types'

import { cabinBoxOf } from './enclosure'
import type { CabinSource } from './enclosure'
import type { LocalBox } from './model'

/** The widest a through-hole in a roof or pane may be and still keep the rain out: a bullet hole does not let it in, a blast hole does (the same as a house roof). */
export const RAIN_OPENING_DIAMETER = 0.3
/** How far a car has to go (metres) or turn (radians) before the far curtain cuts its cover again; the near rain always follows the live position. */
export const RAIN_MOVE_STEP = 1
export const RAIN_TURN_STEP = 0.08
/** A car tipped over this much (cosine of its tilt from upright) no longer roofs anything. */
const UPRIGHT = 0.7
const GONE = new Set(['broken', 'melted', 'ashes'])
const COVERING_ROLES = new Set(['roof'])
/** What roofs anything: a boat's deck, a bike, a plane's canopy and a tractor keep the sky (a tractor has no cab drawn). */
const COVERED_KINDS = new Set(['car', 'bus', 'truck'])
/** A closed body (a bus, a box truck) draws no roof part: its roof is the top of the side and end panels that reach the vehicle's top. */
const TALL_PANEL = 1.5
const NEAR_TOP = 0.85
const BODY_PANELS = 3
const OPENING_ROLES = new Set(['roof', 'glass'])

type LocalFootprint = { readonly x: number; readonly z: number; readonly halfX: number; readonly halfZ: number; readonly top: number }

export interface VehicleRainCover {
  readonly source: FootprintRainCoverSource
  /** Reads the damage state again (a part broke, a hole opened); call it every half second or after a hit. */
  refreshShell(): void
  /** Puts the cover where the vehicle is now; cheap, call it every frame the vehicle moved. */
  place(): void
}

export interface VehicleRainCoverOptions {
  /** The object the destructible answers in (its `frame` option): the holes of `state()` are in its space. Default `vehicle.root`. */
  readonly frame?: unknown
}

/** The roof of a closed body made of tall panels (no roof part): their span over the top they reach, `null` when the vehicle has fewer than {@link BODY_PANELS} of them left. */
function bodyRoof(source: CabinSource, alive: (id: string) => boolean, kind: string): LocalFootprint | null {
  const top = (source.vehicle.meta as { top?: number }).top
  if (!COVERED_KINDS.has(kind) || top === undefined || source.model.parts.some((def) => COVERING_ROLES.has(def.role))) return null
  const panels = source.model.parts.filter((def) => def.role === 'panel' && def.box.size[1] >= TALL_PANEL && def.box.center[1] + def.box.size[1] / 2 >= top * NEAR_TOP && alive(def.id))
  if (panels.length < BODY_PANELS) return null
  const x0 = Math.min(...panels.map((def) => def.box.center[0] - def.box.size[0] / 2))
  const x1 = Math.max(...panels.map((def) => def.box.center[0] + def.box.size[0] / 2))
  const z1 = Math.max(...panels.map((def) => Math.abs(def.box.center[2]) + def.box.size[2] / 2))
  return { x: (x0 + x1) / 2, z: 0, halfX: (x1 - x0) / 2, halfZ: z1, top: Math.max(...panels.map((def) => def.box.center[1] + def.box.size[1] / 2)) }
}

const hasMoved = (elements: ArrayLike<number>, last: Float64Array): boolean => {
  for (let index = 0; index < 16; index++) if (elements[index] !== last[index]) return true
  return false
}

const localOf = (box: LocalBox, top = box.center[1] + box.size[1] / 2): LocalFootprint => ({ x: box.center[0], z: box.center[2], halfX: box.size[0] / 2, halfZ: box.size[2] / 2, top })

export function createVehicleRainCover(source: CabinSource, options: VehicleRainCoverOptions = {}): VehicleRainCover {
  const vehicle = source.vehicle
  const node = vehicle.vehicle as Object3D | undefined
  const cabin = cabinBoxOf(vehicle)
  const cover = createFootprintRainCover()
  let roofs: LocalFootprint[] = []
  let openings: LocalFootprint[] = []
  let isShellChanged = true
  let bumpedX = Infinity
  let bumpedZ = Infinity
  let bumpedYaw = 0
  const placedAt = new Float64Array(16)
  const refreshShell = (): void => {
    if (!node?.localToWorld) return
    const state = source.state()
    const byId = new Map(state.parts.map((part) => [part.id, part]))
    const mainGroup = state.groups[0] ? new Set(state.groups[0]) : null
    const alive = (id: string): boolean => {
      const part = byId.get(id)
      return part !== undefined && !GONE.has(part.status) && (mainGroup === null || mainGroup.has(id))
    }
    const nextRoofs: LocalFootprint[] = []
    const nextOpenings: LocalFootprint[] = []
    const roofParts = source.model.parts.filter((def) => COVERING_ROLES.has(def.role))
    const kind = String((vehicle.meta as { kind?: string }).kind)
    const hull = bodyRoof(source, alive, kind)
    const hasRoof = COVERED_KINDS.has(kind) && (roofParts.some((def) => alive(def.id)) || hull !== null)
    if (!state.destroyed && hasRoof) {
      if (roofParts.some((def) => alive(def.id))) {
        if (cabin) nextRoofs.push({ x: (cabin.x0 + cabin.x1) / 2, z: 0, halfX: (cabin.x1 - cabin.x0) / 2, halfZ: cabin.z, top: cabin.y0 + (cabin.y1 - cabin.y0) / 2 })
        for (const def of source.model.parts) {
          if (!alive(def.id) || !(COVERING_ROLES.has(def.role) || (cabin && def.role === 'glass'))) continue
          nextRoofs.push(localOf(def.box))
        }
      } else if (hull) {
        nextRoofs.push(hull)
      }
      for (const def of source.model.parts) {
        if (!OPENING_ROLES.has(def.role) || !(cabin || hull || COVERING_ROLES.has(def.role))) continue
        if (!alive(def.id)) nextOpenings.push(localOf(def.box))
      }
      const frame = (options.frame ?? vehicle.root) as { localToWorld?: Object3D['localToWorld']; updateWorldMatrix?: Object3D['updateWorldMatrix'] } | null | undefined
      frame?.updateWorldMatrix?.(true, false)
      node.updateWorldMatrix?.(true, false)
      const inverse = node.matrixWorld.clone().invert()
      const V3 = node.position.constructor as new (x?: number, y?: number, z?: number) => Vector3
      for (const def of source.model.parts) {
        if (!OPENING_ROLES.has(def.role) || !alive(def.id)) continue
        for (const hole of byId.get(def.id)!.holes) {
          if (!hole.through || hole.diameter < RAIN_OPENING_DIAMETER || !frame?.localToWorld) continue
          const point = new V3(hole.point[0], hole.point[1], hole.point[2])
          frame.localToWorld(point)
          point.applyMatrix4(inverse)
          nextOpenings.push({ x: point.x, z: point.z, halfX: hole.diameter / 2, halfZ: hole.diameter / 2, top: 0 })
        }
      }
    }
    roofs = nextRoofs
    openings = nextOpenings
    isShellChanged = true
  }
  const place = (): void => {
    if (!node) return
    node.updateWorldMatrix?.(true, false)
    const e = node.matrixWorld.elements
    // a parked car costs nothing per frame
    if (!isShellChanged && !hasMoved(e, placedAt)) return
    placedAt.set(e)
    const scaleY = Math.hypot(e[4]!, e[5]!, e[6]!)
    if (roofs.length === 0 || e[5]! / (scaleY || 1) < UPRIGHT) {
      if (isShellChanged || bumpedX !== Infinity) cover.set([], [], true)
      bumpedX = Infinity
      isShellChanged = false
      return
    }
    const scaleX = Math.hypot(e[0]!, e[1]!, e[2]!)
    const scaleZ = Math.hypot(e[8]!, e[9]!, e[10]!)
    const yaw = Math.atan2(e[2]!, e[0]!)
    const toWorld = (f: LocalFootprint): RainCoverFootprint => ({
      x: e[0]! * f.x + e[4]! * f.top + e[8]! * f.z + e[12]!,
      z: e[2]! * f.x + e[6]! * f.top + e[10]! * f.z + e[14]!,
      halfX: f.halfX * scaleX,
      halfZ: f.halfZ * scaleZ,
      yaw,
      top: e[1]! * f.x + e[5]! * f.top + e[9]! * f.z + e[13]!,
    })
    const moved = Math.hypot(e[12]! - bumpedX, e[14]! - bumpedZ) >= RAIN_MOVE_STEP || Math.abs(yaw - bumpedYaw) >= RAIN_TURN_STEP
    const isBump = isShellChanged || moved
    cover.set(roofs.map(toWorld), openings.map(toWorld), isBump)
    isShellChanged = false
    if (isBump) {
      bumpedX = e[12]!
      bumpedZ = e[14]!
      bumpedYaw = yaw
    }
  }
  refreshShell()
  return { source: cover, refreshShell, place }
}
