/**
 * Pushing furniture on foot: hold the interaction button against a piece, a timer that grows with its mass fills, and the player then walks with it.
 * Engine-agnostic: the host says where the player wants to go and answers whether the volume of the piece can go there; this says how fast, and when it locks.
 */

export type FurniturePushPhase = 'idle' | 'grip' | 'push' | 'strain'
export type FurniturePushBlock = 'too_heavy' | 'obstacle' | null

/** Every number of the push; a game overrides what it wants (`createFurniturePush(rules)`). */
export interface FurniturePushRules {
  /** The most the player's legs put on the floor, newtons: with the friction it says the heaviest thing that moves. */
  readonly forceN: number
  readonly gravity: number
  /** Static friction of a base on a floor, by the material of the piece. */
  readonly frictionByMaterial: Readonly<Record<string, number>>
  readonly defaultFriction: number
  /** The hold before the push: `base + perKg * mass`, at most `max` seconds. */
  readonly gripSeconds: { readonly base: number; readonly perKg: number; readonly max: number }
  /** Metres per second: `max` with nothing on the hands, `min` at the limit of the force. */
  readonly speed: { readonly max: number; readonly min: number }
  /** A press shorter than this is not a push (the host keeps it for a tap, such as grabbing). */
  readonly tapSeconds: number
  /** How long the effort stays after the last step that was refused, so that it does not flicker. */
  readonly strainHoldSeconds: number
}

export const FURNITURE_PUSH_DEFAULTS: FurniturePushRules = {
  forceN: 500,
  gravity: 9.81,
  frictionByMaterial: { wood_soft: 0.4, wood_hard: 0.4, mdf: 0.4, plywood: 0.4, steel: 0.35, aluminium: 0.35, cast_iron: 0.4, copper: 0.35, plastic: 0.35, rubber: 0.8, fabric: 0.45, foam: 0.5, ceramic: 0.5, glass: 0.3, tempered_glass: 0.3, brick: 0.6, concrete: 0.65 },
  defaultFriction: 0.45,
  gripSeconds: { base: 0.4, perKg: 0.015, max: 2.5 },
  speed: { max: 1.8, min: 0.35 },
  tapSeconds: 0.2,
  strainHoldSeconds: 0.25,
}

export type FurniturePushTarget = { readonly massKg: number; readonly material?: string }

const frictionOf = (target: FurniturePushTarget, rules: FurniturePushRules): number => (target.material !== undefined ? rules.frictionByMaterial[target.material] : undefined) ?? rules.defaultFriction

const loadShare = (target: FurniturePushTarget, rules: FurniturePushRules): number => (frictionOf(target, rules) * target.massKg * rules.gravity) / rules.forceN

export const gripSecondsFor = (massKg: number, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => Math.min(rules.gripSeconds.max, rules.gripSeconds.base + rules.gripSeconds.perKg * Math.max(0, massKg))

/** Whether the legs overcome the friction of the piece on the floor. */
export const canPush = (target: FurniturePushTarget, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): boolean => loadShare(target, rules) <= 1

/** Metres per second with the piece on the hands: slower the closer it is to the limit of the force, 0 past it. */
export const pushSpeedFor = (target: FurniturePushTarget, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => {
  const share = loadShare(target, rules)
  return share > 1 ? 0 : rules.speed.max + (rules.speed.min - rules.speed.max) * share
}

export type FurniturePushInput = {
  /** Where the player wants to go on the floor: a unit vector, or `[0, 0]` standing. */
  readonly walk: readonly [number, number]
  /** Whether the volume of the piece (and the player behind it) can move by this offset. */
  readonly isFree: (dx: number, dz: number) => boolean
}

export type FurniturePushStep = {
  readonly dx: number
  readonly dz: number
  /** The grip closed on this update. */
  readonly engaged: boolean
  /** A step was refused now and the one before was not: the moment the piece hits something. */
  readonly hitObstacle: boolean
}

export interface FurniturePush {
  readonly phase: FurniturePushPhase
  /** How far the hold timer is, 0 to 1. */
  readonly progress: number
  readonly block: FurniturePushBlock
  readonly heldSeconds: number
  /** Whether the hold is still short enough to be a tap. */
  readonly isTap: boolean
  begin(target: FurniturePushTarget): void
  release(): void
  update(dt: number, input: FurniturePushInput): FurniturePushStep
}

const STILL: FurniturePushStep = { dx: 0, dz: 0, engaged: false, hitObstacle: false }

export function createFurniturePush(overrides: Partial<FurniturePushRules> = {}): FurniturePush {
  const rules: FurniturePushRules = { ...FURNITURE_PUSH_DEFAULTS, ...overrides }
  let phase: FurniturePushPhase = 'idle'
  let target: FurniturePushTarget = { massKg: 0 }
  let held = 0
  let gripSeconds = 1
  let speed = 0
  let block: FurniturePushBlock = null
  let refused = 0
  let wasRefused = false

  const walkWith = (dt: number, input: FurniturePushInput): FurniturePushStep => {
    refused = Math.max(0, refused - dt)
    if (block === 'too_heavy') return STILL
    const [x, z] = input.walk
    if ((x === 0 && z === 0) || dt <= 0) {
      if (refused === 0) {
        phase = 'push'
        block = null
        wasRefused = false
      }
      return STILL
    }
    const dx = x * speed * dt
    const dz = z * speed * dt
    if (input.isFree(dx, dz)) {
      if (refused === 0) {
        phase = 'push'
        block = null
      }
      wasRefused = false
      return { dx, dz, engaged: false, hitObstacle: false }
    }
    const hitObstacle = !wasRefused
    wasRefused = true
    refused = rules.strainHoldSeconds
    phase = 'strain'
    block = 'obstacle'
    return { dx: 0, dz: 0, engaged: false, hitObstacle }
  }

  return {
    get phase() {
      return phase
    },
    get progress() {
      return phase === 'idle' ? 0 : Math.min(1, held / gripSeconds)
    },
    get block() {
      return block
    },
    get heldSeconds() {
      return held
    },
    get isTap() {
      return phase === 'grip' && held < rules.tapSeconds
    },
    begin(next) {
      target = next
      phase = 'grip'
      held = 0
      block = null
      refused = 0
      wasRefused = false
      gripSeconds = gripSecondsFor(next.massKg, rules)
      speed = pushSpeedFor(next, rules)
    },
    release() {
      phase = 'idle'
      held = 0
      block = null
    },
    update(dt, input) {
      if (phase === 'idle') return STILL
      held += dt
      if (phase !== 'grip') return walkWith(dt, input)
      if (held < gripSeconds) return STILL
      if (canPush(target, rules)) phase = 'push'
      else {
        phase = 'strain'
        block = 'too_heavy'
      }
      return { ...STILL, engaged: true }
    },
  }
}
