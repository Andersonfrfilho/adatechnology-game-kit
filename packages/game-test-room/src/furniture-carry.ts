/**
 * A piece of furniture on the move, whoever pushes it (the player, the agents of a module): its box, its mass with what rests on its top, the test of each step against
 * the world, the walls of the arena and the blockers of the modules, and the move itself, which carries along what rests on it. What rests on it rides while the piece
 * changes speed slower than the friction under it can follow (`slipsOnTop` of game-player), and slides on with the speed it had when the piece stops at once.
 */
import type * as THREE_NS from 'three'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from '@adatechnology/game-destruction-three'
import { frictionFor, slipsOnTop } from '@adatechnology/game-player'
import type { FurniturePushRules } from '@adatechnology/game-player'

const FLOOR_CLEARANCE = 0.06
const SWEEP_SKIN = 0.015
/** The sweep stops this far under the top: what rests on the top is carried, it is not in the way. */
const TOP_CLEARANCE = 0.03
const DRAG_GRAIN_METRES = 0.3

export type RoomPushTarget = {
  readonly objectId: string
  readonly root: THREE_NS.Object3D
  readonly name: string
  /** The body it already has, or null when it stands free and only becomes one when it moves. */
  readonly piece: Piece | null
}

/** A loose thing resting on the top of a piece that is pushed (`RoomPushOptions.riders`). */
export type RoomPushRider = {
  readonly objectId: string
  readonly root: THREE_NS.Object3D
  readonly piece: Piece | null
  readonly massKg: number
  readonly material: string | undefined
}

export type Rider = RoomPushRider & { piece: Piece | null; readonly friction: number }

export type Carry = {
  readonly target: RoomPushTarget
  /** The piece and what rides on it. */
  readonly massKg: number
  readonly material: string | undefined
  piece: Piece | null
  readonly min: [number, number, number]
  readonly max: [number, number, number]
  riders: Rider[]
}

export type CarryHost = {
  readonly THREE: typeof THREE_NS
  readonly world: DestructionWorld
  readonly arena: { readonly limit: number; readonly colliders: ReadonlyArray<readonly [number, number, number, number]> }
  readonly blockers: ReadonlySet<(x: number, z: number, radius: number) => boolean>
  readonly rules: FurniturePushRules
  massOf(objectId: string): number
  materialOf(objectId: string): string | undefined
  /** The loose things resting on the top of the box of `objectId`. */
  riders?(objectId: string, box: { readonly min: Vec3; readonly max: Vec3 }): readonly RoomPushRider[]
  /** Turns a free-standing object into a body (the first step it takes, and each thing riding on it). */
  makePiece(objectId: string): Piece
  dragSound(objectId: string, point: Vec3, volume: number): void
  /** The piece (or a thing riding on it) moved by `(dx, dz)`: what the host keeps with it (a liquid spilled on its top) goes along. */
  moved?(objectId: string, dx: number, dz: number): void
  /** A stretch of drag (`DRAG_GRAIN_METRES` or more) along `(ux, uz)`, the base's box where it ended: the host marks the floor under it. */
  dragged?(objectId: string, drag: CarryDrag): void
}

export type CarryDrag = { readonly min: Vec3; readonly max: Vec3; readonly ux: number; readonly uz: number; readonly length: number }

export function createCarry(host: CarryHost, target: RoomPushTarget): Carry {
  const box3 = new host.THREE.Box3().setFromObject(target.root)
  const min: [number, number, number] = [box3.min.x, box3.min.y, box3.min.z]
  const max: [number, number, number] = [box3.max.x, box3.max.y, box3.max.z]
  const riders = (host.riders?.(target.objectId, { min, max }) ?? []).map((r) => ({ ...r, friction: frictionFor(r.material, host.rules) }))
  const massKg = host.massOf(target.objectId) + riders.reduce((sum, r) => sum + r.massKg, 0)
  return { target, massKg, material: host.materialOf(target.objectId), piece: target.piece, min, max, riders }
}

/** The piece becomes a body held by whoever moves it, and so does each thing riding on it (held, the sweeps and the player's collision no longer see them in the way). */
export function holdCarry(host: CarryHost, carry: Carry): void {
  carry.piece ??= host.makePiece(carry.target.objectId)
  carry.piece.held = true
  carry.piece.carrying = true
  for (const r of carry.riders) {
    r.piece ??= host.makePiece(r.objectId)
    r.piece.held = true
  }
}

const letGo = (piece: Piece | null, velocity: readonly [number, number]): void => {
  if (!piece) return
  piece.held = false
  piece.carrying = false
  piece.sleeping = false
  piece.velocity = [velocity[0], 0, velocity[1]]
}

