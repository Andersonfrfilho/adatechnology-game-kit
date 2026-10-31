/**
 * The room's side of pushing furniture: finds what the player leans on, asks `createFurniturePush` (game-player) how it goes, tests the volume of the piece before each
 * step (the world, the walls of the arena, the blockers of the modules) and moves it with the player. The animations read `avatarState` and `handTargets`.
 */
import type * as THREE_NS from 'three'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from '@adatechnology/game-destruction-three'
import type { HandTargets } from '@adatechnology/game-contracts'
import { createFurniturePush } from '@adatechnology/game-player'
import type { FurniturePushBlock, FurniturePushPhase, FurniturePushRules } from '@adatechnology/game-player'
import type { Player } from './player'

/** How close to the piece the player must be to lean on it, metres from the feet to its box. */
export const PUSH_REACH = 1.1
/** Where the player ends up from the face, for the arms to be straight but not stretched. */
const STANDOFF = 0.58
/** Lower than this the hands go on top of the piece and the player bends over it, closer. */
const LOW_TOP = 0.95
const LOW_STANDOFF = 0.42
const LOW_HAND_ON_TOP = 0.07
/** How far above the top of a low piece the eye stays, and the most the player bends. */
const LOW_EYE_OVER_TOP = 0.62
const MAX_BEND = 0.8
const STANDING_EYE = 1.7
const APPROACH_SPEED = 1.2
/** A piece whose base is higher than this is on something, not on the floor. */
const MAX_BASE_HEIGHT = 0.12
const FLOOR_CLEARANCE = 0.06
const SWEEP_SKIN = 0.015
/** Hands: half the gap between them, the highest they go, how far under the top of the piece. */
const HAND_SPREAD = 0.2
const HAND_TOP = 1.35
const HAND_UNDER_TOP = 0.05
const LOOK_RANGE = 0.9
const DRAG_GRAIN_METRES = 0.3
const RING_DELAY_S = 0.1

export type RoomPushTarget = {
  readonly objectId: string
  readonly root: THREE_NS.Object3D
  readonly name: string
  /** The body it already has, or null when it stands free and only becomes one when it moves. */
  readonly piece: Piece | null
}

export type RoomPushOptions = {
  readonly THREE: typeof THREE_NS
  readonly player: Player
  readonly world: DestructionWorld
  readonly arena: { readonly limit: number; readonly colliders: ReadonlyArray<readonly [number, number, number, number]> }
  readonly blockers: ReadonlySet<(x: number, z: number, radius: number) => boolean>
  readonly rules?: Partial<FurniturePushRules>
  /** What the eye rests on and could be pushed, or null. */
  pick(): RoomPushTarget | null
  massOf(objectId: string): number
  materialOf(objectId: string): string | undefined
  /** Turns a free-standing object into a body (the first step it takes). */
  makePiece(objectId: string): Piece
  dragSound(objectId: string, point: Vec3, volume: number): void
  hitSound(objectId: string, point: Vec3): void
  onEvent(event: RoomPushEvent): void
  ring(value: number | null): void
  /** The room draws a body whose pose bends over a low piece: the player's own eye is not lowered (without a body the eye is the camera and bends). */
  hasBody?(): boolean
}

export type RoomPushEvent =
  | { readonly type: 'grip' | 'release'; readonly objectId: string; readonly name: string; readonly massKg: number }
  | { readonly type: 'engaged' | 'too_heavy' | 'obstacle'; readonly objectId: string; readonly name: string; readonly massKg: number }

export type RoomPushState = {
  readonly objectId: string
  readonly phase: FurniturePushPhase
  readonly progress: number
  readonly block: FurniturePushBlock
  readonly massKg: number
}

export interface RoomPush {
  readonly active: boolean
  readonly state: RoomPushState | null
  /** What the body does this frame, for the avatar. */
  /** The piece is low: the body bends over it. */
  readonly isBent: boolean
  readonly avatarState: { readonly phase: Exclude<FurniturePushPhase, 'idle'>; readonly progress: number } | null
  /** Starts leaning on what the eye rests on; false when there is nothing to lean on. */
  begin(): boolean
  /** Lets go. Answers true when the press was short enough to be a tap (the room then grabs). */
  end(): boolean
  /** Scripted walk (scenarios), world `[x, z]`; null gives the walk back to the keys. */
  setWalk(walk: readonly [number, number] | null): void
  step(dt: number): void
  handTargets(): HandTargets | null
}

type Leaning = {
  readonly target: RoomPushTarget
  readonly massKg: number
  piece: Piece | null
  readonly min: [number, number, number]
  readonly max: [number, number, number]
  /** The point of the near face the hands go to, and the way into the face (unit, on the floor). */
  readonly contact: [number, number]
  readonly into: [number, number]
  readonly isLow: boolean
  readonly palm: [number, number, number, number]
}

