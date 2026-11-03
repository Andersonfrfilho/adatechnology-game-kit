/**
 * The room's side of opening and closing by hand: finds the leaf the eye rests on (a door, a lid, a drawer of furniture or of a vehicle: a part an `open_*` clip of the item moves),
 * asks `createDoorUse` (game-player) how far it goes, tests the sweep of the leaf against what is around before each step and puts the hand on the handle.
 * The leaf is posed along its item's own open clip, so the same opening the item's animation shows is the one the hand drives.
 */
import type * as THREE_NS from 'three'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { AnimationClipSpec, HandTargets, HostReach } from '@adatechnology/game-contracts'
import { createDoorUse, DEFAULT_ARM_REACH, DEFAULT_SHOULDER_HEIGHT, DOOR_USE_DEFAULTS, swingSecondsFor } from '@adatechnology/game-player'
import type { DoorUsePhase, DoorUseRules } from '@adatechnology/game-player'
import { PLAYER_RADIUS } from './player'
import type { Player } from './player'

/** How far the hand reaches a handle, metres from the eye. */
export const DOOR_REACH = 2.2
/** A hit this close to a leaf (the handle, the glass of the door) counts as on the leaf. */
const NEAR_LEAF = 0.25
/** Looking into an open fridge or wardrobe, the open leaf this close to the point is the one E closes. */
const NEAR_OPEN_LEAF = 0.9
const BODY_HEIGHT = 1.8
/** The hand at rest in front of the chest, in the eye's space (x right, y up, -z ahead). */
const HAND_REST: Vec3 = [0.22, -0.42, -0.32]
const SKIN = 0.01
/** How far in from the free edge of a leaf its handle is, metres. */
const HANDLE_INSET = 0.06
/** Where the feet stop in front of a handle (a drawer, a leaf with no hinge known) for the hand to hold it with a bent arm, metres on the floor, and how fast the player steps up. */
const STANDOFF = 0.55
/** A drawer comes out about this far toward the player. */
const DRAWER_TRAVEL = 0.3
/** Standing by a turning leaf: this far past the arc of its free edge, and this far out in front of its face. */
const CLEAR_OF_ARC = 0.3
const OUT_IN_FRONT = 0.42
/** The least a player stands in front of a handle, metres on the floor. */
/** The most the body moves in all pulling one leaf by hand (backing off and edging after the handle), metres: the standoff of the feet plus the clearance past the arc. */
const PULL_TRAVEL = STANDOFF + CLEAR_OF_ARC
const MIN_IN_FRONT = PLAYER_RADIUS + 0.04
/** Without a body that says where its shoulder is: the right shoulder joint is this far to the right of the body's middle, metres (half the shoulder width of the rich body). */
const SHOULDER_SIDE = 0.2
/** Close enough to the place, metres; the longest walk to it before the hand goes anyway, seconds. */
const ARRIVED = 0.05
/** How fast the head turns to the handle (share per second). */
const TURN_RATE = 8
const MAX_WALK_SECONDS = 1.5
const APPROACH_SPEED = 3
/** How far over the floor a leaf swings (the gap under a door). */
const FLOOR_GAP = 0.03

/** A leaf an item can open: the part, and the clip that opens it (the pose at the end of the clip is the leaf open). */
export type RoomLeaf = { readonly part: string; readonly clip: AnimationClipSpec }

export type RoomDoorOptions = {
  readonly THREE: typeof THREE_NS
  readonly player: Player
  readonly world: DestructionWorld
  readonly camera: THREE_NS.Object3D
  readonly arena: { readonly limit: number; readonly colliders: ReadonlyArray<readonly [number, number, number, number]>; readonly ids: ReadonlyArray<string | null> }
  readonly rules?: Partial<DoorUseRules>
  /** The body's right shoulder joint in the body's own frame (x right, y up from the feet, z its front; the arm reach is measured from it); without one `DEFAULT_SHOULDER_HEIGHT` and `SHOULDER_SIDE`. */
  shoulderOffset?(): Vec3 | null
  /** How far the hand holds a palm target from the shoulder (`RoomAvatar.armLength`); without one `DEFAULT_ARM_REACH`. */
  armLength?(): number | null
  /** What the eye rests on within reach, best first (the crosshair, then what the eye faces over the shoulder). */
  pick(): ReadonlyArray<{ readonly objectId: string; readonly part: string; readonly point: Vec3 }>
  /** The leaves of an object (none when it has nothing to open). */
  leaves(objectId: string): readonly RoomLeaf[]
  /** The drawn part of a leaf. */
  objectOf(objectId: string, part: string): THREE_NS.Object3D | null
  /** Poses the leaf at `fraction` of its clip (0 closed, 1 open), drawing and collision both. */
  pose(objectId: string, part: string, clip: AnimationClipSpec, fraction: number): void
  isLocked(objectId: string, part: string): boolean
  nameOf(objectId: string): string
  /** The sound class of what the leaf is made of (`impact_wood`, `impact_metal`...). */
  impactKey(objectId: string, part: string): string
  sound(key: string, point: Vec3, volume: number): void
  onEvent(event: RoomDoorEvent): void
}

export type RoomDoorEventType = 'reach' | 'opened' | 'closed' | 'blocked' | 'locked' | 'stepped_back'

