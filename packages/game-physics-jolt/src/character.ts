import type { Vec3 } from '@adatechnology/game-physics'

import type { JoltCharacter } from './entries'
import type { JoltWorldHost } from './world-host'

export interface CharacterDesc {
  readonly radius: number
  readonly halfHeight: number
  readonly mass: number
  readonly strength: number
}

/**
 * A walking capsule (Jolt's `CharacterVirtual`, spike: not yet in the contract): not a body, it moves by sweeps against the world, steps up stairs and sticks
 * to the floor going down (`ExtendedUpdate`), and pushes dynamic bodies with up to `strength` N. `update` takes the wanted horizontal speed; gravity is its own.
 */
export const createCharacter = (w: JoltWorldHost, at: Vec3, size: CharacterDesc): JoltCharacter => {
  const J = w.J
  const settings = new J.CharacterVirtualSettings()
  const shape = w.makeShape({ kind: 'capsule', halfHeight: size.halfHeight, radius: size.radius })
  settings.mShape = shape
  settings.mMass = size.mass
  settings.mMaxStrength = size.strength
  settings.mMaxSlopeAngle = (45 * Math.PI) / 180
  // the capsule's foot at the position
  settings.mShapeOffset.Set(0, size.halfHeight + size.radius, 0)
  w.r1.Set(at[0], at[1], at[2])
  w.q1.Set(0, 0, 0, 1)
  const character = new J.CharacterVirtual(settings, w.r1, w.q1, w.system)
  J.destroy(settings)
  shape.Release()
  const update = new J.ExtendedUpdateSettings()
  update.mWalkStairsStepUp.Set(0, 0.4, 0)
  update.mStickToFloorStepDown.Set(0, -0.5, 0)
  const velocity = new J.Vec3(0, 0, 0)
  const gravity = new J.Vec3(0, -9.81, 0)
  let fall = 0
  const made: JoltCharacter = {
    update: (dt: number, vx: number, vz: number) => {
      fall = character.IsSupported() ? 0 : fall - 9.81 * dt
      velocity.Set(vx, fall, vz)
      character.SetLinearVelocity(velocity)
      character.ExtendedUpdate(dt, gravity, update, w.bpFilter, w.objFilter, w.bodyFilter, w.shapeFilter, w.iface.GetTempAllocator())
    },
    position: (out: Float64Array) => {
      const p = character.GetPosition()
      out[0] = p.GetX()
      out[1] = p.GetY()
      out[2] = p.GetZ()
    },
    supported: () => character.IsSupported(),
    dispose: () => {
      if (!w.characters.delete(made)) return
      J.destroy(update)
      J.destroy(velocity)
      J.destroy(gravity)
      J.destroy(character)
    },
  }
  w.characters.add(made)
  return made
}
