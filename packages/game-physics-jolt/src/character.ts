import type { CharacterDesc, CharacterId } from '@adatechnology/game-physics'

import type { JoltCharacter } from './entries'
import type { JoltWorldHost } from './world-host'

const DEFAULT_GRAVITY = 9.81
const DEFAULT_STEP_HEIGHT = 0.4
const DEFAULT_MAX_SLOPE_DEGREES = 45
const STICK_TO_FLOOR_DISTANCE = 0.5
/** A shove fades as exp(-t / 0.25): gone in about a second. */
const PUSH_DECAY_PER_SECOND = 4

/**
 * A walking capsule (Jolt's `CharacterVirtual`): not a body, it moves by sweeps against the world, steps up stairs and sticks to the floor going down
 * (`ExtendedUpdate`), and pushes dynamic bodies with up to `strength` N. Gravity is its own (`desc.gravity`); a shove (`push`) adds a horizontal velocity that fades and a vertical one that gravity takes back.
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
  const pull = desc.gravity ?? DEFAULT_GRAVITY
  const gravity = new J.Vec3(0, -pull, 0)
  const zero = new J.Vec3(0, 0, 0)
  let fall = 0
  let pushX = 0
  let pushZ = 0
  const id = w.nextCharacter++ as CharacterId
  const made: JoltCharacter = {
    move: (vx: number, vz: number, dt: number) => {
      const resting = character.IsSupported() && fall <= 0
      const before = resting ? 0 : fall
      fall = resting ? 0 : before - pull * dt
      // the mean of the step's two speeds, so the arc of a jump is the parabola and not one step short
      velocity.Set(vx + pushX, resting ? 0 : (before + fall) / 2, vz + pushZ)
      const fade = Math.exp(-PUSH_DECAY_PER_SECOND * dt)
      pushX *= fade
      pushZ *= fade
      character.SetLinearVelocity(velocity)
      character.ExtendedUpdate(dt, gravity, update, w.bpFilter, w.objFilter, w.bodyFilter, w.shapeFilter, w.iface.GetTempAllocator())
    },
    push: (impulseX: number, impulseY: number, impulseZ: number) => {
      fall += impulseY / desc.mass
      pushX += impulseX / desc.mass
      pushZ += impulseZ / desc.mass
    },
    read: (out: Float32Array | Float64Array, offset: number) => {
      const p = character.GetPosition()
      out[offset] = p.GetX()
      out[offset + 1] = p.GetY()
      out[offset + 2] = p.GetZ()
    },
    bounds: (out: Float64Array, offset: number) => {
      const p = character.GetPosition()
      const reach = desc.radius
      out[offset] = p.GetX() - reach
      out[offset + 1] = p.GetY()
      out[offset + 2] = p.GetZ() - reach
      out[offset + 3] = p.GetX() + reach
      out[offset + 4] = p.GetY() + 2 * (desc.halfHeight + desc.radius)
      out[offset + 5] = p.GetZ() + reach
      const v = character.GetLinearVelocity()
      out[offset + 6] = v.GetX()
      out[offset + 7] = v.GetZ()
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
