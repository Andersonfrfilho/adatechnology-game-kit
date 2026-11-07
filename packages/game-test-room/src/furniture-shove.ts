/**
 * Furniture shoved by the bodies of a module (the agents of a horde, NPCs: `ModuleHost.shove`): the force they sum moves the piece at the speed the player's legs would give
 * it with that force (`pushSpeedFor` of game-player), with what rests on it, as long as nothing is in the way; past its friction nothing moves. A piece no one leans on for
 * a moment is let go, a body again.
 */
import type { HostShove } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import { pushSpeedFor } from '@adatechnology/game-player'
import { carryFits, createCarry, holdCarry, moveCarry, releaseCarry } from './furniture-carry'
import type { Carry, CarryHost, RoomPushTarget } from './furniture-carry'

/** Seconds without a shove before the piece is let go. */
const LET_GO_SECONDS = 0.25

export type RoomShoveEvent = { readonly type: 'shoved' | 'shove_too_heavy'; readonly objectId: string; readonly name: string; readonly massKg: number; readonly pushers: number }

export type RoomShoveOptions = CarryHost & {
  /** The piece `objectId` names, when it stands on the floor and may be shoved. */
  targetOf(objectId: string): RoomPushTarget | null
  /** The player already leans on it: the player's push moves it. */
  isPushedByPlayer(objectId: string): boolean
  /** Whether the box moved by `(dx, dz)` would run into the player (the piece stops at the player's body). */
  hitsPlayer(min: Vec3, max: Vec3): boolean
  hitSound(objectId: string, point: Vec3): void
  onEvent(event: RoomShoveEvent): void
}

export interface RoomShove {
  /** Bodies lean on `objectId`: answers the metres it moved now (0: too heavy, or blocked). */
  shove(objectId: string, push: HostShove): number
  /** Lets go of what no one shoved for a moment. */
  step(dt: number): void
  clear(): void
}

type Shoved = { readonly carry: Carry; idle: number; dragged: number; isHeld: boolean; isBlocked: boolean; isMoving: boolean; isStrained: boolean }

export function createRoomShove(options: RoomShoveOptions): RoomShove {
  const shoved = new Map<string, Shoved>()

  const event = (type: RoomShoveEvent['type'], s: Shoved, pushers: number): void =>
    options.onEvent({ type, objectId: s.carry.target.objectId, name: s.carry.target.name, massKg: s.carry.massKg, pushers })

  const fits = (s: Shoved, dx: number, dz: number): boolean => {
    const { min, max } = s.carry
    return !options.hitsPlayer([min[0] + dx, min[1], min[2] + dz], [max[0] + dx, max[1], max[2] + dz]) && carryFits(options, s.carry, dx, dz)
  }

  const shovedOf = (objectId: string): Shoved | null => {
    const known = shoved.get(objectId)
    if (known) return known
    const target = options.targetOf(objectId)
    if (!target || !options.world.has(objectId)) return null
    const s: Shoved = { carry: createCarry(options, target), idle: 0, dragged: 0, isHeld: false, isBlocked: false, isMoving: false, isStrained: false }
    shoved.set(objectId, s)
    return s
  }

  const letGo = (objectId: string, s: Shoved): void => {
    if (s.isHeld) releaseCarry(s.carry)
    shoved.delete(objectId)
  }

  return {
    shove(objectId, push) {
      if (options.isPushedByPlayer(objectId)) return 0
      const s = shovedOf(objectId)
      if (!s) return 0
      s.idle = 0
      const material = s.carry.material
      const speed = pushSpeedFor(material === undefined ? { massKg: s.carry.massKg } : { massKg: s.carry.massKg, material }, { ...options.rules, forceN: push.forceN })
      if (speed <= 0) {
        if (!s.isStrained) event('shove_too_heavy', s, push.pushers)
        s.isStrained = true
        return 0
      }
      s.isStrained = false
      // leaned on, it is a body held by the push: the blockers of the room's bodies and the sweeps no longer see it in its own way
      if (!s.isHeld) {
        holdCarry(options, s.carry)
        s.isHeld = true
      }
      const step = speed * push.dt
      const dx = push.direction[0] * step
      const dz = push.direction[1] * step
      if (!fits(s, dx, dz)) {
        if (!s.isBlocked && s.isMoving) options.hitSound(objectId, [(s.carry.min[0] + s.carry.max[0]) / 2, s.carry.min[1] + 0.3, (s.carry.min[2] + s.carry.max[2]) / 2])
        s.isBlocked = true
        return 0
      }
      s.isBlocked = false
      if (!s.isMoving) {
        s.isMoving = true
        event('shoved', s, push.pushers)
      }
      s.dragged = moveCarry(options, s.carry, dx, dz, s.dragged)
      return step
    },
    step(dt) {
      for (const [objectId, s] of shoved) {
        s.idle += dt
        if (s.idle > LET_GO_SECONDS || !options.world.has(objectId)) letGo(objectId, s)
      }
    },
    clear() {
      for (const [objectId, s] of shoved) letGo(objectId, s)
    },
  }
}
