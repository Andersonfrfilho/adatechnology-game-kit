import type { BodyId, CharacterId, CharacterShape, Layer, PhysicsServices, Quat, Vec3 } from '@adatechnology/game-physics'

import { PLAYER_MASS_KG, PLAYER_PUSH_STRENGTH_NEWTONS } from './physics-controller'
import type { PlayerCollider } from './player'

/** The vertical speed (m/s) of a jump under the world's 9.81: it rises 0.81 m, as high as the walker's own jump always did. */
export const WALKER_JUMP_SPEED = 3.99

export type WalkerStance = 'standing' | 'crouched' | 'prone'

/** A stance is this fraction of the standing height: 1.80, 1.20 and 0.60 m for a person 1.80 m tall. */
const STANCE_HEIGHT_RATIO: Readonly<Record<WalkerStance, number>> = { standing: 1, crouched: 2 / 3, prone: 1 / 3 }
const NO_ROTATION: Quat = [0, 0, 0, 1]
/** The probe sits this much (m) above the feet: the floor it will stand on touches the capsule and is not an overlap. */
const PROBE_LIFT = 0.03
const SOLID_LAYERS: readonly Layer[] = ['static', 'debris', 'prop', 'vehicle', 'character']

export type WalkerOptions = {
  /** Where the feet are. */
  readonly position: Vec3
  /** The standing body: `player.collider()` while standing. */
  readonly collider: PlayerCollider
  /** Kilograms, default 75. */
  readonly mass?: number
  /** Most force (N) it pushes a prop with, default 400. */
  readonly strength?: number
  /** Default 0.4 m. */
  readonly stepHeight?: number
  readonly maxSlopeDegrees?: number
  /** Default 9.81. */
  readonly gravity?: number
  /** The layer of the body the world sees of the walker (`agent`: a vehicle does not stop on it). */
  readonly shadow?: Layer
  /** The shadow's `user`. */
  readonly user?: number
  /** What `unpark` may not stand in (default static, debris, prop, vehicle and character). */
  readonly solidLayers?: readonly Layer[]
}

export type Walker = {
  /** The character in the world: another one after `unpark`. */
  readonly id: CharacterId
  readonly stance: WalkerStance
  readonly parked: boolean
  /** The wanted horizontal velocity (m/s, world x and z), kept until it is changed: the key of the frame, not of the step. */
  setIntent(velocityX: number, velocityZ: number): void
  /** A jump when the feet stand on something; false in the air or parked. */
  jump(): boolean
  /** Changes the stance; false (the stance stays) when the new capsule would penetrate something. */
  setStance(stance: WalkerStance): boolean
  /** Shoves the body: `impulse` in N s. */
  push(impulse: Vec3): void
  supported(): boolean
  /** The feet of the last fixed step into `out` (x, y, z). */
  read(out: Float32Array | Float64Array): void
  /** The feet between the last two fixed steps, `alpha` (0 to 1) of the way: the scheduler's alpha, not the loop's (`stepFixed` zeroes that one). */
  drawn(alpha: number, out: Float32Array | Float64Array): void
  /** Puts the feet here at once, with no sweep and no speed carried over, and the drawn feet with them (a respawn, a scripted step). Nothing happens while parked. */
  teleport(feet: Vec3): void
  /** Takes the body out of the world (a seat, an aircraft, a vehicle): it no longer moves or blocks. */
  park(): void
  /** Puts the body back at the first of `candidates` (feet) where the capsule overlaps nothing solid, in this order (the door, the far side, the roof); false, still parked, when none fits. */
  unpark(candidates: readonly Vec3[]): boolean
  /** Leaves the loop and the world. */
  dispose(): void
}

export type WalkerServices = Pick<PhysicsServices, 'loop' | 'world'>

const shapeOf = (collider: PlayerCollider, stance: WalkerStance): CharacterShape => {
  const height = collider.heightMetres * STANCE_HEIGHT_RATIO[stance]
  const radius = Math.min(collider.radiusMetres, height / 3)
  return { radius, halfHeight: (height - 2 * radius) / 2 }
}

