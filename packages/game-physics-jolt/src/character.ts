import type JoltNS from 'jolt-physics/wasm-compat'

import { DEFAULT_MATERIAL, LAYER_PAIRS } from '@adatechnology/game-physics'
import type { BodyId, CharacterDesc, CharacterId, Layer } from '@adatechnology/game-physics'

import { readCharacterBytes, writeCharacterBytes } from './character-state'
import { layerOf, NO_COLLISION } from './constants'
import type { BodyEntry, CharacterSnapshot, JoltCharacter } from './entries'
import { vec3At } from './vec3'
import type { JoltWorldHost } from './world-host'

const DEFAULT_GRAVITY = 9.81
const DEFAULT_STEP_HEIGHT = 0.4
const DEFAULT_MAX_SLOPE_DEGREES = 45
const STICK_TO_FLOOR_DISTANCE = 0.5
/** A shove fades as exp(-t / 0.25): gone in about a second. */
const PUSH_DECAY_PER_SECOND = 4
/** Capsules held for `setCharacterShape` (a kit has three stances): past this a new one is made and let go of after use. */
const SHAPES_MAX = 32
const NO_USER = -1
/** How deep (m) a new capsule may sit in something and still fit: Jolt pads the capsule by 2 cm, so what it rests on counts as touching, not as inside. */
const SHAPE_MAX_PENETRATION = 0.03

/** The capsule of these dimensions, the world's own when it is held (a new reference is the caller's to release when it is not: `held` false). */
const capsuleFor = (w: JoltWorldHost, radius: number, halfHeight: number): { shape: JoltNS.Shape; held: boolean } => {
  const key = `${radius}:${halfHeight}`
  const known = w.characterShapes.get(key)
  if (known) return { shape: known, held: true }
  const shape = w.makeShape({ kind: 'capsule', halfHeight, radius })
  if (w.characterShapes.size >= SHAPES_MAX) return { shape, held: false }
  w.characterShapes.set(key, shape)
  return { shape, held: true }
}

/**
 * What a walker with a shadow in `layer` sweeps against: the fixed world, and what that layer meets. A vehicle does not stop on an `agent` shadow, so the walker
 * does not push one either (the walker would otherwise hold it up with its own 400 N); a sensor is never in the way.
 */
const sweepFilterFor = (w: JoltWorldHost, layer: Layer): JoltNS.ObjectLayerFilterJS => {
  const allowed = new Set<number>([layerOf('static')])
  for (const [x, y] of LAYER_PAIRS) {
    if (x === layer) allowed.add(layerOf(y))
    if (y === layer) allowed.add(layerOf(x))
  }
  allowed.delete(layerOf('sensor'))
  const filter = new w.J.ObjectLayerFilterJS()
  filter.ShouldCollide = (candidate: number) => allowed.has(candidate)
  return filter
}

/** The shadow Jolt made for the walker, known to the adapter as a body that leaves only with its walker. */
const registerShadow = (w: JoltWorldHost, character: JoltNS.CharacterVirtual, owner: number, desc: CharacterDesc): BodyId => {
  const J = w.J
  const innerId = character.GetInnerBodyID()
  const key = innerId.GetIndexAndSequenceNumber()
  const body = w.system.GetBodyLockInterfaceNoLock().TryGetBody(innerId)
  const material = DEFAULT_MATERIAL
  const entry: BodyEntry = { body, id: new J.BodyID(key), key, user: desc.user ?? NO_USER, layer: desc.shadow ?? 'character', material, invMass: 0, kitMass: null, centred: false, character: owner, sliding: false, friction: material.frictionStatic }
  w.bodies.set(key, entry)
  w.byPointer.set(J.getPointer(body), entry)
  return key as BodyId
}

/**
 * A walking capsule (Jolt's `CharacterVirtual`): it moves by sweeps against the world, steps up stairs and sticks to the floor going down
 * (`ExtendedUpdate`), and pushes dynamic bodies with up to `strength` N. Gravity is its own (`desc.gravity`); a shove (`push`) adds a horizontal velocity that
 * fades and a vertical one that gravity takes back. With `desc.shadow` it also has a kinematic body in that layer, which is what the rest of the world meets.
 */
