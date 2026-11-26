import type { CharacterDesc, CharacterId } from '@adatechnology/game-physics'

import type { JoltCharacter } from './entries'
import type { JoltWorldHost } from './world-host'

const GRAVITY = 9.81
const DEFAULT_STEP_HEIGHT = 0.4
const DEFAULT_MAX_SLOPE_DEGREES = 45
const STICK_TO_FLOOR_DISTANCE = 0.5
/** A shove fades as exp(-t / 0.25): gone in about a second. */
const PUSH_DECAY_PER_SECOND = 4

/**
 * A walking capsule (Jolt's `CharacterVirtual`): not a body, it moves by sweeps against the world, steps up stairs and sticks to the floor going down
 * (`ExtendedUpdate`), and pushes dynamic bodies with up to `strength` N. Gravity is its own; a shove (`push`) adds a velocity that fades.
 */
export const createCharacter = (w: JoltWorldHost, desc: CharacterDesc): CharacterId => {
  const J = w.J
  const settings = new J.CharacterVirtualSettings()
  const shape = w.makeShape({ kind: 'capsule', halfHeight: desc.halfHeight, radius: desc.radius })
  settings.mShape = shape
  settings.mMass = desc.mass
  settings.mMaxStrength = desc.strength
  settings.mMaxSlopeAngle = ((desc.maxSlopeDegrees ?? DEFAULT_MAX_SLOPE_DEGREES) * Math.PI) / 180
  // the capsule's foot at the position
  settings.mShapeOffset.Set(0, desc.halfHeight + desc.radius, 0)
  w.r1.Set(desc.position[0], desc.position[1], desc.position[2])
  w.q1.Set(0, 0, 0, 1)
  const character = new J.CharacterVirtual(settings, w.r1, w.q1, w.system)
  J.destroy(settings)
  shape.Release()
  const update = new J.ExtendedUpdateSettings()
  update.mWalkStairsStepUp.Set(0, desc.stepHeight ?? DEFAULT_STEP_HEIGHT, 0)
  update.mStickToFloorStepDown.Set(0, -STICK_TO_FLOOR_DISTANCE, 0)
  const velocity = new J.Vec3(0, 0, 0)
  const gravity = new J.Vec3(0, -GRAVITY, 0)
  const zero = new J.Vec3(0, 0, 0)
  let fall = 0
  let pushX = 0
  let pushZ = 0
  const id = w.nextCharacter++ as CharacterId
  const made: JoltCharacter = {
    move: (vx: number, vz: number, dt: number) => {
      fall = character.IsSupported() ? 0 : fall - GRAVITY * dt
      velocity.Set(vx + pushX, fall, vz + pushZ)
      const fade = Math.exp(-PUSH_DECAY_PER_SECOND * dt)
      pushX *= fade
      pushZ *= fade
      character.SetLinearVelocity(velocity)
      character.ExtendedUpdate(dt, gravity, update, w.bpFilter, w.objFilter, w.bodyFilter, w.shapeFilter, w.iface.GetTempAllocator())
    },
    push: (impulseX: number, impulseZ: number) => {
      pushX += impulseX / desc.mass
      pushZ += impulseZ / desc.mass
    },
    read: (out: Float32Array | Float64Array, offset: number) => {
      const p = character.GetPosition()
      out[offset] = p.GetX()
      out[offset + 1] = p.GetY()
      out[offset + 2] = p.GetZ()
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
    dispose: () => {
      if (!w.characters.delete(id)) return
      J.destroy(update)
      J.destroy(velocity)
      J.destroy(gravity)
      J.destroy(zero)
      J.destroy(character)
    },
  }
  w.characters.set(id, made)
  return id
}
