import type { SimInstance, SimModule } from '@adatechnology/game-contracts'
import { createCrowd } from '../crowd'
import type { Crowd } from '../crowd'
import { AGENT_FIELDS, createStore } from '../store'
import type { CrowdStore } from '../store'
import type { CrowdPhysicsOptions } from '../physics/options'
import type { CrowdPack, CrowdTarget } from '../types'

/**
 * The horde as a simulation-thread module (spec 009, T22): the crowd is built and stepped in the simulation thread, and each step writes
 * the store into the snapshot the page draws from (`readHordeSnapshot` copies it into the page's own store). The page sends the target's
 * position and blasts as commands. Deterministic flow (cells per step, not the clock), so the inline loop gives the same bytes.
 */

export interface HordeSimInit {
  readonly pack: CrowdPack
  readonly seed: number
  readonly capacity: number
  readonly physics?: CrowdPhysicsOptions
  /** Agents born at the start, round `spawn` (ring of `radius` m); ignored with `initial`. */
  readonly count: number
  /** The agents to start from instead: a snapshot of the page's store (`writeHordeSnapshot`), the horde the page laid out. */
  readonly initial?: Uint8Array
  readonly spawn: { readonly x: number; readonly z: number; readonly radius: number }
  /** Where the target stands at the start. */
  readonly target: { readonly x: number; readonly z: number }
  /** Flow cells per step (default 20000, the physics' deterministic number). */
  readonly flowCellsPerStep?: number
}

/** The commands of the horde module (first number of each command). */
export const HORDE_COMMAND = {
  /** `[TARGET, x, z, yaw, alive]` */
  TARGET: 1,
  /** `[BLAST, x, y, z, radius, energy J]` */
  BLAST: 2,
} as const

export const HORDE_SIM_ID = 'crowd.horde'

/** The page's handle on a horde in its simulation thread: `startSimThread`'s `SimThread` is one. */
export interface HordeThreadLike {
  latest(): { readonly bytes: Uint8Array } | null
  send(command: ArrayLike<number>): boolean
  dispose(): void
}

// header: Int32 n, frame, kills, target hurt (×1000)
const HEADER = 16
const align8 = (n: number): number => Math.ceil(n / 8) * 8

type Field = { readonly key: keyof CrowdStore; readonly per: number; readonly bytes: number; readonly offset: number }

/** Where each field of the store sits in a snapshot of `capacity` agents (every agent field, then the two per-agent limbs). */
export function hordeSnapshotLayout(store: CrowdStore): { readonly bytes: number; readonly fields: readonly Field[] } {
  let offset = HEADER
  const fields: Field[] = []
  for (const key of [...AGENT_FIELDS, 'armHp', 'legHp'] as const) {
    const array = store[key]
    const per = array.length / store.capacity
    fields.push({ key, per, bytes: array.BYTES_PER_ELEMENT, offset })
    offset = align8(offset + array.byteLength)
  }
  return { bytes: offset, fields }
}

type Typed = Exclude<CrowdStore[keyof CrowdStore], number>
const bytesOf = (array: Typed, count: number): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, count * array.BYTES_PER_ELEMENT)

/** Writes the first `store.n` agents of every field into `out`. */
export function writeHordeSnapshot(store: CrowdStore, out: Uint8Array, header: { readonly frame: number; readonly kills: number; readonly hurt: number }, layout = hordeSnapshotLayout(store)): void {
  const words = new Int32Array(out.buffer, out.byteOffset, HEADER / 4)
  words[0] = store.n
  words[1] = header.frame
  words[2] = header.kills
  words[3] = Math.round(header.hurt * 1000)
  for (const field of layout.fields) out.set(bytesOf(store[field.key] as Typed, store.n * field.per), field.offset)
}

/** Copies a snapshot into `store` (the page's crowd, which the renderer reads); returns the header. */
export function readHordeSnapshot(store: CrowdStore, bytes: Uint8Array, layout = hordeSnapshotLayout(store)): { readonly n: number; readonly frame: number; readonly kills: number; readonly hurt: number } {
  const words = new Int32Array(bytes.buffer, bytes.byteOffset, HEADER / 4)
  const n = words[0]!
  store.n = n
  for (const field of layout.fields) {
    const target = store[field.key] as Typed
    bytesOf(target, n * field.per).set(bytes.subarray(field.offset, field.offset + n * field.per * field.bytes))
  }
  return { n, frame: words[1]!, kills: words[2]!, hurt: words[3]! / 1000 }
}

/** The target in the simulation thread: its place comes in through commands; the damage the horde does to it is summed for the page. */
interface MirrorTarget extends CrowdTarget {
  readonly damage: { total: number }
}
const mirrorTarget = (x: number, z: number): MirrorTarget => {
  const state = { x, z, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 }
  const damage = { total: 0 }
  return {
    state,
    damage,
    grab: (by) => void (state.grabbedBy = by),
    hurt: (amount) => void (damage.total += amount),
    knock: () => {},
    release: () => void (state.grabbedBy = -1),
  }
}

/** Builds the crowd of the module: the same in the simulation thread and in the test's reference. */
export function createHordeCrowd(init: HordeSimInit, target: CrowdTarget): Crowd {
  const crowd = createCrowd({
    pack: init.pack,
    seed: init.seed,
    capacity: init.capacity,
    target,
    flow: { cellsPerStep: init.flowCellsPerStep ?? 20000 },
    ...(init.physics ? { physics: { ...init.physics, worker: 'off' } } : {}),
  })
  if (init.initial) {
    readHordeSnapshot(crowd.store, init.initial)
    return crowd
  }
  for (let k = 0; k < init.count; k++) {
    const angle = (k / Math.max(1, init.count)) * Math.PI * 2 * 7.31
    const ring = init.spawn.radius * (0.35 + 0.65 * ((k * 0.618034) % 1))
    crowd.spawn(init.spawn.x + Math.cos(angle) * ring, init.spawn.z + Math.sin(angle) * ring)
  }
  return crowd
}

export const hordeSimModule: SimModule<HordeSimInit> = Object.freeze({
  id: HORDE_SIM_ID,
  create(init: HordeSimInit): SimInstance {
    const target = mirrorTarget(init.target.x, init.target.z)
    const crowd = createHordeCrowd(init, target)
    const layout = hordeSnapshotLayout(crowd.store)
    return {
      step(_frame: number, dt: number, commands: readonly Float64Array[]) {
        for (const c of commands) {
          if (c[0] === HORDE_COMMAND.TARGET) {
            target.state.x = c[1]!
            target.state.z = c[2]!
            target.state.yaw = c[3]!
            target.state.alive = c[4] !== 0
          } else if (c[0] === HORDE_COMMAND.BLAST) crowd.blast({ point: [c[1]!, c[2]!, c[3]!], radius: c[4]!, energy: c[5]! })
        }
        crowd.update(dt)
      },
      write(out: Uint8Array, frame: number) {
        writeHordeSnapshot(crowd.store, out, { frame, kills: crowd.stats.kills, hurt: target.damage.total }, layout)
      },
      dispose: () => crowd.dispose(),
    }
  },
})

/** Bytes of one snapshot of a horde of `capacity` agents. */
export function hordeSnapshotBytes(capacity: number): number {
  return hordeSnapshotLayout(createStore(capacity)).bytes
}
