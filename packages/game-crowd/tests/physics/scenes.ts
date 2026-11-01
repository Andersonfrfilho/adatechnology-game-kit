import { undeadCrowdPack } from '@adatechnology/game-characters-undead'

import { BALANCE, CELL, CROWD_PHYSICS_DEFAULTS, STATE, createCrowd, createDoors, createNavGrid, createRng, unit } from '../../src'
import type { Crowd, CrowdBlast, Doors, CrowdPack, CrowdPhysicsOptions, CrowdTarget, CrowdType, CrowdUpdateContext, NavGrid } from '../../src'

export const STEP = 1 / 60

/** The balance table of `design-chain-horde.md` §5.1: content that `game-characters-undead` will carry; the tests give it to the pack themselves. */
const BALANCE_TABLE: Readonly<Record<string, NonNullable<CrowdType['balance']>>> = {
  walker: { stability: 1, trip: 0.04, driveForce: 250 },
  runner: { stability: 0.8, trip: 0.06, driveForce: 320 },
  crawler: { trip: 0, driveForce: 150, canFall: false },
  brute: { stability: 2.5, trip: 0.015, driveForce: 600 },
  sniffer: { stability: 1, trip: 0.04, driveForce: 260 },
  leaper: { stability: 0.9, trip: 0.03, driveForce: 300 },
  bloater: { stability: 0.7, trip: 0.06, driveForce: 200 },
  stalker: { stability: 1.1, trip: 0.03, driveForce: 280 },
  blind: { stability: 0.8, trip: 0.07, driveForce: 260 },
  screamer: { stability: 0.9, trip: 0.04, driveForce: 220 },
  charred: { stability: 0.8, trip: 0.05, driveForce: 230 },
  drowned: { stability: 0.9, trip: 0.045, driveForce: 240 },
  devourer: { stability: 1.2, trip: 0.035, driveForce: 300 },
}

export const packWithBalance = (): CrowdPack => {
  const pack = undeadCrowdPack() as unknown as CrowdPack
  return { ...pack, types: pack.types.map((type) => ({ ...type, balance: BALANCE_TABLE[type.id] })) }
}

export const WALKER = 0
export const BRUTE = 3

export const physicsOptions = (overrides: CrowdPhysicsOptions = {}): CrowdPhysicsOptions => ({ ...CROWD_PHYSICS_DEFAULTS, ...overrides })

export const makeTarget = (x = 0, z = 0, alive = true) => {
  const log: string[] = []
  const target: CrowdTarget = {
    state: { x, z, y: 0, floor: 0, alive, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 },
    grab(by) {
      target.state.grabbedBy = by
      log.push(`grab:${by}`)
    },
    hurt(amount) {
      log.push(`hurt:${amount}`)
    },
    knock(seconds) {
      log.push(`knock:${seconds}`)
    },
    release() {
      target.state.grabbedBy = -1
      log.push('release')
    },
  }
  return { target, log }
}

export type Scene = { readonly crowd: Crowd; readonly grid: NavGrid; readonly context: CrowdUpdateContext }

/** Runs `steps` fixed steps fed by frames of 1/fps, the accumulator of the scheduler (at most 4 substeps per frame). */
export const runFixed = (crowd: Crowd, fps: number, steps: number, context: CrowdUpdateContext, each?: (step: number) => void): void => {
  let accumulator = 0
  let done = 0
  while (done < steps) {
    accumulator += 1 / fps
    for (let sub = 0; sub < 4 && accumulator >= STEP - 1e-9 && done < steps; sub++) {
      crowd.update(STEP, context)
      accumulator -= STEP
      each?.(++done)
    }
  }
}

export const runSteps = (scene: Scene, steps: number, each?: (step: number) => void): void => {
  for (let step = 1; step <= steps; step++) {
    scene.crowd.update(STEP, scene.context)
    each?.(step)
  }
}

export type QueueOptions = {
  readonly seed?: number
  readonly physics?: CrowdPhysicsOptions
  /** Overrides the type of the agent at (row, column); a brute in the row of the test. */
  readonly typeAt?: (row: number, column: number) => number
  readonly reversed?: boolean
  readonly columns?: number
  readonly rows?: number
  readonly personality?: boolean
}

