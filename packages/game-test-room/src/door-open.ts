/**
 * The room's side of opening and closing by hand: finds the leaf the eye rests on (a door, a lid, a drawer of furniture or of a vehicle: a part an `open_*` clip of the item moves),
 * asks `createDoorUse` (game-player) how far it goes, tests the sweep of the leaf against what is around before each step and puts the hand on the handle.
 * The leaf is posed along its item's own open clip, so the same opening the item's animation shows is the one the hand drives.
 */
import type * as THREE_NS from 'three'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { AnimationClipSpec, HandTargets, HostReach } from '@adatechnology/game-contracts'
import { createDoorUse, DOOR_USE_DEFAULTS } from '@adatechnology/game-player'
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
/** Close enough to the place, metres; the longest walk to it before the hand goes anyway, seconds. */
const ARRIVED = 0.05
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
  /** What the eye rests on within reach, or null. */
  pick(): { readonly objectId: string; readonly part: string; readonly point: Vec3 } | null
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
  phase: DoorUsePhase
  progress: number
  /** Seconds walked to the handle, and whether the player got there. */
  walked: number
  there: boolean
}

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
  let reaching: { readonly reach: HostReach; phase: Exclude<DoorUsePhase, 'idle'>; time: number; progress: number; walked: number; there: boolean } | null = null
  const rules = { ...DOOR_USE_DEFAULTS, ...options.rules }

  /** Where the hand is going or holding now, and how: the leaf in use or the module's leaf. */
  const holding = (): { phase: Exclude<DoorUsePhase, 'idle'>; progress: number; at: THREE_NS.Vector3; pull: boolean } | null => {
    if (reaching) {
      const h = reaching.reach.handle()
      return { phase: reaching.phase, progress: reaching.progress, at: new THREE.Vector3(h[0], h[1], h[2]), pull: reaching.reach.pull ?? true }
    }
    if (!using || control.phase === 'idle') return null
    using.obj.updateMatrixWorld(true)
    return { phase: control.phase, progress: using.progress, at: using.obj.localToWorld(new THREE.Vector3().copy(using.grip)), pull: using.pull }
  }
  /**
   * Where the player takes the handle from. A turning leaf: beside its free edge, past the arc it sweeps and a little out in front, on the side the player is on, so the leaf
   * swings by and not into the body (a person opens a fridge standing by the handle side). A drawer or a leaf with no hinge known: straight in front of the handle.
   */
  const standFor = (handle: THREE_NS.Vector3, hinge: THREE_NS.Vector3 | null, slide: boolean): [number, number] => {
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
    if (width < 0.05) return standFor(handle, null, false)
    ax /= width
    az /= width
    // out of the face, toward the player
    let nx = -az
    let nz = ax
    if ((player.x - handle.x) * nx + (player.z - handle.z) * nz < 0) {
      nx = -nx
      nz = -nz
    }
    const x = hinge.x + ax * (width + CLEAR_OF_ARC) + nx * OUT_IN_FRONT
    const z = hinge.z + az * (width + CLEAR_OF_ARC) + nz * OUT_IN_FRONT
    // something stands there (the next cabinet, a nightstand): in front of the handle, and the leaf will make the player step back
    return player.canStand(x, z) ? [x, z] : standFor(handle, null, false)
  }
  /** The player steps toward where the handle is taken from. Answers true once there, or when nothing more can be gained (in the way, or walking too long). */
  const approach = (handle: THREE_NS.Vector3, hinge: THREE_NS.Vector3 | null, slide: boolean, dt: number, walked: number): boolean => {
    const [x, z] = standFor(handle, hinge, slide)
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
      const out = bodyOverlap(box)
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
    const goal = control.begin({ opening, massKg: massOf(objectId, leaf.part), locked: options.isLocked(objectId, leaf.part) })
    // a leaf that comes toward the body is pulled, one that goes away is pushed: compare the leaf open and closed with where the player stands
    let pull = true
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
    }
    using = { objectId, leaf, obj, grip, pull, phase: control.phase, progress: 0, walked: 0, there: goal === null }
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
      const hit = options.pick()
      if (!hit) return null
      const leaf = leafAt(hit.objectId, hit.part, hit.point)
      if (!leaf) return null
      return { objectId: hit.objectId, part: leaf.part, open: openingOf(hit.objectId, leaf.part) > 0.5, locked: options.isLocked(hit.objectId, leaf.part) }
    },
    use() {
      const hit = options.pick()
      if (!hit) return false
      const leaf = leafAt(hit.objectId, hit.part, hit.point)
      return leaf ? start(hit.objectId, leaf, hit.point) : false
    },
    useLeaf(objectId, part) {
      const leaves = options.leaves(objectId)
      const leaf = part === undefined ? leaves[0] : leaves.find((l) => l.part === part)
      return leaf ? start(objectId, leaf, null) : false
    },
    opening: openingOf,
    step(dt) {
      const r = reaching
      if (r) {
        r.time += dt
        if (r.phase === 'reach' && !r.there) {
          const h = r.reach.handle()
          const hinge = r.reach.hinge?.()
          r.walked += dt
          r.there = approach(tmp.set(h[0], h[1], h[2]), hinge ? new THREE.Vector3(hinge[0], hinge[1], hinge[2]) : null, false, dt, r.walked)
          if (r.there) r.time = 0
        } else if (r.phase === 'reach') {
          r.progress = Math.min(1, r.time / rules.reachSeconds)
          if (r.progress >= 1) {
            r.reach.onGrip?.()
            r.phase = r.reach.locked ? 'rattle' : 'swing'
            r.time = 0
            r.progress = 0
          }
        } else if (r.phase === 'swing' || r.phase === 'rattle') {
          r.progress = Math.min(1, r.time / (r.phase === 'rattle' ? rules.rattleSeconds : Math.max(0.05, r.reach.seconds)))
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
        u.there = approach(u.obj.localToWorld(tmp.copy(u.grip)), u.obj.getWorldPosition(new THREE.Vector3()), slides(u.leaf.clip, u.leaf.part), dt, u.walked)
        if (!u.there) return
      }
      const s = control.step(dt, (from, to) => isFree(u, from, to))
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
      const { at, phase, progress } = h
      // the rattle shakes the handle under the hand
      if (phase === 'rattle') at.y += Math.sin(progress * 60) * 0.012
      camera.updateMatrixWorld(true)
      const rest = camera.localToWorld(new THREE.Vector3(HAND_REST[0], HAND_REST[1], HAND_REST[2]))
      // reach: the hand travels to the handle; release: back to the chest
      const k = phase === 'reach' ? progress : phase === 'release' ? 1 - progress : 1
      const ease = k * k * (3 - 2 * k)
      const pos = rest.lerp(at, ease)
      // a hand round a vertical handle: fingers away from the player, thumb up (HandPose of game-contracts: +x to the knuckles, +z to the little finger)
      const way = new THREE.Vector3(at.x - player.x, 0, at.z - player.z)
      if (way.lengthSq() < 1e-6) way.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
      way.normalize()
      const down = new THREE.Vector3(0, -1, 0)
      const back = new THREE.Vector3().crossVectors(down, way)
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(way, back, down))
      const grip = phase === 'reach' ? 0.15 + 0.75 * progress : phase === 'release' ? 0.9 * (1 - progress) : 0.9
      return { R: { position: [pos.x, pos.y, pos.z], quaternion: [q.x, q.y, q.z, q.w] }, L: null, grip }
    },
    reachFor(reach) {
      if (using) {
        control.cancel()
        using = null
      }
      reaching = { reach, phase: 'reach', time: 0, progress: 0, walked: 0, there: false }
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