export type RoomDoorEvent = {
  readonly type: RoomDoorEventType
  readonly objectId: string
  readonly part: string
  readonly name: string
  /** How open the leaf is, 0 to 1. */
  readonly opening: number
  /** What stopped it (`blocked`): another object, the wall of the room, the player. */
  readonly by?: string
}

export type RoomDoorState = { readonly objectId: string; readonly part: string; readonly phase: DoorUsePhase; readonly opening: number; readonly goal: 0 | 1 }

export interface RoomDoors {
  readonly active: boolean
  readonly state: RoomDoorState | null
  /** What the body does this frame, for the avatar: the hand height (metres over the feet) and the phase. */
  readonly avatarState: { readonly phase: Exclude<DoorUsePhase, 'idle'>; readonly progress: number; readonly height: number; readonly pull: boolean } | null
  /** Whether the eye rests on a leaf in reach (the prompt). */
  aimed(): { readonly objectId: string; readonly part: string; readonly open: boolean; readonly locked: boolean } | null
  /** Uses the leaf the eye rests on; false when there is none. */
  use(): boolean
  /** Opens or closes a leaf by its ids, as if the hand did it (scenarios). Answers false when the object has no such leaf. */
  useLeaf(objectId: string, part?: string): boolean
  /** How open a leaf is, 0 to 1. */
  opening(objectId: string, part: string): number
  step(dt: number): void
  handTargets(): HandTargets | null
  /** Puts the hand on a leaf a module moves itself (`ModuleHost.reachFor`): reach, grip (`onGrip`), hold it while it moves, let go. */
  reachFor(reach: HostReach): void
  /** Forgets an object (it was removed). */
  forget(objectId: string): void
}

type Using = {
  readonly objectId: string
  readonly leaf: RoomLeaf
  readonly obj: THREE_NS.Object3D
  /** Where the hand holds the leaf, in the leaf's own space. */
  readonly grip: THREE_NS.Vector3
  readonly pull: boolean
  /** Where the grip is with the leaf at its goal. */
  readonly goalAt: THREE_NS.Vector3 | null
  /** How far the body has stepped back pulling this leaf, metres. */
  stepped: number
  /** How far the shoulder was from the handle when the hand took it, metres: the distance the body keeps while pulling. */
  hold: number
  phase: DoorUsePhase
  progress: number
  /** Seconds walked to the handle, and whether the player got there. */
  walked: number
  there: boolean
}

/** Where a leaf that goes away is pushed from: the handle's place when the leaf is at its goal (null: the side the player is on). */
type PushStand = { readonly goalAt: THREE_NS.Vector3 | null }

const key = (objectId: string, part: string): string => `${objectId}\0${part}`

/** Whether a clip slides its part (a drawer) rather than turning it. */
const slides = (clip: AnimationClipSpec, part: string): boolean => {
  const last = clip.keys[clip.keys.length - 1]?.parts?.[part]
  const r = last?.rotation ?? [0, 0, 0]
  return Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 1e-3
}