/**
 * The target of the scenes with a wall: far enough (more than the 96 m window of the flow field) that every agent walks in a straight line at it, as the game's horde does
 * outside the window. Inside the window the field turns the block at 45 degrees towards the target and squeezes it into a funnel, which is not what a wall test measures.
 */
export const FAR_TARGET: readonly [number, number] = [0, -230]

/** The `queue` scene (§13.1): a hexagonal block of walkers walking straight at a solid wall. */
export const createQueueScene = (options: QueueOptions = {}): Scene => {
  const grid = createNavGrid({ size: 512, border: true })
  grid.fillRect(-60, -21, 60, -20, CELL.SOLID, 3)
  const physics = options.physics ?? physicsOptions(options.personality === false ? { personality: false } : {})
  const crowd = createCrowd({ pack: packWithBalance(), seed: options.seed ?? 11, grid, capacity: 2000, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  const columns = options.columns ?? 6
  const rows = options.rows ?? 40
  const places: { x: number; z: number; row: number; column: number }[] = []
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) places.push({ x: (column - (columns - 1) / 2) * 0.6 + (row % 2 ? 0.3 : 0), z: -2 - row * 0.45, row, column })
  if (options.reversed) places.reverse()
  for (const place of places) {
    const i = crowd.spawn(place.x, place.z, options.typeAt?.(place.row, place.column) ?? WALKER)
    crowd.store.state[i] = STATE.CHASE
  }
  return { crowd, grid, context: { flowTarget: FAR_TARGET, bandCentre: [0, -11] } }
}

/** The grenade of the design (`m67`: 200 kJ, 15 m, 5 m lethal), one metre inside the tail of the queue (the queue closes up towards the wall in the 300 steps before it, so the tail is not where it was born). */
export const mortarAt = (crowd: Crowd): CrowdBlast => {
  let tail = -Infinity
  for (let i = 0; i < crowd.store.n; i++) tail = Math.max(tail, crowd.store.z[i]!)
  return { point: [0, 0.3, tail - 1], energy: 200000, radius: 15, lethalRadius: 5 }
}

export const countBalance = (crowd: Crowd, balance: number): number => {
  let count = 0
  for (let i = 0; i < crowd.store.n; i++) if (crowd.store.balance[i] === balance) count++
  return count
}

export const FALLEN_OR_UP = [BALANCE.FALLEN, BALANCE.GETTING_UP] as const

/** The column scene (§13.2): `count` walkers in single file, 0.48 m apart, the first one against the wall, personality off. */
export const createColumnScene = (count: number, options: { reversed?: boolean; typeAt?: (index: number) => number; physics?: CrowdPhysicsOptions } = {}): Scene => {
  const grid = createNavGrid({ size: 512, border: true })
  grid.fillRect(-60, -21, 60, -20, CELL.SOLID, 3)
  const physics = options.physics ?? physicsOptions({ personality: false })
  const crowd = createCrowd({ pack: packWithBalance(), seed: 5, grid, capacity: 400, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  const order = Array.from({ length: count }, (_, k) => k)
  if (options.reversed) order.reverse()
  for (const k of order) {
    const i = crowd.spawn(0, -19.6 + k * 0.48, options.typeAt?.(k) ?? WALKER)
    crowd.store.state[i] = STATE.CHASE
  }
  return { crowd, grid, context: { flowTarget: FAR_TARGET, bandCentre: [0, -12] } }
}

/** The agent nearest to the wall (the front of a column or of a block). */
export const frontOf = (crowd: Crowd): number => {
  let front = 0
  for (let i = 1; i < crowd.store.n; i++) if (crowd.store.z[i]! < crowd.store.z[front]!) front = i
  return front
}

/** The pool of the design's chain scene: the fastest bodies get the slots, the case the numbers of §7 were counted for. */
export const FASTEST_FIRST: CrowdPhysicsOptions = { ...CROWD_PHYSICS_DEFAULTS, thrown: { ...(CROWD_PHYSICS_DEFAULTS.thrown as object), priority: 'fastest' } }

export type FallRecord = { readonly step: number; readonly cause: number; readonly x: number; readonly z: number; readonly agent: number; readonly type: number; readonly direct: number }

/** The queue of the chain test: the design's block widened to 8 columns (its own fallback), the fastest bodies first. */
export const createChainScene = (options: QueueOptions = {}): Scene => createQueueScene({ columns: 8, rows: 30, seed: 12, physics: FASTEST_FIRST, ...options })

export type ChainRun = { readonly scene: Scene; readonly falls: FallRecord[]; readonly blast: CrowdBlast }

export const COMPRESS_STEPS = 300
export const AFTER_STEPS = 240
/** The fixed step (counted from 0) in which the grenade is resolved: the one after the 300 steps of compression. */
export const BLAST_STEP = COMPRESS_STEPS

/** Closes the queue up for 300 steps, throws the grenade one metre inside its tail and runs 240 steps more, recording every fall. `step` of a fall is the number of updates done before it. */
export const runChain = (scene: Scene, options: { readonly blast?: (crowd: Crowd) => CrowdBlast; readonly stepsAfter?: number } = {}): ChainRun => {
  const { crowd } = scene
  const falls: FallRecord[] = []
  let current = 0
  crowd.on('fall', (event) => {
    const direct = crowd.store.blastStep[event.agent] === BLAST_STEP ? crowd.store.directShove[event.agent]! : 0
    falls.push({ step: current, cause: event.cause, x: event.x, z: event.z, agent: event.agent, type: crowd.store.type[event.agent]!, direct })
  })
  runSteps(scene, COMPRESS_STEPS, (step) => (current = step))
  const blast = options.blast?.(crowd) ?? mortarAt(crowd)
  crowd.blast(blast)
  runSteps(scene, options.stepsAfter ?? AFTER_STEPS, (step) => (current = COMPRESS_STEPS + step))
  return { scene, falls, blast }
}


export type PenScene = Scene & { readonly doors: Doors; readonly doorIndex: number }

/**
 * The `pen` scene (§13.2): a closed box of 30 x 30 m with solid walls 3 m high, a closed door of 1.2 m on its north wall and the goal on the other side. `count` agents of the usual mix
 * of types are laid out on a jittered grid in z from -28 to -10 and all walk at the door.
 */
export const createPenScene = (count: number, options: { readonly seed?: number; readonly physics?: CrowdPhysicsOptions; readonly doorPressureDamage?: number } = {}): PenScene => {
  const grid = createNavGrid({ size: 128, border: true })
  grid.fillRect(-16, -31, -15, 1, CELL.SOLID, 3)
  grid.fillRect(15, -31, 16, 1, CELL.SOLID, 3)
  grid.fillRect(-16, -31, 16, -30, CELL.SOLID, 3)
  grid.fillRect(-16, -0.5, 16, 0.5, CELL.SOLID, 3)
  const seed = options.seed ?? 21
  const random = createRng(seed)
  const doors = createDoors(grid, { random })
  const doorIndex = doors.add(0, 0, 'x', 1.2)
  const basePhysics = options.physics ?? CROWD_PHYSICS_DEFAULTS
  const physics = options.doorPressureDamage === undefined ? basePhysics : { ...basePhysics, door: { pressureDamage: options.doorPressureDamage } }
  const crowd = createCrowd({ pack: packWithBalance(), seed, grid, doors, capacity: Math.max(count, 100) + 100, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  const columns = Math.ceil(Math.sqrt((count * 28) / 18))
  const spacingX = 28 / columns
  const spacingZ = 18 / Math.ceil(count / columns)
  for (let k = 0; k < count; k++) {
    const x = -14 + (k % columns) * spacingX + (unit(k, 0, 1) - 0.5) * spacingX * 0.5
    const z = -28 + Math.floor(k / columns) * spacingZ + (unit(k, 0, 2) - 0.5) * spacingZ * 0.5
    const i = crowd.spawn(x, z)
    crowd.store.state[i] = STATE.CHASE
  }
  return { crowd, grid, doors, doorIndex, context: { flowTarget: [0, 4], bandCentre: [0, -10] } }
}
