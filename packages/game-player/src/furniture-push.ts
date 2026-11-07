/**
 * Pushing furniture on foot: hold the interaction button against a piece, a timer that grows with its mass fills, and the player then walks with it.
 * Engine-agnostic: the host says where the player wants to go and answers whether the volume of the piece can go there; this says how fast, and when it locks.
 */

import type { SurfaceId } from '@adatechnology/game-contracts'

/** What dragging a piece leaves on a floor: a strip of this colour and width (metres) under each side of its base. */
export type DragMark = { readonly color: number; readonly width: number }

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
  /**
   * How fast the walk with the piece changes, m/s²: `max` the most a person speeds it up (the force left over the friction, over the mass, may give less), `brake` the
   * most it slows it (stopping, turning back). Below what holds a thing on top (friction × g, about 3.4 m/s² for the softest), so a cup on a pushed table rides along.
   */
  readonly accel: { readonly max: number; readonly brake: number; readonly min: number }
  /** A press shorter than this is not a push (the host keeps it for a tap, such as grabbing). */
  readonly tapSeconds: number
  /** How long the effort stays after the last step that was refused, so that it does not flicker. */
  readonly strainHoldSeconds: number
  /**
   * The scratch a dragged piece leaves, by the floor it is dragged on (`SurfaceId` of game-contracts): wood and tile scratch lighter, concrete scuffs darker,
   * dirt and sand take a furrow; a floor left out (carpet, grass, gravel, asphalt, water) keeps no mark.
   */
  readonly dragMarks: Readonly<Partial<Record<SurfaceId, DragMark>>>
}

export const FURNITURE_PUSH_DEFAULTS: FurniturePushRules = {
  forceN: 500,
  gravity: 9.81,
  frictionByMaterial: { wood_soft: 0.4, wood_hard: 0.4, mdf: 0.4, plywood: 0.4, steel: 0.35, aluminium: 0.35, cast_iron: 0.4, copper: 0.35, plastic: 0.35, rubber: 0.8, fabric: 0.45, foam: 0.5, ceramic: 0.5, glass: 0.3, tempered_glass: 0.3, brick: 0.6, concrete: 0.65 },
  defaultFriction: 0.45,
  gripSeconds: { base: 0.4, perKg: 0.015, max: 2.5 },
  speed: { max: 1.8, min: 0.35 },
  accel: { max: 1.5, brake: 3, min: 0.2 },
  tapSeconds: 0.2,
  strainHoldSeconds: 0.25,
  dragMarks: {
    wood: { color: 0xd8c4a0, width: 0.012 },
    tile: { color: 0x9a9a96, width: 0.01 },
    concrete: { color: 0x45433f, width: 0.02 },
    metal: { color: 0xd0d4d8, width: 0.008 },
    glass: { color: 0xf2f2f2, width: 0.006 },
    dirt: { color: 0x4a3524, width: 0.04 },
    sand: { color: 0x8d7a5c, width: 0.05 },
  },
}

export type FurniturePushTarget = { readonly massKg: number; readonly material?: string }