export function createRoomDoors(options: RoomDoorOptions): RoomDoors {
  const { THREE, player, world, camera, arena } = options
  const control = createDoorUse(options.rules)
  const openings = new Map<string, number>()
  const box = new THREE.Box3()
  const before = new THREE.Box3()
  const tmp = new THREE.Vector3()
  const centre = new THREE.Vector3()
  let using: Using | null = null
  /** A module's own leaf under the hand (a house door). */
  let reaching: { readonly reach: HostReach; phase: Exclude<DoorUsePhase, 'idle'>; time: number; progress: number; walked: number; there: boolean; stepped: number; hold: number } | null = null
  /** Where the hand was the last frame it held or pushed (world), so letting go comes back from there and never from a handle out of reach. */
  const lastHold = new THREE.Vector3()
  const shoulderAt = new THREE.Vector3()
  /** The shoulder in the body's own frame as the body last drew it (the pose barely moves it); the world position follows the player's place and yaw now, never a frame behind. */
  const body = { x: 0, y: 0, z: 0, valid: false }
  const sampleShoulder = (): void => {
    const o = options.shoulderOffset?.()
    body.valid = o !== null && o !== undefined
    if (o) {
      body.x = o[0]
      body.y = o[1]
      body.z = o[2]
    }
  }
  /** The body's shoulder now. */
  const shoulderPoint = (): THREE_NS.Vector3 => {
    const turn = player.yaw + Math.PI
    const x = body.valid ? body.x : -SHOULDER_SIDE
    const y = body.valid ? body.y : DEFAULT_SHOULDER_HEIGHT
    const z = body.valid ? body.z : 0
    // the body is turned to the player's yaw plus pi (its front is +z)
    return shoulderAt.set(player.x + x * Math.cos(turn) + z * Math.sin(turn), player.feet + y, player.z - x * Math.sin(turn) + z * Math.cos(turn))
  }
  /** How far the body's own arm holds a palm target. */
  const armReach = (): number => options.armLength?.() ?? DEFAULT_ARM_REACH
  /** Whether a point is within the arm's reach. */
  const withinReach = (p: THREE_NS.Vector3): boolean => shoulderPoint().distanceTo(p) <= armReach()
  /** How far to the right of the body's middle the shoulder joint is: the body's own, else the default. */
  const shoulderSide = (): number => {
    const s = shoulderPoint()
    return (s.x - player.x) * Math.cos(player.yaw) - (s.z - player.z) * Math.sin(player.yaw)
  }
  /**
   * How far along the floor, on the line from the handle to the body, the body has to move for the shoulder to be `keep` metres from the handle again: positive backs off (the handle came
   * too close), negative goes toward it (the handle swung off to the side), 0 when it is there.
   */
  const retreatFor = (handle: THREE_NS.Vector3, keep: number): number => {
    const hx = player.x - handle.x
    const hz = player.z - handle.z
    const flat = Math.hypot(hx, hz)
    if (flat < 1e-4) return 0
    const shoulder = shoulderPoint()
    const dx = shoulder.x - handle.x
    const dy = shoulder.y - handle.y
    const dz = shoulder.z - handle.z
    const along = (dx * hx + dz * hz) / flat
    return -along + Math.sqrt(Math.max(0, along * along - (dx * dx + dy * dy + dz * dz - keep * keep)))
  }
  /**
   * Pulling a leaf that comes toward the body, the body keeps the distance it took the handle at: it backs off as the handle comes and edges after it as the leaf swings off to the
   * side, as fast as the approach (a module's own leaf: as fast as its handle goes), `PULL_TRAVEL` in all and as far as the floor lets it. `keep` is the distance to hold (the one of the grasp). `held.stepped` is how far it has
   * moved in this use. Answers whether the body moved.
   */
  const stepBack = (held: { stepped: number }, handle: THREE_NS.Vector3, dt: number, keep: number = armReach(), speed: number = APPROACH_SPEED): boolean => {
    const left = PULL_TRAVEL - held.stepped
    const needed = retreatFor(handle, keep)
    if (Math.abs(needed) < 1e-3 || left <= 1e-4) return false
    const dx = player.x - handle.x
    const dz = player.z - handle.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) return false
    const go = Math.sign(needed) * Math.min(Math.abs(needed), left, speed * dt)
    const x0 = player.x
    const z0 = player.z
    player.moveBy((dx / d) * go, (dz / d) * go)
    const moved = Math.hypot(player.x - x0, player.z - z0)
    held.stepped += moved
    return moved > 1e-5
  }

  /** Pulling, a handle just past the arm is still held while the body can catch up with it within a step (and has travel left). */
  const stillHeld = (held: { stepped: number; hold: number }, handle: THREE_NS.Vector3, dt: number, speed: number = APPROACH_SPEED): boolean =>
    withinReach(handle) || (PULL_TRAVEL - held.stepped > 1e-3 && Math.abs(retreatFor(handle, held.hold)) <= speed * dt)

  /**
   * Pulling, the leaf comes only as fast as the body backs off with the hand on the handle: the handle's place after this step is tried, the body retreats from it (as fast as the
   * approach, up to `STANDOFF` in all) to keep the distance it took the handle at, and when it cannot keep up the step is shortened. Answers the share of `dt` the leaf may move; with no
   * way to keep the hand on the handle at all it answers 1 and the hand-off lets go.
   */
  const pacedPull = (u: Using, dt: number): number => {
    const swing = swingSecondsFor(massOf(u.objectId, u.leaf.part), rules)
    const opening = control.opening
    const goal = control.goal
    const capacity = Math.min(APPROACH_SPEED * dt, PULL_TRAVEL - u.stepped)
    if (capacity <= 1e-4) return 1
    for (let share = 1; share > 0.1; share *= 0.5) {
      const next = opening + Math.sign(goal - opening) * Math.min(Math.abs(goal - opening), (dt * share) / swing)
      options.pose(u.objectId, u.leaf.part, u.leaf.clip, next)
      u.obj.updateMatrixWorld(true)
      const handle = u.obj.localToWorld(tmp.copy(u.grip))
      options.pose(u.objectId, u.leaf.part, u.leaf.clip, opening)
      u.obj.updateMatrixWorld(true)
      const need = retreatFor(handle, u.hold)
      if (Math.abs(need) > capacity) continue
      if (Math.abs(need) > 1e-3) {
        const first = u.stepped === 0
        stepBack(u, handle, dt, u.hold)
        if (first && u.stepped > 0) event('stepped_back', u)
      }
      return share
    }
    return 1
  }

  const rules = { ...DOOR_USE_DEFAULTS, ...options.rules }

  /** Where the hand is going or holding now, and how: the leaf in use or the module's leaf. */
  const holding = (): { phase: Exclude<DoorUsePhase, 'idle'>; progress: number; at: THREE_NS.Vector3; pull: boolean; hinge: THREE_NS.Vector3 | null } | null => {
    if (reaching) {
      const h = reaching.reach.handle()
      const hinge = reaching.reach.hinge?.()
      return { phase: reaching.phase, progress: reaching.progress, at: new THREE.Vector3(h[0], h[1], h[2]), pull: reaching.reach.pull ?? true, hinge: hinge ? new THREE.Vector3(hinge[0], hinge[1], hinge[2]) : null }
    }
    if (!using || control.phase === 'idle') return null
    // the hand is back at rest while the leaf finishes on its own
    if (control.phase === 'release' && using.progress >= 1) return null
    using.obj.updateMatrixWorld(true)
    const hinge = slides(using.leaf.clip, using.leaf.part) ? null : using.obj.getWorldPosition(new THREE.Vector3())
    return { phase: control.phase, progress: using.progress, at: using.obj.localToWorld(new THREE.Vector3().copy(using.grip)), pull: using.pull, hinge }
  }
  /** The palm of a shove: the farthest point of the leaf, from the handle back toward the hinge, that the arm reaches; null when none is (the hand goes back to rest). */
  const pushPoint = (handle: THREE_NS.Vector3, hinge: THREE_NS.Vector3 | null): THREE_NS.Vector3 | null => {
    const steps = 12
    for (let i = 0; i <= steps; i++) {
      const p = hinge ? handle.clone().lerp(hinge, (i / steps) * 0.6) : handle
      if (withinReach(p)) return p.clone()
      if (!hinge) return null
    }
    return null
  }
  /**
   * Where the player takes the handle from. A turning leaf: beside its free edge, past the arc it sweeps and a little out in front, on the side the player is on, so the leaf
   * swings by and not into the body (a person opens a fridge standing by the handle side). A drawer or a leaf with no hinge known: straight in front of the handle.
   */
  const standFor = (handle: THREE_NS.Vector3, hinge: THREE_NS.Vector3 | null, slide: boolean, pushed: PushStand | null): [number, number] => {
    if (!hinge || slide) {
      const dx = handle.x - player.x
      const dz = handle.z - player.z
      const d = Math.hypot(dx, dz) || 1
      const off = slide ? STANDOFF + DRAWER_TRAVEL : STANDOFF
      return [handle.x - (dx / d) * off, handle.z - (dz / d) * off]
    }
    let ax = handle.x - hinge.x
    let az = handle.z - hinge.z
    const width = Math.hypot(ax, az)
    if (width < 0.05) return standFor(handle, null, false, pushed)
    ax /= width
    az /= width
    // out of the face, toward the player
    let nx = -az
    let nz = ax
    // a leaf that goes away is pushed from the side it leaves: the one opposite to where its handle is going; else the side the player is on
    const side = pushed?.goalAt ? (handle.x - pushed.goalAt.x) * nx + (handle.z - pushed.goalAt.z) * nz : (player.x - handle.x) * nx + (player.z - handle.z) * nz
    if (side < 0) {
      nx = -nx
      nz = -nz
    }
    // never farther from the handle than the arm reaches (the shoulder sits to the side of the body's middle): a leaf that goes away sweeps clear of the body, so it is pushed from
    // right in front of the handle; one that comes toward the body is taken as near as the arc it sweeps allows
    const shoulderOut = shoulderSide()
    const dropToHandle = Math.abs(shoulderPoint().y - handle.y)
    const inFront = Math.max(MIN_IN_FRONT, Math.sqrt(Math.max(0, armReach() ** 2 - dropToHandle ** 2 - shoulderOut ** 2)) * 0.95)
    let x: number
    let z: number
    if (pushed) {
      // right in front of the handle as far as the arm needs, the right shoulder a shoulder's width in from the body's middle
      x = handle.x + nx * inFront - nz * shoulderOut
      z = handle.z + nz * inFront + nx * shoulderOut
    } else {
      // beside the free edge, clear of the arc the leaf sweeps (it would slam into the body), then as near the handle as the arm needs and that arc allows
      const x0 = hinge.x + ax * (width + CLEAR_OF_ARC) + nx * OUT_IN_FRONT
      const z0 = hinge.z + az * (width + CLEAR_OF_ARC) + nz * OUT_IN_FRONT
      x = x0
      z = z0
      for (let i = 1; i <= 10; i++) {
        if (Math.hypot(x - handle.x, z - handle.z) ** 2 + shoulderOut ** 2 + dropToHandle ** 2 <= armReach() ** 2) break
        const px = x0 + (handle.x - x0) * (i / 10)
        const pz = z0 + (handle.z - z0) * (i / 10)
        if (Math.hypot(px - hinge.x, pz - hinge.z) < width + PLAYER_RADIUS + SKIN * 2) break
        x = px
        z = pz
      }
    }
    // something stands there (the next cabinet, a nightstand): in front of the handle, and the leaf will make the player step back
    return player.canStand(x, z) ? [x, z] : standFor(handle, null, false, pushed)
  }
  /** The head turns to the handle as the player goes for it. */
  const face = (handle: THREE_NS.Vector3, dt: number): void => {
    camera.updateMatrixWorld(true)
    const eye = camera.getWorldPosition(new THREE.Vector3())
    const dx = handle.x - player.x
    const dz = handle.z - player.z
    const flat = Math.hypot(dx, dz)
    if (flat < 0.05) return
    const yaw = Math.atan2(-dx, -dz)
    const pitch = Math.atan2(handle.y - eye.y, flat)
    let dYaw = yaw - player.yaw
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw))
    const k = Math.min(1, dt * TURN_RATE)
    player.setPose([player.x, eye.y, player.z], player.yaw + dYaw * k, player.pitch + (pitch - player.pitch) * k)
  }
  /** The player steps toward where the handle is taken from. Answers true once there, or when nothing more can be gained (in the way, or walking too long). */
  const approach = (handle: THREE_NS.Vector3, hinge: THREE_NS.Vector3 | null, slide: boolean, pushed: PushStand | null, dt: number, walked: number): boolean => {
    const [x, z] = standFor(handle, hinge, slide, pushed)
    const dx = x - player.x
    const dz = z - player.z
    const d = Math.hypot(dx, dz)
    if (d < ARRIVED || walked > MAX_WALK_SECONDS) return true
    const go = Math.min(d, APPROACH_SPEED * dt)
    if (go < 1e-4) return false
    const x0 = player.x
    const z0 = player.z
    player.moveBy((dx / d) * go, (dz / d) * go)
    return Math.hypot(player.x - x0, player.z - z0) < go * 0.2
  }

  const openingOf = (objectId: string, part: string): number => openings.get(key(objectId, part)) ?? 0

  /** Where the last use sent each leaf (`objectId|part`), for the next use to turn it round. */
  const lastGoals = new Map<string, 0 | 1>()

  const leafAt = (objectId: string, part: string, point: Vec3): RoomLeaf | null => {
    const leaves = options.leaves(objectId)
    if (leaves.length === 0) return null
    const exact = leaves.find((l) => l.part === part)
    if (exact) return exact
    // the ray found the handle, a pane or the frame next to the leaf: the closest leaf to the point, if it is close enough;
    // looking into what an open leaf opened (the shelves of an open fridge), the closest open leaf
    let best: RoomLeaf | null = null
    let bestD = NEAR_LEAF
    let open: RoomLeaf | null = null
    let openD = NEAR_OPEN_LEAF
    for (const l of leaves) {
      const obj = options.objectOf(objectId, l.part)
      if (!obj) continue
      box.setFromObject(obj)
      const d = box.distanceToPoint(tmp.set(point[0], point[1], point[2]))
      if (d < bestD) {
        bestD = d
        best = l
      }
      if (openingOf(objectId, l.part) > 0.5 && d < openD) {
        openD = d
        open = l
      }
    }
    return best ?? open
  }

  /** The first thing the eye rests on that has a leaf there. */
  const picked = (): { hit: { objectId: string; part: string; point: Vec3 }; leaf: RoomLeaf } | null => {
    for (const hit of options.pick()) {
      const leaf = leafAt(hit.objectId, hit.part, hit.point)
      if (leaf) return { hit, leaf }
    }
    return null
  }

  const massOf = (objectId: string, part: string): number => world.part(objectId, part)?.mass ?? 10

  const event = (type: RoomDoorEventType, u: Using, by?: string): void =>
    options.onEvent({ type, objectId: u.objectId, part: u.leaf.part, name: options.nameOf(u.objectId), opening: openingOf(u.objectId, u.leaf.part), ...(by ? { by } : {}) })

  const overlaps2d = (b: THREE_NS.Box3, c: readonly [number, number, number, number]): boolean => b.max.x > c[0] && b.min.x < c[2] && b.max.z > c[1] && b.min.z < c[3]

  /** The player's body against the leaf at `b`: the overlap on the floor, or null. */
  const bodyOverlap = (b: THREE_NS.Box3): [number, number] | null => {
    if (b.min.y > player.feet + BODY_HEIGHT || b.max.y < player.feet + 0.05) return null
    const cx = Math.max(b.min.x, Math.min(b.max.x, player.x))
    const cz = Math.max(b.min.z, Math.min(b.max.z, player.z))
    const dx = player.x - cx
    const dz = player.z - cz
    const d = Math.hypot(dx, dz)
    if (d >= PLAYER_RADIUS) return null
    if (d < 1e-4) {
      // the centre is inside the leaf's box: out the shortest way
      const outs: Array<[number, number, number]> = [
        [b.max.x - player.x, 1, 0],
        [player.x - b.min.x, -1, 0],
        [b.max.z - player.z, 0, 1],
        [player.z - b.min.z, 0, -1],
      ]
      outs.sort((a, c) => a[0] - c[0])
      const o = outs[0]!
      return [o[1] * (o[0] + PLAYER_RADIUS), o[2] * (o[0] + PLAYER_RADIUS)]
    }
    const push = PLAYER_RADIUS - d + SKIN
    return [(dx / d) * push, (dz / d) * push]
  }

  /** The player's body against a hinged leaf held by hand, taken as the line from its hinge to its free edge (a leaf seen from above): the overlap on the floor, or null. */
  const leafLineOverlap = (u: Using, b: THREE_NS.Box3): [number, number] | null => {
    if (b.min.y > player.feet + BODY_HEIGHT || b.max.y < player.feet + 0.05) return null
    const hinge = u.obj.getWorldPosition(new THREE.Vector3())
    const grip = u.obj.localToWorld(new THREE.Vector3().copy(u.grip))
    const abx = grip.x - hinge.x
    const abz = grip.z - hinge.z
    const length = Math.hypot(abx, abz) || 1
    // the free edge is a little past the handle
    const reachAlong = (length + HANDLE_INSET) / length
    const tipX = hinge.x + abx * reachAlong - hinge.x
    const tipZ = hinge.z + abz * reachAlong - hinge.z
    const along = Math.max(0, Math.min(1, ((player.x - hinge.x) * tipX + (player.z - hinge.z) * tipZ) / (tipX * tipX + tipZ * tipZ || 1)))
    const dx = player.x - (hinge.x + tipX * along)
    const dz = player.z - (hinge.z + tipZ * along)
    const d = Math.hypot(dx, dz)
    if (d >= PLAYER_RADIUS) return null
    if (d < 1e-4) return bodyOverlap(b)
    const push = PLAYER_RADIUS - d + SKIN
    return [(dx / d) * push, (dz / d) * push]
  }

  /** Can the leaf go from one opening to the other: poses it there and looks at what it would go through. Leaves it where it can be. */
  const isFree = (u: Using, from: number, to: number): boolean => {
    const { objectId, leaf, obj } = u
    obj.updateMatrixWorld(true)
    before.setFromObject(obj)
    options.pose(objectId, leaf.part, leaf.clip, to)
    obj.updateMatrixWorld(true)
    box.setFromObject(obj)
    box.expandByScalar(-SKIN)
    let by: string | null = null
    // the walls and the furniture of the room that stand on the floor (not the object's own footprint)
    if (Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) > arena.limit) by = 'wall'
    else
      for (let i = 0; i < arena.colliders.length; i++) {
        const c = arena.colliders[i]!
        if (arena.ids[i] === objectId) continue
        if (overlaps2d(box, c) && !overlaps2d(before, c)) {
          by = arena.ids[i] ?? 'wall'
          break
        }
      }
    // anything of the destruction world between the two poses
    if (!by) {
      before.getCenter(centre)
      box.getCenter(tmp)
      const dir: Vec3 = [tmp.x - centre.x, tmp.y - centre.y, tmp.z - centre.z]
      const len = Math.hypot(dir[0], dir[1], dir[2])
      // the far edge of a turning leaf moves about twice as far as its middle
      if (len > 1e-5) {
        // a leaf clears the floor it stands over (and what it rests on): only what stands up in its way stops it
        const hit = world.sweepBox({ min: [before.min.x + SKIN, before.min.y + FLOOR_GAP, before.min.z + SKIN], max: [before.max.x - SKIN, before.max.y - SKIN, before.max.z - SKIN] }, dir, len * 2, { ignore: objectId, spacing: 0.12 })
        if (hit && hit.normal[1] < 0.7) by = hit.object
      }
    }
    // the player: steps back out of the way of the leaf, or holds it when there is no room behind
    if (!by) {
      const out = u.pull && u.phase === 'swing' && !slides(leaf.clip, leaf.part) ? leafLineOverlap(u, box) : bodyOverlap(box)
      if (out) {
        const x0 = player.x
        const z0 = player.z
        player.moveBy(out[0], out[1])
        if (Math.hypot(player.x - x0, player.z - z0) < Math.hypot(out[0], out[1]) * 0.5) by = 'player'
        else if (u.phase !== 'swing' || from === 0) event('stepped_back', u)
      }
    }
    if (by) {
      options.pose(objectId, leaf.part, leaf.clip, from)
      const at: Vec3 = [box.getCenter(tmp).x, tmp.y, tmp.z]
      options.sound(options.impactKey(objectId, leaf.part), at, Math.min(0.6, 0.15 + massOf(objectId, leaf.part) * 0.02))
      event('blocked', u, by)
      return false
    }
    return true
  }

  /**
   * Where the hand takes the leaf, in the leaf's own space: a turning leaf by its free edge (the handle side, away from the hinge, at the height the eye was or at a handle's height),
   * a drawer by the middle of its front where the eye was.
   */
  const handleOf = (obj: THREE_NS.Object3D, leaf: RoomLeaf, point: Vec3 | null): THREE_NS.Vector3 => {
    obj.updateMatrixWorld(true)
    box.setFromObject(obj)
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity)
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    for (let i = 0; i < 8; i++) {
      tmp.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      obj.worldToLocal(tmp)
      lo.min(tmp)
      hi.max(tmp)
    }
    const aimed = point ? obj.worldToLocal(new THREE.Vector3(point[0], point[1], point[2])) : lo.clone().add(hi).multiplyScalar(0.5)
    if (!point) {
      // no eye on it (a script): the hand at the height of a handle, about a metre over the feet
      const local = obj.worldToLocal(obj.getWorldPosition(new THREE.Vector3()).setY(player.feet + 1.0))
      aimed.y = local.y
    }
    aimed.clamp(lo, hi)
    if (slides(leaf.clip, leaf.part)) return aimed
    // the hinge is the leaf's own origin; the free edge is the far end of the leaf across the axis it turns about
    const last = leaf.clip.keys[leaf.clip.keys.length - 1]?.parts?.[leaf.part]?.rotation ?? [0, 1, 0]
    const axis = Math.abs(last[0]) >= Math.abs(last[1]) && Math.abs(last[0]) >= Math.abs(last[2]) ? 0 : Math.abs(last[1]) >= Math.abs(last[2]) ? 1 : 2
    const size = [hi.x - lo.x, hi.y - lo.y, hi.z - lo.z]
    const reachOf = (k: number): number => Math.max(Math.abs(lo.getComponent(k)), Math.abs(hi.getComponent(k)))
    let across = -1
    for (let k = 0; k < 3; k++) {
      if (k === axis || size[k]! < Math.min(size[0]!, size[1]!, size[2]!) + 1e-6) continue
      if (across < 0 || reachOf(k) > reachOf(across)) across = k
    }
    if (across < 0) return aimed
    const far = Math.abs(hi.getComponent(across)) >= Math.abs(lo.getComponent(across)) ? hi.getComponent(across) : lo.getComponent(across)
    aimed.setComponent(across, far - Math.sign(far) * Math.min(HANDLE_INSET, size[across]! * 0.25))
    return aimed
  }

  const start = (objectId: string, leaf: RoomLeaf, point: Vec3 | null): boolean => {
    reaching = null
    const obj = options.objectOf(objectId, leaf.part)
    if (!obj) return false
    if (using && (using.objectId !== objectId || using.leaf.part !== leaf.part)) control.cancel()
    obj.updateMatrixWorld(true)
    // the hand goes where the eye was, else to the middle of the free edge of the leaf at the height of a handle
    const grip = handleOf(obj, leaf, point)
    const opening = openingOf(objectId, leaf.part)
    const key = `${objectId}|${leaf.part}`
    const lastGoal = lastGoals.get(key)
    const goal = control.begin({ opening, massKg: massOf(objectId, leaf.part), locked: options.isLocked(objectId, leaf.part), ...(lastGoal !== undefined ? { lastGoal } : {}) })
    if (goal !== null) lastGoals.set(key, goal)
    // a leaf that comes toward the body is pulled, one that goes away is pushed: compare the leaf open and closed with where the player stands
    let pull = true
    let goalAt: THREE_NS.Vector3 | null = null
    if (goal !== null) {
      obj.updateMatrixWorld(true)
      options.pose(objectId, leaf.part, leaf.clip, 1)
      obj.updateMatrixWorld(true)
      const openAt = obj.localToWorld(grip.clone())
      options.pose(objectId, leaf.part, leaf.clip, 0)
      obj.updateMatrixWorld(true)
      const shutAt = obj.localToWorld(grip.clone())
      options.pose(objectId, leaf.part, leaf.clip, opening)
      const dOpen = Math.hypot(openAt.x - player.x, openAt.z - player.z)
      const dShut = Math.hypot(shutAt.x - player.x, shutAt.z - player.z)
      pull = goal === 1 ? dOpen <= dShut : dShut <= dOpen
      goalAt = goal === 1 ? openAt : shutAt
    }
    using = { objectId, leaf, obj, grip, pull, goalAt, stepped: 0, hold: 0, phase: control.phase, progress: 0, walked: 0, there: goal === null }
    const at = obj.localToWorld(grip.clone())
    if (goal === null) {
      options.sound('leaf_rattle', [at.x, at.y, at.z], 0.6)
      event('locked', using)
    } else event('reach', using)
    return true
  }

  return {
    get active() {
      return reaching !== null || (using !== null && control.phase !== 'idle')
    },
    get state() {
      return using ? { objectId: using.objectId, part: using.leaf.part, phase: control.phase, opening: openingOf(using.objectId, using.leaf.part), goal: control.goal } : null
    },
    get avatarState() {
      const h = holding()
      return h ? { phase: h.phase, progress: h.progress, height: h.at.y - player.feet, pull: h.pull } : null
    },
    aimed() {
      const found = picked()
      if (!found) return null
      const { hit, leaf } = found
      return { objectId: hit.objectId, part: leaf.part, open: openingOf(hit.objectId, leaf.part) > 0.5, locked: options.isLocked(hit.objectId, leaf.part) }
    },
    use() {
      const found = picked()
      return found ? start(found.hit.objectId, found.leaf, found.hit.point) : false
    },
    useLeaf(objectId, part) {
      const leaves = options.leaves(objectId)
      const leaf = part === undefined ? leaves[0] : leaves.find((l) => l.part === part)
      return leaf ? start(objectId, leaf, null) : false
    },
    opening: openingOf,
    step(dt) {
      sampleShoulder()
      const r = reaching
      if (r) {
        r.time += dt
        if (r.phase === 'reach' && !r.there) {
          const h = r.reach.handle()
          const hinge = r.reach.hinge?.()
          r.walked += dt
          const g = new THREE.Vector3(h[0], h[1], h[2])
          r.there = approach(g, hinge ? new THREE.Vector3(hinge[0], hinge[1], hinge[2]) : null, false, r.reach.pull === false ? { goalAt: null } : null, dt, r.walked)
          face(g, dt)
          if (r.there) r.time = 0
        } else if (r.phase === 'reach') {
          r.progress = Math.min(1, r.time / rules.reachSeconds)
          const grasp = r.reach.handle()
          r.hold = Math.min(armReach(), shoulderPoint().distanceTo(tmp.set(grasp[0], grasp[1], grasp[2])))
          if (r.progress >= 1) {
            r.reach.onGrip?.()
            r.phase = r.reach.locked ? 'rattle' : 'swing'
            r.time = 0
            r.progress = 0
          }
        } else if (r.phase === 'swing' || r.phase === 'rattle') {
          r.progress = Math.min(1, r.time / (r.phase === 'rattle' ? rules.rattleSeconds : Math.max(0.05, r.reach.seconds)))
          const h = r.reach.handle()
          if (r.phase === 'swing' && r.reach.pull !== false) stepBack(r, tmp.set(h[0], h[1], h[2]), dt, r.hold, Infinity)
          if (r.phase === 'swing' && !(r.reach.pull === false ? withinReach(tmp.set(h[0], h[1], h[2])) : stillHeld(r, tmp.set(h[0], h[1], h[2]), dt, Infinity))) {
            r.phase = r.reach.pull === false ? 'push' : 'release'
            r.time = 0
            r.progress = 0
          } else if (r.progress >= 1) {
            r.phase = 'release'
            r.time = 0
            r.progress = 0
          }
        } else if (r.phase === 'push') {
          r.progress = Math.min(1, r.time / rules.pushSeconds)
          if (r.progress >= 1) {
            r.phase = 'release'
            r.time = 0
            r.progress = 0
          }
        } else {
          r.progress = Math.min(1, r.time / rules.releaseSeconds)
          if (r.progress >= 1) reaching = null
        }
        return
      }
      const u = using
      if (!u || control.phase === 'idle') return
      const was = openingOf(u.objectId, u.leaf.part)
      const wasPhase = control.phase
      // the player walks to the handle first; the hand goes out once there
      if (wasPhase === 'reach' && !u.there) {
        u.obj.updateMatrixWorld(true)
        u.walked += dt
        const g = u.obj.localToWorld(new THREE.Vector3().copy(u.grip))
        u.there = approach(g, u.obj.getWorldPosition(new THREE.Vector3()), slides(u.leaf.clip, u.leaf.part), u.pull ? null : { goalAt: u.goalAt }, dt, u.walked)
        face(g, dt)
        if (!u.there) return
      }
      if (u.pull && wasPhase === 'reach') u.hold = Math.min(armReach(), shoulderPoint().distanceTo(u.obj.localToWorld(tmp.copy(u.grip))))
      // pulling, the body keeps the distance it took the handle at, and the leaf comes only as fast as it can
      const pace = u.pull && wasPhase === 'swing' ? pacedPull(u, dt) : 1
      const s = control.step(dt * pace, (from, to) => isFree(u, from, to), {
        pull: u.pull,
        reaches: () => {
          u.obj.updateMatrixWorld(true)
          const handle = u.obj.localToWorld(tmp.copy(u.grip))
          return u.pull ? stillHeld(u, handle, dt) : withinReach(handle)
        },
      })
      u.phase = s.phase
      u.progress = s.progress
      openings.set(key(u.objectId, u.leaf.part), s.opening)
      u.obj.updateMatrixWorld(true)
      const at = u.obj.localToWorld(tmp.copy(u.grip))
      const point: Vec3 = [at.x, at.y, at.z]
      const slide = slides(u.leaf.clip, u.leaf.part)
      const shut = options.impactKey(u.objectId, u.leaf.part).replace('impact_', 'leaf_shut_')
      // the latch gives as the leaf leaves the frame, the hinge sounds while it turns, the leaf meets the frame closing
      if (wasPhase === 'reach' && s.phase !== 'reach') {
        if (slide) options.sound('leaf_slide', point, 0.5)
        else {
          if (was < 0.02) options.sound('leaf_latch', point, 0.5)
          options.sound(/metal|glass/.test(shut) ? 'leaf_creak_metal' : 'leaf_creak_wood', point, 0.35)
        }
      }
      if (s.arrived) {
        if (s.opening <= 0) {
          options.sound(slide ? 'leaf_slide' : shut, point, Math.min(1, 0.3 + massOf(u.objectId, u.leaf.part) * 0.03))
          event('closed', u)
        } else event('opened', u)
      }
      if (s.phase === 'idle') using = null
    },
    handTargets() {
      const h = holding()
      if (!h || (h.phase === 'rattle' && h.progress > 0.92)) return null
      const { phase, progress } = h
      let at = h.at
      // the rattle shakes the handle under the hand
      if (phase === 'rattle') at.y += Math.sin(progress * 60) * 0.012
      // a shove puts the palm on the leaf, as far from the handle as the arm needs to reach it
      const shove = phase === 'push' ? pushPoint(at, h.hinge) : null
      if (shove) at = shove
      camera.updateMatrixWorld(true)
      const rest = camera.localToWorld(new THREE.Vector3(HAND_REST[0], HAND_REST[1], HAND_REST[2]))
      // reach: the hand travels to the handle; release: back to the chest from where it was (a handle out of reach is never the way back)
      const k = phase === 'reach' ? progress : phase === 'release' ? 1 - progress : phase === 'push' && !shove ? 0 : 1
      const ease = k * k * (3 - 2 * k)
      const pos = phase === 'release' ? rest.lerp(lastHold, ease) : rest.lerp(at, ease)
      // the palm never goes past the arm: a handle out of reach (the player could not get near it) leaves the hand at the end of the arm, not stretched after it
      const shoulder = shoulderPoint()
      const stretch = pos.distanceTo(shoulder)
      if (stretch > armReach()) pos.sub(shoulder).multiplyScalar(armReach() / stretch).add(shoulder)
      if (phase !== 'release') lastHold.copy(pos)
      // a hand round a vertical handle: fingers away from the player, thumb up (HandPose of game-contracts: +x to the knuckles, +z to the little finger)
      const way = new THREE.Vector3(at.x - player.x, 0, at.z - player.z)
      if (way.lengthSq() < 1e-6) way.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
      way.normalize()
      const down = new THREE.Vector3(0, -1, 0)
      const back = new THREE.Vector3().crossVectors(down, way)
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(way, back, down))
      const grip = phase === 'reach' ? 0.15 + 0.75 * progress : phase === 'release' ? 0.9 * (1 - progress) : phase === 'push' ? 0.9 - 0.6 * progress : 0.9
      return { R: { position: [pos.x, pos.y, pos.z], quaternion: [q.x, q.y, q.z, q.w] }, L: null, grip }
    },
    reachFor(reach) {
      if (using) {
        control.cancel()
        using = null
      }
      reaching = { reach, phase: 'reach', time: 0, progress: 0, walked: 0, there: false, stepped: 0, hold: 0 }
    },
    forget(objectId) {
      for (const k of [...openings.keys()]) if (k.startsWith(`${objectId}\0`)) openings.delete(k)
      if (using?.objectId === objectId) {
        control.cancel()
        using = null
      }
    },
  }
}