/** The closest point of a box (on the floor plane) to a point; the way in when the point is inside the box is the way the player faces. */
function contactOf(box: { min: readonly number[]; max: readonly number[] }, player: Player): { contact: [number, number]; into: [number, number]; distance: number } {
  const x = Math.max(box.min[0] ?? 0, Math.min(box.max[0] ?? 0, player.x))
  const z = Math.max(box.min[2] ?? 0, Math.min(box.max[2] ?? 0, player.z))
  const dx = x - player.x
  const dz = z - player.z
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-3) return { contact: [x, z], into: [-Math.sin(player.yaw), -Math.cos(player.yaw)], distance: 0 }
  return { contact: [x, z], into: [dx / distance, dz / distance], distance }
}

export function createRoomPush(options: RoomPushOptions): RoomPush {
  const { THREE, player, world, arena, blockers } = options
  const control = createFurniturePush(options.rules)
  const box3 = new THREE.Box3()
  let leaning: Leaning | null = null
  let scriptedWalk: readonly [number, number] | null = null
  let dragged = 0

  const event = (type: RoomPushEvent['type'], lean: Leaning): void => options.onEvent({ type, objectId: lean.target.objectId, name: lean.target.name, massKg: lean.massKg })

  const standsClear = (lean: Leaning, dx: number, dz: number): boolean => {
    const minX = lean.min[0] + dx
    const maxX = lean.max[0] + dx
    const minZ = lean.min[2] + dz
    const maxZ = lean.max[2] + dz
    if (Math.max(Math.abs(minX), Math.abs(maxX)) > arena.limit || Math.max(Math.abs(minZ), Math.abs(maxZ)) > arena.limit) return false
    for (const c of arena.colliders) {
      // what the piece already stands in does not hold it: it can always back out
      if (lean.max[0] > c[0] && lean.min[0] < c[2] && lean.max[2] > c[1] && lean.min[2] < c[3]) continue
      if (maxX > c[0] && minX < c[2] && maxZ > c[1] && minZ < c[3]) return false
    }
    if (blockers.size === 0) return true
    const midX = (minX + maxX) / 2
    const midZ = (minZ + maxZ) / 2
    for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ], [midX, minZ], [midX, maxZ], [minX, midZ], [maxX, midZ]] as const) {
      for (const isBlocked of blockers) if (isBlocked(x, z, 0)) return false
    }
    return true
  }

  const isFree = (lean: Leaning, dx: number, dz: number): boolean => {
    if (!standsClear(lean, dx, dz) || !player.canStand(player.x + dx, player.z + dz)) return false
    const distance = Math.hypot(dx, dz)
    const box = { min: [lean.min[0], lean.min[1] + FLOOR_CLEARANCE, lean.min[2]] as Vec3, max: [lean.max[0], lean.max[1], lean.max[2]] as Vec3 }
    return world.sweepBox(box, [dx / distance, 0, dz / distance], distance + SWEEP_SKIN, { ignore: lean.target.objectId }) === null
  }

  const release = (): void => {
    const lean = leaning
    if (!lean) return
    leaning = null
    if (lean.piece) {
      lean.piece.held = false
      lean.piece.sleeping = false
      lean.piece.velocity = [0, 0, 0]
    }
    control.release()
    player.setWalkHeld(false)
    if (!options.hasBody?.()) player.setBend(0)
    player.setLookLimit(null)
    options.ring(null)
    event('release', lean)
  }

  const approach = (lean: Leaning, dt: number): void => {
    const off = Math.hypot(lean.contact[0] - player.x, lean.contact[1] - player.z) - (lean.isLow ? LOW_STANDOFF : STANDOFF)
    const move = Math.sign(off) * Math.min(Math.abs(off), APPROACH_SPEED * dt)
    if (move !== 0) player.moveBy(lean.into[0] * move, lean.into[1] * move)
  }

  const moveWith = (lean: Leaning, dx: number, dz: number): void => {
    lean.target.root.position.x += dx
    lean.target.root.position.z += dz
    lean.target.root.updateMatrixWorld(true)
    player.moveBy(dx, dz)
    lean.min[0] += dx
    lean.max[0] += dx
    lean.min[2] += dz
    lean.max[2] += dz
    lean.contact[0] += dx
    lean.contact[1] += dz
    dragged += Math.hypot(dx, dz)
    if (dragged < DRAG_GRAIN_METRES) return
    dragged = 0
    options.dragSound(lean.target.objectId, [lean.contact[0], lean.min[1], lean.contact[1]], 0.3 + 0.5 * Math.min(1, lean.massKg / 100))
  }

  return {
    get active() {
      return leaning !== null
    },
    get state() {
      return leaning ? { objectId: leaning.target.objectId, phase: control.phase, progress: control.progress, block: control.block, massKg: leaning.massKg } : null
    },
    get isBent() {
      return leaning?.isLow ?? false
    },
    get avatarState() {
      return leaning && control.phase !== 'idle' ? { phase: control.phase, progress: control.progress } : null
    },
    begin() {
      if (leaning) return true
      const target = options.pick()
      if (!target || !world.has(target.objectId)) return false
      box3.setFromObject(target.root)
      if (box3.min.y > player.feet + MAX_BASE_HEIGHT) return false
      const min: [number, number, number] = [box3.min.x, box3.min.y, box3.min.z]
      const max: [number, number, number] = [box3.max.x, box3.max.y, box3.max.z]
      const { contact, into, distance } = contactOf({ min, max }, player)
      if (distance > PUSH_REACH) return false
      const massKg = options.massOf(target.objectId)
      const material = options.materialOf(target.objectId)
      const isLow = max[1] - player.feet < LOW_TOP
      // the palms lie flat on the face that takes the push (HandPose of game-contracts): on a tall piece fingers up and backs to the player, on a low one fingers ahead and backs up
      const side = new THREE.Vector3(-into[1], 0, into[0])
      const way = new THREE.Vector3(into[0], 0, into[1])
      const up = new THREE.Vector3(0, 1, 0)
      const basis = isLow ? new THREE.Matrix4().makeBasis(way, up, side) : new THREE.Matrix4().makeBasis(up, way.clone().negate(), side)
      const palm = new THREE.Quaternion().setFromRotationMatrix(basis)
      leaning = { target, massKg, piece: target.piece, min, max, contact, into, isLow, palm: [palm.x, palm.y, palm.z, palm.w] }
      if (target.piece) target.piece.held = true
      control.begin(material === undefined ? { massKg } : { massKg, material })
      dragged = 0
      player.setWalkHeld(true)
      if (isLow && !options.hasBody?.()) player.setBend(Math.min(MAX_BEND, Math.max(0, STANDING_EYE - (max[1] - player.feet + LOW_EYE_OVER_TOP))))
      player.setLookLimit({ yaw: Math.atan2(-into[0], -into[1]), range: LOOK_RANGE })
      event('grip', leaning)
      return true
    },
    end() {
      if (!leaning) return false
      const tap = control.isTap
      release()
      return tap
    },
    setWalk(walk) {
      scriptedWalk = walk
    },
    step(dt) {
      const lean = leaning
      if (!lean) return
      if (!world.has(lean.target.objectId)) {
        release()
        return
      }
      const gripping = control.phase === 'grip'
      if (gripping) approach(lean, dt)
      const result = control.update(dt, { walk: scriptedWalk ?? player.walkIntent, isFree: (dx, dz) => isFree(lean, dx, dz) })
      if (result.engaged) {
        // a body from here on: held, the room's collision of the player and of this sweep no longer sees it as something in the way
        if (control.block !== 'too_heavy') {
          lean.piece ??= options.makePiece(lean.target.objectId)
          lean.piece.held = true
        }
        event(control.block === 'too_heavy' ? 'too_heavy' : 'engaged', lean)
      }
      if (result.hitObstacle) {
        options.hitSound(lean.target.objectId, [lean.contact[0], lean.min[1] + 0.3, lean.contact[1]])
        event('obstacle', lean)
      }
      if (result.dx !== 0 || result.dz !== 0) moveWith(lean, result.dx, result.dz)
      options.ring(control.phase === 'grip' && control.heldSeconds >= RING_DELAY_S ? control.progress : null)
    },
    handTargets() {
      const lean = leaning
      if (!lean) return null
      const strain = control.phase === 'strain'
      const y = lean.isLow ? lean.max[1] + 0.01 : Math.min(HAND_TOP, lean.max[1] - HAND_UNDER_TOP)
      // the arms give a little under the effort, and shake
      const shake = strain ? Math.sin(performance.now() * 0.045) * 0.006 : 0
      const inset = lean.isLow ? -LOW_HAND_ON_TOP + shake : (strain ? 0.05 : 0.02) + shake
      const px = lean.contact[0] - lean.into[0] * inset
      const pz = lean.contact[1] - lean.into[1] * inset
      const sideX = -lean.into[1] * HAND_SPREAD
      const sideZ = lean.into[0] * HAND_SPREAD
      const grip = 0.05 + 0.2 * control.progress
      return {
        R: { position: [px + sideX, y, pz + sideZ], quaternion: lean.palm },
        L: { position: [px - sideX, y, pz - sideZ], quaternion: lean.palm },
        grip,
        gripL: grip,
      }
    },
  }
}