export const createCharacter = (w: JoltWorldHost, desc: CharacterDesc): CharacterId => {
  const J = w.J
  let radius = desc.radius
  let halfHeight = desc.halfHeight
  const settings = new J.CharacterVirtualSettings()
  const first = capsuleFor(w, radius, halfHeight)
  settings.mShape = first.shape
  if (desc.shadow) {
    settings.mInnerBodyShape = first.shape
    settings.mInnerBodyLayer = layerOf(desc.shadow)
  }
  settings.mMass = desc.mass
  settings.mMaxStrength = desc.strength
  settings.mMaxSlopeAngle = ((desc.maxSlopeDegrees ?? DEFAULT_MAX_SLOPE_DEGREES) * Math.PI) / 180
  // the capsule's foot at the position
  const offset = new J.Vec3(0, halfHeight + radius, 0)
  settings.mShapeOffset = offset
  w.r1.Set(desc.position[0], desc.position[1], desc.position[2])
  w.q1.Set(0, 0, 0, 1)
  const character = new J.CharacterVirtual(settings, w.r1, w.q1, w.system)
  J.destroy(settings)
  if (!first.held) first.shape.Release()
  const update = new J.ExtendedUpdateSettings()
  update.mWalkStairsStepUp.Set(0, desc.stepHeight ?? DEFAULT_STEP_HEIGHT, 0)
  update.mStickToFloorStepDown.Set(0, -STICK_TO_FLOOR_DISTANCE, 0)
  const velocity = new J.Vec3(0, 0, 0)
  const pull = desc.gravity ?? DEFAULT_GRAVITY
  const gravity = new J.Vec3(0, -pull, 0)
  const zero = new J.Vec3(0, 0, 0)
  let fall = 0
  let pushX = 0
  let pushZ = 0
  const id = w.nextCharacter++ as CharacterId
  const sweeps = desc.shadow ? sweepFilterFor(w, desc.shadow) : w.objFilter
  const shadow = desc.shadow ? registerShadow(w, character, id, desc) : undefined
  // a body ignored with the shadow (`ignorePair`) is not swept or pushed by the walker either: the pair rule of the world only reaches the shadow body
  let bodies: JoltNS.BodyFilter = w.bodyFilter
  if (shadow !== undefined) {
    const filter = new J.BodyFilterJS()
    filter.ShouldCollide = (pointer: number) => w.ignored.size === 0 || !w.ignored.has(w.pairKey(shadow, J.HEAPU32[pointer >> 2] as number))
    filter.ShouldCollideLocked = () => true
    bodies = filter
  }

  const applyShape = (nextRadius: number, nextHalfHeight: number, deepest: number): boolean => {
    const next = capsuleFor(w, nextRadius, nextHalfHeight)
    offset.Set(0, nextHalfHeight + nextRadius, 0)
    character.SetShapeOffset(offset)
    const fits = character.SetShape(next.shape, deepest, w.bpFilter, sweeps, bodies, w.shapeFilter, w.iface.GetTempAllocator())
    if (fits && shadow !== undefined) character.SetInnerBodyShape(next.shape)
    if (!next.held) next.shape.Release()
    if (!fits) {
      offset.Set(0, halfHeight + radius, 0)
      character.SetShapeOffset(offset)
      return false
    }
    radius = nextRadius
    halfHeight = nextHalfHeight
    return true
  }

  const made: JoltCharacter = {
    move: (vx: number, vz: number, dt: number) => {
      const resting = character.IsSupported() && fall <= 0
      const before = resting ? 0 : fall
      fall = resting ? 0 : before - pull * dt
      // what it stands on carries it (Jolt leaves that to the caller); a jump keeps the platform's sideways speed
      const standing = character.IsSupported()
      const at = vec3At(J, character.GetGroundVelocity())
      const carryX = standing ? (J.HEAPF32[at] as number) : 0
      const carryY = resting ? (J.HEAPF32[at + 1] as number) : 0
      const carryZ = standing ? (J.HEAPF32[at + 2] as number) : 0
      // the mean of the step's two speeds, so the arc of a jump is the parabola and not one step short
      velocity.Set(vx + pushX + carryX, (before + fall) / 2 + carryY, vz + pushZ + carryZ)
      const fade = Math.exp(-PUSH_DECAY_PER_SECOND * dt)
      pushX *= fade
      pushZ *= fade
      character.SetLinearVelocity(velocity)
      character.ExtendedUpdate(dt, gravity, update, w.bpFilter, sweeps, bodies, w.shapeFilter, w.iface.GetTempAllocator())
    },
    push: (impulseX: number, impulseY: number, impulseZ: number) => {
      fall += impulseY / desc.mass
      pushX += impulseX / desc.mass
      pushZ += impulseZ / desc.mass
    },
    read: (out: Float32Array | Float64Array, offsetInOut: number) => {
      const p = character.GetPosition()
      out[offsetInOut] = p.GetX()
      out[offsetInOut + 1] = p.GetY()
      out[offsetInOut + 2] = p.GetZ()
    },
    bounds: (out: Float64Array, offsetInOut: number) => {
      const p = character.GetPosition()
      out[offsetInOut] = p.GetX() - radius
      out[offsetInOut + 1] = p.GetY()
      out[offsetInOut + 2] = p.GetZ() - radius
      out[offsetInOut + 3] = p.GetX() + radius
      out[offsetInOut + 4] = p.GetY() + 2 * (halfHeight + radius)
      out[offsetInOut + 5] = p.GetZ() + radius
      const v = character.GetLinearVelocity()
      out[offsetInOut + 6] = v.GetX()
      out[offsetInOut + 7] = v.GetZ()
    },
    teleport: (x: number, y: number, z: number) => {
      w.r1.Set(x, y, z)
      character.SetPosition(w.r1)
      character.SetLinearVelocity(zero)
      fall = 0
      pushX = 0
      pushZ = 0
    },
    supported: () => character.IsSupported(),
    setShape: (nextRadius: number, nextHalfHeight: number) => applyShape(nextRadius, nextHalfHeight, SHAPE_MAX_PENETRATION),
    shadow,
    ground: (out: Float32Array | Float64Array) => {
      if (!character.IsSupported()) {
        out.set([0, 1, 0, 0, 0, 0, NO_USER])
        return false
      }
      const heap = J.HEAPF32
      let at = vec3At(J, character.GetGroundNormal())
      out[0] = heap[at] as number
      out[1] = heap[at + 1] as number
      out[2] = heap[at + 2] as number
      at = vec3At(J, character.GetGroundVelocity())
      out[3] = heap[at] as number
      out[4] = heap[at + 1] as number
      out[5] = heap[at + 2] as number
      out[6] = w.bodies.get(character.GetGroundBodyID().GetIndexAndSequenceNumber())?.user ?? NO_USER
      return true
    },
    save: (): CharacterSnapshot => ({ radius, halfHeight, fall, pushX, pushZ, bytes: readCharacterBytes(J, character) }),
    restore: (snapshot: CharacterSnapshot) => {
      if (snapshot.radius !== radius || snapshot.halfHeight !== halfHeight) applyShape(snapshot.radius, snapshot.halfHeight, NO_COLLISION)
      writeCharacterBytes(J, character, snapshot.bytes)
      fall = snapshot.fall
      pushX = snapshot.pushX
      pushZ = snapshot.pushZ
    },
    dispose: () => {
      if (!w.characters.delete(id)) return
      if (shadow !== undefined) {
        const entry = w.bodies.get(shadow)
        if (entry) {
          w.byPointer.delete(J.getPointer(entry.body))
          J.destroy(entry.id)
        }
        w.forget(shadow)
      }
      if (sweeps !== w.objFilter) J.destroy(sweeps)
      if (bodies !== w.bodyFilter) J.destroy(bodies)
      J.destroy(update)
      J.destroy(velocity)
      J.destroy(gravity)
      J.destroy(zero)
      J.destroy(offset)
      J.destroy(character)
    },
  }
  w.characters.set(id, made)
  return id
}