/** Static friction of a thing of `material` on what it stands on (the floor, a table top). */
export const frictionFor = (material: string | undefined, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => (material !== undefined ? rules.frictionByMaterial[material] : undefined) ?? rules.defaultFriction

const frictionOf = (target: FurniturePushTarget, rules: FurniturePushRules): number => frictionFor(target.material, rules)

/** A piece, or a row of pieces pushed one against the next (a sofa shoving a chair): their frictions on the floor add up against the legs. */
export type FurniturePushLoad = FurniturePushTarget | readonly FurniturePushTarget[]

const piecesOf = (load: FurniturePushLoad): readonly FurniturePushTarget[] => (Array.isArray(load) ? load : [load as FurniturePushTarget])
const frictionForceOf = (load: FurniturePushLoad, rules: FurniturePushRules): number => piecesOf(load).reduce((sum, t) => sum + frictionOf(t, rules) * t.massKg * rules.gravity, 0)
const massOf = (load: FurniturePushLoad): number => piecesOf(load).reduce((sum, t) => sum + t.massKg, 0)
const loadShare = (load: FurniturePushLoad, rules: FurniturePushRules): number => frictionForceOf(load, rules) / rules.forceN

export const gripSecondsFor = (massKg: number, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => Math.min(rules.gripSeconds.max, rules.gripSeconds.base + rules.gripSeconds.perKg * Math.max(0, massKg))

/** Whether the legs overcome the friction of the piece (or of the row of pieces) on the floor. */
export const canPush = (target: FurniturePushLoad, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): boolean => loadShare(target, rules) <= 1

/** Metres per second with the piece on the hands: slower the closer it is to the limit of the force, 0 past it. */
export const pushSpeedFor = (target: FurniturePushLoad, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => {
  const share = loadShare(target, rules)
  return share > 1 ? 0 : rules.speed.max + (rules.speed.min - rules.speed.max) * share
}

/** How fast the walk with the piece speeds up, m/s²: the force left over its friction, over its mass, at most what a person does (`accel.max`). */
export const pushAccelerationFor = (target: FurniturePushLoad, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): number => {
  const spare = (rules.forceN - frictionForceOf(target, rules)) / Math.max(1e-3, massOf(target))
  return Math.max(rules.accel.min, Math.min(rules.accel.max, spare))
}

/** The scratch dragging leaves on `surface`, or null where the floor keeps none (carpet, grass). */
export const dragMarkFor = (surface: SurfaceId, rules: FurniturePushRules = FURNITURE_PUSH_DEFAULTS): DragMark | null => rules.dragMarks[surface] ?? null

/** Whether a thing resting on a moving piece slides on it: the piece changes speed faster than the friction under the thing can follow (`accelMps2` > friction × g). */
export const slipsOnTop = (accelMps2: number, friction: number, gravity = FURNITURE_PUSH_DEFAULTS.gravity): boolean => accelMps2 > friction * gravity

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
  /** The velocity of the piece after this update, m/s on the floor. */
  readonly velocity: readonly [number, number]
  /** How fast its velocity changed in this update, m/s²: what a thing on top feels. */
  readonly acceleration: number
  /** The velocity it had when it hit something and stopped at once (what rests on it keeps it and slides on), or null. */
  readonly stoppedFrom: readonly [number, number] | null
}

export interface FurniturePush {
  readonly phase: FurniturePushPhase
  /** How far the hold timer is, 0 to 1. */
  readonly progress: number
  readonly block: FurniturePushBlock
  readonly heldSeconds: number
  /** Whether the hold is still short enough to be a tap. */
  readonly isTap: boolean
  /** The velocity of the piece now, m/s on the floor. */
  readonly velocity: readonly [number, number]
  begin(target: FurniturePushTarget): void
  /** The load changed while pushing (the piece met another and shoves it along): the speed and the speeding up follow the whole row. */
  setLoad(load: FurniturePushLoad): void
  release(): void
  update(dt: number, input: FurniturePushInput): FurniturePushStep
}

const STILL: FurniturePushStep = { dx: 0, dz: 0, engaged: false, hitObstacle: false, velocity: [0, 0], acceleration: 0, stoppedFrom: null }

export function createFurniturePush(overrides: Partial<FurniturePushRules> = {}): FurniturePush {
  const rules: FurniturePushRules = { ...FURNITURE_PUSH_DEFAULTS, ...overrides }
  let phase: FurniturePushPhase = 'idle'
  let target: FurniturePushTarget = { massKg: 0 }
  let held = 0
  let gripSeconds = 1
  let speed = 0
  let accel = rules.accel.max
  let vx = 0
  let vz = 0
  let block: FurniturePushBlock = null
  let refused = 0
  let wasRefused = false

  /** The velocity goes toward the walk, no faster than the push speeds it up (or the legs brake it). Answers the change, m/s². */
  const steer = (dt: number, walk: readonly [number, number]): number => {
    const wantX = walk[0] * speed
    const wantZ = walk[1] * speed
    const braking = wantX * vx + wantZ * vz < vx * vx + vz * vz
    let dvx = wantX - vx
    let dvz = wantZ - vz
    const change = Math.hypot(dvx, dvz)
    const most = (braking ? rules.accel.brake : accel) * dt
    if (change > most) {
      dvx *= most / change
      dvz *= most / change
    }
    vx += dvx
    vz += dvz
    return Math.min(change, most) / dt
  }

  const walkWith = (dt: number, input: FurniturePushInput): FurniturePushStep => {
    refused = Math.max(0, refused - dt)
    if (block === 'too_heavy' || dt <= 0) return STILL
    const acceleration = steer(dt, input.walk)
    if (Math.hypot(vx, vz) < 1e-4) {
      vx = vz = 0
      if (refused === 0) {
        phase = 'push'
        block = null
        wasRefused = false
      }
      return { ...STILL, acceleration }
    }
    const dx = vx * dt
    const dz = vz * dt
    if (input.isFree(dx, dz)) {
      if (refused === 0) {
        phase = 'push'
        block = null
      }
      wasRefused = false
      return { dx, dz, engaged: false, hitObstacle: false, velocity: [vx, vz], acceleration, stoppedFrom: null }
    }
    const from: readonly [number, number] = [vx, vz]
    vx = vz = 0
    const hitObstacle = !wasRefused
    wasRefused = true
    refused = rules.strainHoldSeconds
    phase = 'strain'
    block = 'obstacle'
    return { ...STILL, hitObstacle, acceleration: Math.hypot(from[0], from[1]) / dt, stoppedFrom: hitObstacle ? from : null }
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
    get velocity(): readonly [number, number] {
      return [vx, vz]
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
      accel = pushAccelerationFor(next, rules)
      vx = vz = 0
    },
    setLoad(load) {
      speed = pushSpeedFor(load, rules)
      accel = pushAccelerationFor(load, rules)
    },
    release() {
      phase = 'idle'
      vx = vz = 0
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