/**
 * The player's body in the physics world, walking in the loop's `actors` phase: the intent is set when the key changes, every fixed step walks it with the step's
 * `h`, and the feet of the last two steps are kept for drawing between them. No allocation after the first call.
 */
export const createWalker = (services: WalkerServices, options: WalkerOptions): Walker => {
  const { loop, world } = services
  const mass = options.mass ?? PLAYER_MASS_KG
  const shapes: Readonly<Record<WalkerStance, CharacterShape>> = { standing: shapeOf(options.collider, 'standing'), crouched: shapeOf(options.collider, 'crouched'), prone: shapeOf(options.collider, 'prone') }
  const solid = options.solidLayers ?? SOLID_LAYERS
  const found: BodyId[] = []
  const previous = new Float64Array(3)
  const current = new Float64Array(3)
  let intentX = 0
  let intentZ = 0
  let stance: WalkerStance = 'standing'
  let parked = false

  const create = (feet: Vec3): CharacterId =>
    world.createCharacter({
      position: feet,
      radius: shapes[stance].radius,
      halfHeight: shapes[stance].halfHeight,
      mass,
      strength: options.strength ?? PLAYER_PUSH_STRENGTH_NEWTONS,
      ...(options.stepHeight !== undefined ? { stepHeight: options.stepHeight } : {}),
      ...(options.maxSlopeDegrees !== undefined ? { maxSlopeDegrees: options.maxSlopeDegrees } : {}),
      ...(options.gravity !== undefined ? { gravity: options.gravity } : {}),
      ...(options.shadow !== undefined ? { shadow: options.shadow } : {}),
      ...(options.user !== undefined ? { user: options.user } : {}),
    })

  let id = create(options.position)
  world.readCharacter(id, current, 0)
  previous.set(current)

  const stopLoop = loop.add(
    {
      beforeStep: (h) => {
        if (parked) return
        previous.set(current)
        world.moveCharacter(id, intentX, intentZ, h)
        world.readCharacter(id, current, 0)
      },
    },
    'actors',
  )

  const fitsAt = (feet: Vec3): boolean => {
    const shape = shapes[stance]
    const centre: Vec3 = [feet[0], feet[1] + PROBE_LIFT + shape.halfHeight + shape.radius, feet[2]]
    return world.overlapShape({ kind: 'capsule', halfHeight: shape.halfHeight, radius: shape.radius }, centre, NO_ROTATION, found, { layers: solid }) === 0
  }

  return {
    get id() {
      return id
    },
    get stance() {
      return stance
    },
    get parked() {
      return parked
    },
    setIntent: (velocityX, velocityZ) => {
      intentX = velocityX
      intentZ = velocityZ
    },
    jump: () => {
      if (parked || !world.characterSupported(id)) return false
      world.pushCharacter(id, [0, mass * WALKER_JUMP_SPEED, 0])
      return true
    },
    setStance: (next) => {
      if (parked) return false
      if (!world.setCharacterShape(id, shapes[next])) return false
      stance = next
      return true
    },
    push: (impulse) => world.pushCharacter(id, impulse),
    supported: () => world.characterSupported(id),
    read: (out) => {
      out[0] = current[0] as number
      out[1] = current[1] as number
      out[2] = current[2] as number
    },
    drawn: (alpha, out) => {
      const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
      for (let axis = 0; axis < 3; axis++) out[axis] = (previous[axis] as number) + ((current[axis] as number) - (previous[axis] as number)) * t
    },
    teleport: (feet) => {
      if (parked) return
      world.teleportCharacter(id, feet)
      world.readCharacter(id, current, 0)
      previous.set(current)
    },
    park: () => {
      if (parked) return
      parked = true
      world.removeCharacter(id)
    },
    unpark: (candidates) => {
      if (!parked) return true
      for (const feet of candidates) {
        if (!fitsAt(feet)) continue
        id = create(feet)
        parked = false
        world.readCharacter(id, current, 0)
        previous.set(current)
        return true
      }
      return false
    },
    dispose: () => {
      stopLoop()
      if (!parked) world.removeCharacter(id)
      parked = true
    },
  }
}