/** Lets go of the piece and of what rides on it; a rider keeps `velocity` when the stop is too sudden for the friction under it (`stopMps2`), and slides on. */
export function releaseCarry(carry: Carry, velocity: readonly [number, number] = [0, 0], stopMps2 = 0): void {
  letGo(carry.piece, [0, 0])
  for (const r of carry.riders) letGo(r.piece, slipsOnTop(stopMps2, r.friction) ? velocity : [0, 0])
  carry.riders = []
}

/** The riders the piece's change of speed throws off: they go free with the speed the piece had, the rest ride on. */
export function shakeRiders(carry: Carry, before: readonly [number, number], acceleration: number): void {
  if (carry.riders.length === 0) return
  const kept: Rider[] = []
  for (const r of carry.riders) {
    if (slipsOnTop(acceleration, r.friction)) letGo(r.piece, before)
    else kept.push(r)
  }
  carry.riders = kept
}

/** What stops a piece that is not an object of the world: the edge of the arena, its walls, a module's blocker. */
export const CARRY_WALL = Symbol('wall')

/**
 * What is in the way of the box of the piece moved by `(dx, dz)`: null when it fits, `CARRY_WALL` for the arena (its edge, its walls, the modules' blockers), or
 * the id of the object of the world it would run into. `ignore` names the pieces that move with it (a row being pushed).
 */
export function carryBlocker(host: CarryHost, carry: Carry, dx: number, dz: number, ignore: readonly string[] = [carry.target.objectId]): string | typeof CARRY_WALL | null {
  const minX = carry.min[0] + dx
  const maxX = carry.max[0] + dx
  const minZ = carry.min[2] + dz
  const maxZ = carry.max[2] + dz
  const limit = host.arena.limit
  if (Math.max(Math.abs(minX), Math.abs(maxX)) > limit || Math.max(Math.abs(minZ), Math.abs(maxZ)) > limit) return CARRY_WALL
  for (const c of host.arena.colliders) {
    // what the piece already stands in does not hold it: it can always back out
    if (carry.max[0] > c[0] && carry.min[0] < c[2] && carry.max[2] > c[1] && carry.min[2] < c[3]) continue
    if (maxX > c[0] && minX < c[2] && maxZ > c[1] && minZ < c[3]) return CARRY_WALL
  }
  if (host.blockers.size > 0) {
    const midX = (minX + maxX) / 2
    const midZ = (minZ + maxZ) / 2
    for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ], [midX, minZ], [midX, maxZ], [minX, midZ], [maxX, midZ]] as const) {
      for (const isBlocked of host.blockers) if (isBlocked(x, z, 0)) return CARRY_WALL
    }
  }
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-6) return null
  const box = { min: [carry.min[0], carry.min[1] + FLOOR_CLEARANCE, carry.min[2]] as Vec3, max: [carry.max[0], Math.max(carry.min[1] + FLOOR_CLEARANCE, carry.max[1] - TOP_CLEARANCE), carry.max[2]] as Vec3 }
  return host.world.sweepBox(box, [dx / distance, 0, dz / distance], distance + SWEEP_SKIN, { ignore })?.object ?? null
}

/** Whether the box of the piece fits at its place moved by `(dx, dz)`: inside the arena, out of its walls and of the modules' blockers, nothing of the world on the way. */
export const carryFits = (host: CarryHost, carry: Carry, dx: number, dz: number): boolean => carryBlocker(host, carry, dx, dz) === null

/** Moves the piece and what rides on it; a scrape on the floor every `DRAG_GRAIN_METRES`. Answers the dragged metres not yet sounded. */
export function moveCarry(host: CarryHost, carry: Carry, dx: number, dz: number, dragged: number): number {
  for (const { objectId, root } of [carry.target, ...carry.riders]) {
    root.position.x += dx
    root.position.z += dz
    root.updateMatrixWorld(true)
    host.moved?.(objectId, dx, dz)
  }
  carry.min[0] += dx
  carry.max[0] += dx
  carry.min[2] += dz
  carry.max[2] += dz
  const total = dragged + Math.hypot(dx, dz)
  if (total < DRAG_GRAIN_METRES) return total
  host.dragSound(carry.target.objectId, [(carry.min[0] + carry.max[0]) / 2, carry.min[1], (carry.min[2] + carry.max[2]) / 2], 0.3 + 0.5 * Math.min(1, carry.massKg / 100))
  const step = Math.hypot(dx, dz)
  if (step > 1e-6) host.dragged?.(carry.target.objectId, { min: [...carry.min], max: [...carry.max], ux: dx / step, uz: dz / step, length: total })
  return 0
}
