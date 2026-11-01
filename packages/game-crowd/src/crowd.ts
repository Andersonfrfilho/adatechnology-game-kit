import { createCorpseLedger } from '@adatechnology/game-characters'
import type { CorpseLedger } from '@adatechnology/game-characters'

import defaults from './data/defaults.json'
import { createDoors } from './doors'
import type { Doors } from './doors'
import { createNavGrid } from './grid'
import type { NavGrid } from './grid'
import { unit, SALT } from './identity'
import { createPhysics } from './physics/engine'
import { COLLAPSE_MARK, collapsePileColumns } from './physics/pile-column'
import type { PileColumn } from './physics/pile-column'
import { seatPhysics } from './physics/seat'
import { DETERMINISTIC_FLOW_CELLS, resolvePhysics } from './physics/options'
import type { CrowdPhysicsOptions } from './physics/options'
import { createPhysicsStats } from './physics/context'
import type { PhysicsStats } from './physics/context'
import type { ThrownPool } from './physics/thrown'
import { createRng } from './rng'
import { AGENT_FIELDS, createStore } from './store'
import type { CrowdStore } from './store'
import { BALANCE, STATE } from './types'
import type { Corpse, CrowdBlast, CrowdDamageResult, CrowdEventMap, CrowdEventName, CrowdHit, CrowdPack, CrowdTraits, CrowdTarget, CrowdType } from './types'

export type CrowdNumbers = typeof defaults.numbers
export type CrowdBand = { readonly max: number; readonly dt: number }
/** The game's numbers; `bands[3].max` is `Infinity` (JSON keeps it as null). */
export const CROWD_DEFAULTS: { readonly sources: Readonly<Record<string, string>>; readonly bands: readonly CrowdBand[]; readonly numbers: CrowdNumbers } = {
  sources: defaults.sources,
  bands: defaults.bands.map((band) => ({ max: band.max ?? Infinity, dt: band.dt })),
  numbers: defaults.numbers,
}

export type { Corpse } from './types'
/** A custom move: runs on every decision tick after the timed states and before the moves on the target; `true` means it took care of the movement. */
export type CrowdPlugin = {
  readonly id: string
  ability?(crowd: Crowd, i: number, context: { d: number; dx: number; dz: number; tdt: number; band: number; alive: boolean }): boolean
}

/** A migration: `count` agents every `every` s (the first after `numbers.migrationFirst`), born in the box at (x, z) and walking to `goal`. */
export type MigrationOptions = { readonly every: number; readonly count: number; readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly goal: readonly [number, number] }
export type CrowdOptions = {
  readonly pack: CrowdPack
  readonly random?: () => number
  readonly seed?: number
  readonly capacity?: number
  readonly grid?: NavGrid
  readonly doors?: Doors
  /** Water at (x, z): the drowned swim, the charred lose health (the game's `POOL`). */
  readonly water?: (x: number, z: number) => boolean
  readonly numbers?: Partial<CrowdNumbers>
  readonly bands?: readonly CrowdBand[]
  /** Flow field: half window in cells (192), and the clock its time budget reads (default `performance.now`; pass `() => 0` to finish every field in one frame). */
  readonly flow?: { readonly radius?: number; readonly clock?: () => number; /** Flow budget in cells per step instead of the clock: the same field at any frame rate (`physics.deterministic` sets 20000). */ readonly cellsPerStep?: number }
  readonly plugins?: readonly CrowdPlugin[]
  readonly target?: CrowdTarget | null
  /** Contact, pressure, balance, mounds, thrown bodies and personality: all off by default, and then the horde is the game's, bit for bit. */
  readonly physics?: CrowdPhysicsOptions
}

export type CrowdView = { readonly x: number; readonly z: number; readonly yaw: number; readonly far: number }

export type CrowdUpdateContext = {
  readonly target?: CrowdTarget | null
  /** 0 day, 1 night: sight drops by 40% at night. */
  readonly nightFactor?: number
  /** Where the flow field converges (the target by default; the foot of a ladder when the target is on a roof). */
  readonly flowTarget?: readonly [number, number]
  /** Where the viewer looks (yaw: forward is `(-sin, -cos)`); the stalker wakes when the target turns its back. Default: the target's view. */
  readonly viewYaw?: number
  /** Centre of the relevance bands, for scenes without a player near the agents (tests, benches, cutscenes). Default: the target, or `flowTarget` without one. */
  readonly bandCentre?: readonly [number, number]
}

export type Crowd = {
  readonly store: CrowdStore
  readonly pack: CrowdPack
  readonly grid: NavGrid
  readonly doors: Doors
  readonly corpses: CorpseLedger<Corpse>
  readonly numbers: CrowdNumbers
  readonly stats: { bands: [number, number, number, number]; slots: number; kills: number; heads: number; physics: PhysicsStats }
  /** Height of the bodies piled per grid cell. */
  readonly pile: Float32Array
  /** Millimetres of lying bodies per navigation cell, recomputed every fixed step (empty with `physics.mound` off). */
  readonly mound: Uint16Array
  /** The thrown bodies of a blast, simulated here and only drawn by the renderer (empty with `physics.thrown` off). */
  readonly thrown: ThrownPool
  /** A blast: queued, and resolved at the start of the next step in one pass over the agents. Without `physics` it only hurts, kills and stuns. */
  blast(blast: CrowdBlast): void
  /** How many agents are steps of a pile now. */
  pileCount(): number
  readonly trail: { x: number; z: number; t: number }[]
  /** Global variant index of each type's variants (G 67079 `ZVAR_OF`). */
  readonly variantsOf: readonly (readonly number[])[]
  target: CrowdTarget | null
  /** The stream every draw takes (the behaviours share it, in the game's order). */
  readonly random: () => number
  /** Emits a `sound` event, as the crowd's own (for the behaviours). */
  sound(id: string, volume: number, x: number, y: number, z: number, distance: number): void
  /** Emits an `effect` event, as the crowd's own (for the behaviours). */
  effect(payload: CrowdEventMap['effect']): void
  typeIndex(id: string): number
  spawn(x: number, z: number, type?: number): number
  remove(i: number): void
  update(dt: number, context?: CrowdUpdateContext): void
  dispose(): void
  emitNoise(x: number, z: number, radius: number): void
  damage(i: number, hit: CrowdHit): CrowdDamageResult
  kill(i: number, headshot?: boolean): void
  /** The blood trail of the target, for the trackers (G 67238 `trailUpdate`). */
  updateTrail(dt: number, target?: CrowdTarget | null): void
  updateCorpses(dt: number): void
  /** Keeps the count near `target` from the edge, removes the excess out of sight and sends a migration now and then (G 67158). */
  updatePopulation(dt: number, view: CrowdView, options?: { readonly target?: number; readonly migration?: MigrationOptions | null }): void
  /** Spawns one agent `minD` to `maxD` m from the target, out of the view (G 67141 `spawnAway`). */
  spawnAway(minD: number, maxD: number, view: CrowdView): number
  /** A blast at the base of a pile undoes it (G 67227 `pileBlast`). */
  pileBlast(x: number, z: number, radius: number): void
  /** The agent hunts something else than the target (a civilian): `game-crowd` civilians set it. */
  setHunt(hunt: ((i: number, tdt: number) => boolean) | null): void
  /** The chase speed of agent `i` now (the stalker's sprint, the drowned in water; G 67343 `zChaseSpeed`). */
  chaseSpeed(i: number): number
  /** The interface `game-player` uses to push, cut and be held by the agents. */
  asPlayerCrowd(): PlayerCrowdLike
  on<K extends CrowdEventName>(event: K, listener: (event: CrowdEventMap[K]) => void): () => void
}

/** The same shape as `game-player`'s `PlayerCrowd` (structural, no dependency). */
export type PlayerCrowdLike = {
  count(): number
  active(i: number): boolean
  x(i: number): number
  z(i: number): number
  y(i: number): number
  floor(i: number): number
  chasing(i: number): boolean
  down(i: number): boolean
  panicWeight(i: number): number
  hold(i: number, x: number, z: number, k: number, lookX: number, lookZ: number): void
  stun(i: number, seconds: number, vx: number, vz: number): void
  chase(i: number, cooldown: number): void
  damage(i: number, hit: { region: number; amount: number; distance: number; cut: number }): void
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
// one shared empty set: the update loop reads the traits of every agent every frame
const NO_TRAITS: CrowdTraits = {}
const TAU_APPROX = 6.2832
const TURN = 6.28

/**
 * The crowd: a literal port of the team game's horde (`jogo.js` G 66714-67430). One struct of arrays, relevance bands R0-R3 with hysteresis, perception
 * by sight, hearing and smell, the sliced flow field, the spatial hash, separation, six attack slots, chain alerts, doors, piles against walls, the
 * abilities as type traits, corpses, the blood trail and the population. Every draw on `random` is in the game's order.
 */
export function createCrowd(options: CrowdOptions): Crowd {
  const random = options.random ?? createRng(options.seed ?? 1)
  const R = random
  const pack = options.pack
  const types: readonly CrowdType[] = pack.types
  const N: CrowdNumbers = { ...CROWD_DEFAULTS.numbers, ...options.numbers }
  const BANDS = options.bands ?? CROWD_DEFAULTS.bands
  const HYST = N.hysteresis
  const grid = options.grid ?? createNavGrid()
  const doors = options.doors ?? createDoors(grid, { random })
  const water = options.water ?? (() => false)
  const plugins = options.plugins ?? []
  const clock = options.flow?.clock ?? (() => (typeof performance === 'undefined' ? Date.now() : performance.now()))
  const FLOW_R = options.flow?.radius ?? N.flowRadius
  const Z = createStore(options.capacity ?? N.capacity)
  const { occ, occH, cellOf, solidAt } = grid
  const HALF = grid.half
  const GC = grid.cell
  const FW = grid.n
  const physics = resolvePhysics(options.physics)
  const flowCells = options.flow?.cellsPerStep ?? (physics.deterministic ? DETERMINISTIC_FLOW_CELLS : undefined)
  const seed32 = (options.seed ?? 1) >>> 0
  let serial = 0
  const moundHeight = new Uint16Array(physics.mound ? FW * FW : 0)
  const moundOn = physics.mound !== null
  const balanceOn = physics.balance !== null
  const staggerSpeed = physics.pressure?.staggerSpeed ?? 1
  const separationMax = physics.contact?.separationMax ?? Infinity
  const RESERVED_SLOTS = 2
  const WALK_DOWN = 0.6
  // the attack pose by distance with hysteresis (in at 1.6 m, out at 2.2 m), squared: the renderer drew it, the simulation reads it
  const ATTACK_ENTER = 2.56
  const ATTACK_LEAVE = 4.84
  const HC = N.hashCell
  const HN = Math.floor(grid.size / HC)
  const hHead = new Int32Array(HN * HN).fill(-1)
  const hNext = new Int32Array(Z.capacity)
  const hashTouched = new Int32Array(Z.capacity)
  let hashTouchedN = 0
  const pile = new Float32Array(FW * FW)
  let pileN = 0
  const flow = {
    dir: new Int8Array(FW * FW * 2),
    back: new Int8Array(FW * FW * 2),
    dist: new Float32Array(FW * FW),
    q: new Int32Array((2 * FLOW_R + 1) ** 2 * 2),
    phase: 0,
    qh: 0,
    qt: 0,
    c: 0,
    t: 0,
    cell: -1,
    ms: 0,
    win: [0, 0, -1, -1],
    winB: [0, 0, -1, -1],
  }
  const catTable: number[] = []
  types.forEach((c, i) => {
    for (let k = 0; k < c.weight; k++) catTable.push(i)
  })
  const variantsOf: number[][] = []
  {
    let next = 0
    types.forEach((type) => {
      const list: number[] = []
      for (let v = 0; v < (type.variants ?? 1); v++) list.push(next++)
      variantsOf.push(list)
    })
  }
  const typeIndexById = new Map(types.map((type, index) => [type.id, index]))
  const noises: { x: number; z: number; r: number }[] = []
  const stats: Crowd['stats'] = { bands: [0, 0, 0, 0], slots: 0, kills: 0, heads: 0, physics: createPhysicsStats() }
  const corpses = createCorpseLedger<Corpse>({ max: N.corpsesMax, seconds: N.corpseSeconds })
  const trail: { x: number; z: number; t: number }[] = []
  let trailLast = { x: 1e9, z: 1e9 }
  const killQ: number[] = []
  let groanBudget = 0
  let migrateT = N.migrationFirst
  let hunt: ((i: number, tdt: number) => boolean) | null = null
  let target: CrowdTarget | null = options.target ?? null
  let nightF = 0
  let viewYaw = 0
  const listeners = new Map<CrowdEventName, Set<(event: never) => void>>()
  const emit = <K extends CrowdEventName>(event: K, payload: CrowdEventMap[K]): void => {
    const set = listeners.get(event)
    if (set) for (const listener of set) (listener as (event: CrowdEventMap[K]) => void)(payload)
  }
  const emitNoise = (x: number, z: number, r: number): void => void noises.push({ x, z, r })
  doors.on('noise', (e) => emitNoise(e.x, e.z, e.radius))
  doors.on('sound', (e) => emit('sound', { ...e, distance: target ? Math.hypot(e.position[0] - target.state.x, e.position[2] - target.state.z) : 0 }))
  doors.on('effect', (e) => emit('effect', e))
  doors.on('broken', (e) => {
    const d = doors.list[e.door]!
    if (target && Math.hypot(d.x - target.state.x, d.z - target.state.z) < N.doorMessageDistance) emit('message', { id: 'door_broken', seconds: 2 })
  })
  const sound = (id: string, volume: number, x: number, y: number, z: number, d: number): void => emit('sound', { sound: id, volume, position: [x, y, z], distance: d })
  const pick = <T extends { p: number }>(list: readonly T[]): T => {
    const r = R()
    let acc = 0
    for (const it of list) {
      acc += it.p
      if (r < acc) return it
    }
    return list[0]!
  }
  const T = (i: number): CrowdType => types[Z.type[i]!]!
  const traits = (i: number): CrowdTraits => T(i).traits ?? NO_TRAITS

  // ----- spawn and removal -----
  const special = (i: number): void => {
    const tr = traits(i)
    Z.y[i] = 0
    Z.floor[i] = 0
    Z.floorLocked[i] = 0
    Z.vy[i] = 0
    Z.abilityTimer[i] = 0
    Z.eaten[i] = 0
    Z.stuck[i] = 0
    Z.stepCell[i] = -1
    Z.burn[i] = 0
    Z.hunts[i] = -1
    Z.named[i] = -1
    if (tr.color !== undefined && !tr.submerged) {
      Z.color[i] = tr.color
      if (tr.skin !== undefined) Z.skin[i] = tr.skin
    }
    if (tr.ambush && R() < tr.ambush.chance) {
      Z.state[i] = STATE.DORMANT
      Z.yaw[i] = R() * TURN
    }
    if (tr.submerged) {
      Z.state[i] = STATE.DORMANT
      Z.y[i] = tr.submerged.depth
      if (tr.color !== undefined) Z.color[i] = tr.color
    }
  }

  const spawn = (x: number, z: number, catForce = -1): number => {
    if (Z.n >= Z.capacity) return -1
    const i = Z.n++
    const c = catForce >= 0 ? catForce : catTable[Math.floor(R() * catTable.length)]!
    const C = types[c]!
    const ai = pack.ages.indexOf(pick(pack.ages))
    const maxAge = C.traits?.maxAge
    const A = pack.ages[maxAge !== undefined ? Math.min(ai, maxAge) : ai]!
    const ri = pack.outfits.indexOf(pick(pack.outfits))
    const RO = pack.outfits[ri]!
    Z.x[i] = x
    Z.z[i] = z
    Z.vx[i] = Z.vz[i] = 0
    Z.type[i] = c
    Z.age[i] = pack.ages.indexOf(A)
    Z.outfit[i] = ri
    const g = (R() + R() + R() - 1.5) * 0.09
    Z.height[i] = clamp(1 + g, 0.9, 1.1) * (C.scale || 1)
    const bb = R()
    Z.build[i] = (bb < 0.3 ? 0.85 + R() * 0.1 : bb < 0.8 ? 0.95 + R() * 0.13 : 1.08 + R() * 0.17) * (C.build || (C.scale ? 1.3 : 1))
    const heavy = bb >= 0.8
    const thin = bb < 0.3
    Z.chaseSpeed[i] = C.speed.chase * A.speed * (thin ? 1.05 : heavy ? 0.9 : 1) * (0.92 + R() * 0.16)
    Z.wanderSpeed[i] = C.speed.wander * A.speed * (0.8 + R() * 0.4)
    Z.hpMax[i] = Z.hp[i] = C.health * A.health * (thin ? 0.9 : heavy ? 1.15 : 1)
    Z.headHp[i] = pack.segments.head
    Z.armHp[i * 2] = Z.armHp[i * 2 + 1] = pack.segments.arm
    Z.legHp[i * 2] = Z.legHp[i * 2 + 1] = pack.segments.leg
    Z.missing[i] = 0
    Z.helmet[i] = RO.helmet ? 1 : 0
    Z.crawl[i] = C.crawls ? 1 : 0
    Z.limp[i] = 0
    Z.state[i] = 0
    Z.stateTimer[i] = 0
    Z.lost[i] = 0
    Z.attackTimer[i] = R()
    Z.alertIn[i] = 0
    Z.cooldown[i] = 0
    {
      const vs = variantsOf[c]!
      Z.variant[i] = vs[Math.floor(R() * vs.length)]!
    }
    Z.yaw[i] = Z.renderYaw[i] = R() * TURN
    Z.renderSpeed[i] = 0
    Z.steering[i] = 0
    Z.pause[i] = 0
    Z.attackPose[i] = 0
    Z.arms[i] = 0
    Z.phase[i] = R() * 10
    Z.band[i] = 3
    Z.next[i] = R() * 0.05
    Z.wx[i] = x
    Z.wz[i] = z
    Z.color[i] = RO.color || pack.palette[Math.floor(R() * pack.palette.length)]!
    Z.skin[i] = R()
    seatPhysics(Z, i, { seed: seed32, serial: serial++, baseMass: physics.contact?.baseMass ?? 70, personality: physics.personality })
    special(i)
    emit('spawn', { agent: i, type: C.id })
    return i
  }

  const remove = (i: number): void => {
    if (Z.state[i] === STATE.PILE_STEP) {
      if (engine.active) releasePileStep(i)
      else stepRelease(i)
    }
    const j = --Z.n
    engine.remap(i, j)
    if (i === j) {
      emit('remove', { agent: i, moved: -1 })
      return
    }
    for (const k of AGENT_FIELDS) (Z[k] as { [index: number]: number })[i] = (Z[k] as { [index: number]: number })[j]!
    Z.armHp[i * 2] = Z.armHp[j * 2]!
    Z.armHp[i * 2 + 1] = Z.armHp[j * 2 + 1]!
    Z.legHp[i * 2] = Z.legHp[j * 2]!
    Z.legHp[i * 2 + 1] = Z.legHp[j * 2 + 1]!
    if (target) {
      if (target.state.grabbedBy === j) target.state.grabbedBy = i
      else if (target.state.grabbedBy === i) target.state.grabbedBy = -1
    }
    emit('remove', { agent: i, moved: j })
  }

  // ----- the sliced flow field (no spike) -----
  const flowStart = (x: number, z: number): void => {
    const gx = clamp(Math.floor((x + HALF) / GC), 0, FW - 1)
    const gz = clamp(Math.floor((z + HALF) / GC), 0, FW - 1)
    const W = flow.winB
    W[0] = Math.max(0, gx - FLOW_R)
    W[1] = Math.max(0, gz - FLOW_R)
    W[2] = Math.min(FW - 1, gx + FLOW_R)
    W[3] = Math.min(FW - 1, gz + FLOW_R)
    for (let r = W[1]; r <= W[3]; r++) flow.dist.fill(1e9, r * FW + W[0], r * FW + W[2] + 1)
    const s = gz * FW + gx
    flow.dist[s] = 0
    flow.q[0] = s
    flow.qh = 0
    flow.qt = 1
    flow.phase = 1
    flow.c = 0
    flow.t = 0
  }
  const flowStep = (budget: number, cellsPerStep?: number): void => {
    if (!flow.phase) return
    const t0 = clock()
    let cellsLeft = cellsPerStep ?? Infinity
    const D = flow.dist
    const Q = flow.q
    const F = flow.back
    const W = flow.winB
    let n = 0
    while (flow.phase === 1) {
      if (flow.qh >= flow.qt) {
        flow.phase = 2
        break
      }
      if (--cellsLeft < 0) return
      const c = Q[flow.qh++]!
      const cx = c % FW
      const cz = (c / FW) | 0
      const dc = D[c]!
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue
          const nx = cx + dx
          const nz = cz + dz
          if (nx < W[0]! || nz < W[1]! || nx > W[2]! || nz > W[3]!) continue
          const k = nz * FW + nx
          if (occ[k] && occ[k]! < 3) continue
          if (dx && dz && ((occ[cz * FW + nx] && occ[cz * FW + nx]! < 3) || (occ[nz * FW + cx] && occ[nz * FW + cx]! < 3))) continue
          const nd = dc + (dx && dz ? 1.414 : 1)
          if (nd < D[k]! - 1e-3) {
            D[k] = nd
            if (flow.qt < Q.length) Q[flow.qt++] = k
          }
        }
      if (cellsPerStep === undefined && (++n & 2047) === 0 && clock() - t0 > budget) {
        flow.t += clock() - t0
        return
      }
    }
    const ww = W[2]! - W[0]! + 1
    while (flow.phase === 2) {
      if (--cellsLeft < 0) return
      const j = flow.c++
      if (j >= ww * (W[3]! - W[1]! + 1)) {
        const tmp = flow.dir
        flow.dir = F
        flow.back = tmp
        const tw = flow.win
        flow.win = W
        flow.winB = tw
        flow.phase = 0
        flow.ms = flow.t + clock() - t0
        return
      }
      const cx = W[0]! + (j % ww)
      const cz = W[1]! + ((j / ww) | 0)
      const c = cz * FW + cx
      if (occ[c] && occ[c]! < 3) {
        F[c * 2] = F[c * 2 + 1] = 0
        continue
      }
      let best = D[c]!
      let bx = 0
      let bz = 0
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          const nz = cz + dz
          if (nx < W[0]! || nz < W[1]! || nx > W[2]! || nz > W[3]!) continue
          const d = D[nz * FW + nx]!
          if (d < best) {
            best = d
            bx = dx
            bz = dz
          }
        }
      F[c * 2] = bx
      F[c * 2 + 1] = bz
      if (cellsPerStep === undefined && (j & 8191) === 0 && clock() - t0 > budget) {
        flow.t += clock() - t0
        return
      }
    }
  }
  const losClear = grid.losClear

  // ----- piles against walls -----
  const groundAt = (c: number, _y: number): number => {
    if (c < 0) return 0
    const k = occ[c]
    if (k === 2 || (k === 1 && occH[c]! <= _y + 0.05)) return occH[c]!
    return moundOn ? pile[c]! + moundHeight[c]! / 1000 : pile[c]!
  }
  const blockedAt = (i: number, x: number, z: number): boolean => {
    const c = cellOf(x, z)
    if (c < 0) return true
    const k = occ[c]
    const y = Z.y[i]!
    if (k === 0 || k === 3) return (moundOn ? pile[c]! + moundHeight[c]! / 1000 : pile[c]!) > y + 0.5 && Z.state[i] !== STATE.AIRBORNE
    if (k === 2 && y + 0.5 >= occH[c]!) return false
    if (Z.state[i] === STATE.AIRBORNE && occH[c]! <= y) return false
    return true
  }
  const tryStep = (i: number, hitCell: number): boolean => {
    if (pileN >= N.pileMax) return false
    const c = cellOf(Z.x[i]!, Z.z[i]!)
    if (c < 0 || occ[c] !== 0) return false
    const dir = hitCell - c
    const w = c + dir
    const back = c - dir
    const h = pile[c]! + N.pileStep
    if (h > N.pileTop) return false
    const cap = occ[w] === 2 ? (back >= 0 ? pile[back]! : 0) + 1.0 : pile[w]!
    if (h > cap + 1e-3) return false
    pile[c] = h
    pileN++
    Z.state[i] = STATE.PILE_STEP
    Z.stepCell[i] = c
    Z.stepDir[i] = dir
    Z.vx[i] = Z.vz[i] = 0
    Z.y[i] = h - N.pileStep
    Z.stateTimer[i] = 6 + R() * 6
    return true
  }
  function stepRelease(i: number): void {
    const c = Z.stepCell[i]!
    if (c >= 0) {
      pile[c] = Math.max(0, pile[c]! - N.pileStep)
      pileN = Math.max(0, pileN - 1)
    }
    Z.stepCell[i] = -1
    Z.state[i] = STATE.CHASE
    Z.stuck[i] = 0
  }
  const pileBlast = (x: number, z: number, r: number): void => {
    for (let i = 0; i < Z.n; i++)
      if (Z.state[i] === STATE.PILE_STEP && (Z.x[i]! - x) ** 2 + (Z.z[i]! - z) ** 2 < r * r) {
        stepRelease(i)
        Z.state[i] = STATE.STUNNED
        Z.stateTimer[i] = 1.2
      }
  }

  // a pile step that falls, flies or dies takes the steps behind it in its column down with it (the pile is not a wall that stays up without them)
  const pileColumns: PileColumn[] = []
  const releasePileStep = (i: number): void => {
    if (Z.stepCell[i]! >= 0) pileColumns.push({ cell: Z.stepCell[i]!, dir: Z.stepDir[i]! })
    stepRelease(i)
  }
  // ----- alerts -----
  const voice = (i: number): string => traits(i).voice ?? 'groan'
  const groan = (i: number, d: number): void => {
    // chain alert: 8 m, 0.2-0.6 s per hop
    const r2 = N.alertRadius * N.alertRadius
    for (let j = 0; j < Z.n; j++) {
      if (Z.state[j] !== 0 || Z.alertIn[j]! > 0) continue
      const ex = Z.x[j]! - Z.x[i]!
      const ez = Z.z[j]! - Z.z[i]!
      if (ex * ex + ez * ez < r2) Z.alertIn[j] = N.alertDelay + R() * N.alertDelayRandom
    }
    emit('alert', { agent: i })
    if (d < N.voiceDistance && groanBudget <= 0) {
      sound(voice(i), 1, Z.x[i]!, Z.height[i]! * 1.6, Z.z[i]!, d)
      groanBudget = N.voiceEvery
    }
  }
  const screamAt = (i: number, x: number, z: number): void => {
    const tr = traits(i).caller!
    sound('scream_hoarse', 1, x, 1.6, z, target ? Math.hypot(x - target.state.x, z - target.state.z) : 0)
    for (let j = 0; j < Z.n; j++) {
      const ex = Z.x[j]! - x
      const ez = Z.z[j]! - z
      if (ex * ex + ez * ez < tr.radius * tr.radius) {
        Z.state[j] = STATE.CHASE
        Z.lost[j] = 0
      }
    }
    if (target) target.state.screamBoost = tr.boost
    emit('message', { id: 'called', seconds: 3, type: T(i).id })
    emit('scream', { agent: i, x, z })
  }

  // ----- attack on the target -----
  const attack = (i: number, d: number, tdt: number): void => {
    Z.attackTimer[i]! -= tdt
    if (Z.attackTimer[i]! > 0) return
    Z.attackTimer[i] = N.attackEvery / Z.aggression[i]!
    const C = T(i)
    const tr = C.traits ?? NO_TRAITS
    if (tr.heavySwing && R() < tr.heavySwing.chance) {
      Z.state[i] = STATE.SWING
      Z.stateTimer[i] = tr.heavySwing.windUp
      return
    }
    const noJaw = Z.missing[i]! & 512
    const noArms = (Z.missing[i]! & 6) === 6
    const P = target!
    if (P.state.grabbedBy < 0 && !noArms && !Z.crawl[i] && R() < C.bite * (P.state.crouch ? N.crouchBite : 1) * Z.aggression[i]!) {
      P.grab(i, !!noJaw, !!tr.drownGrab && water(P.state.x, P.state.z))
      Z.state[i] = STATE.GRAB
    } else {
      P.hurt(C.damage * (Z.crawl[i] ? N.crawlDamage : 1), i)
      if (tr.burns && Z.abilityTimer[i]! >= 0) P.state.burnTimer = tr.burns.seconds
    }
    void d
  }

  // ----- damage (G 67010 zDamage) -----
  const effect = (payload: CrowdEventMap['effect']): void => emit('effect', payload)
  const blood = (x: number, y: number, z: number, age: number, amount: number, died: boolean, agent?: number): void => effect({ effect: 'blood', point: [x, y, z], age, amount, died, ...(agent === undefined ? {} : { agent }) })
  /** `draw` is the source of the jaw draw (and of the corpse seed of a death); a death waits for the end of the step when `deferDeath` is on. */
  const damageWith = (i: number, hit: CrowdHit, draw: () => number, deferDeath = false): CrowdDamageResult => {
    const C = T(i)
    const A = pack.ages[Z.age[i]!]!
    const RO = pack.outfits[Z.outfit[i]!]!
    const cal = hit.caliber ?? null
    const proj = !!cal
    const dano = hit.amount
    const dist = hit.distance
    const corte = hit.cut ?? 0
    const regiao = hit.region
    let morreu = false
    let headshot = false
    if (regiao === 0) {
      if (proj && Z.helmet[i] && cal!.class === 'pistol') {
        Z.helmet[i] = 0
        effect({ effect: 'spark', point: [Z.x[i]!, Z.height[i]! * 1.75, Z.z[i]!], agent: i })
        sound('impact', 1, Z.x[i]!, Z.height[i]! * 1.75, Z.z[i]!, dist)
        return { died: false }
      }
      const mata = proj ? (cal!.skull === 1 || dist <= cal!.skull) && dano >= N.skullMinDamage : dano * 3 >= Z.headHp[i]!
      if (mata) {
        morreu = true
        headshot = true
        if (dano > N.skullTakeDamage || (cal && N.skullTakeWithin[cal.id as keyof typeof N.skullTakeWithin] !== undefined && dist < N.skullTakeWithin[cal.id as keyof typeof N.skullTakeWithin]!)) Z.missing[i]! |= 1
      } else {
        Z.hp[i]! -= dano * 3
        Z.headHp[i]! -= dano
        if (dano > N.jawDamage && draw() < N.jawChance) Z.missing[i]! |= 512
      }
    } else if (regiao === 1) {
      let m = C.multipliers.torso
      if (RO.vest && proj) m *= cal!.class === 'pistol' ? RO.vest.pistol : RO.vest.rifle
      Z.hp[i]! -= dano * m
    } else {
      const perna = regiao >= 4
      const lado = regiao & 1
      const mm = (perna ? C.multipliers.legs : C.multipliers.arms) * A.limb * (RO.limb || 1)
      const segArr = perna ? Z.legHp : Z.armHp
      const k = i * 2 + (perna ? lado : regiao === 3 ? 1 : 0)
      segArr[k]! -= dano * mm
      Z.hp[i]! -= dano * mm * 0.5
      const max = perna ? pack.segments.leg : pack.segments.arm
      if (perna && segArr[k]! <= max * 0.5) Z.limp[i] = 1
      if (segArr[k]! <= 0) {
        const arranca = corte >= 0.5 || dano * mm > max * 0.9
        if (perna) {
          Z.crawl[i] = 1
          if (arranca) Z.missing[i]! |= lado ? 16 : 8
          else Z.missing[i]! |= lado ? 256 : 128
        } else if (arranca) Z.missing[i]! |= regiao === 3 ? 4 : 2
        else Z.missing[i]! |= regiao === 3 ? 64 : 32
        effect({ effect: 'limb', point: [Z.x[i]!, Z.height[i]! * (perna ? 0.5 : 1.2), Z.z[i]!], agent: i, region: regiao, severed: arranca })
      }
    }
    if (Z.hp[i]! <= 0) morreu = true
    blood(Z.x[i]!, regiao === 0 ? Z.height[i]! * 1.65 : regiao === 1 ? Z.height[i]! * 1.2 : Z.height[i]! * 0.7, Z.z[i]!, Z.age[i]!, regiao === 0 ? 120 : 30, morreu, i)
    if (morreu) {
      if (deferDeath) deferKill(i)
      else kill(i, headshot, draw)
      return { died: morreu, headshot }
    }
    const st = Z.state[i]
    if (dano >= N.hitStunDamage && st !== STATE.GRAB && st !== STATE.PILE_STEP && st !== STATE.AIRBORNE) {
      Z.state[i] = STATE.STUNNED
      Z.stateTimer[i] = C.traits?.hitStun ?? N.hitStun
    }
    const st2 = Z.state[i]
    if (st2 === 0 || st2 === STATE.DORMANT || st2 === STATE.EATING || st2 === STATE.SEEKING_SOUND) {
      Z.state[i] = STATE.CHASE
      Z.lost[i] = 0
      const sub = C.traits?.submerged
      if (sub) Z.y[i] = Math.max(Z.y[i]!, sub.surface)
    }
    return { died: morreu }
  }
  const damage = (i: number, hit: CrowdHit): CrowdDamageResult => damageWith(i, hit, R)
  function kill(i: number, headshot = false, draw: () => number = R): void {
    stats.kills++
    if (headshot) stats.heads++
    const tr = traits(i)
    if (tr.burst) burstAt(i, Z.x[i]!, Z.z[i]!)
    const C = T(i)
    emit('kill', { agent: i, type: C.id, headshot, x: Z.x[i]!, z: Z.z[i]! })
    if (Z.balance[i] !== BALANCE.THROWN) corpseAdd(i, draw)
    if (target && target.state.grabbedBy === i) target.release()
    remove(i)
  }
  const burstAt = (i: number, x: number, z: number): void => {
    const b = traits(i).burst!
    effect({ effect: 'cloud', point: [x, 0, z], radius: 4, color: b.cloudColor, amount: 8 })
    effect({ effect: 'blood', point: [x, 1.0, z], amount: 1500, died: true, color: b.bloodColor })
    if (target) {
      const d = Math.hypot(x - target.state.x, z - target.state.z)
      if (d < b.radius) {
        target.state.blind = b.blind
        target.state.scentTimer = b.scent
        emit('message', { id: 'burst_hit', seconds: 2.5, type: T(i).id })
        emitNoise(target.state.x, target.state.z, b.noiseNear)
      }
    }
    emitNoise(x, z, b.noise)
  }

  // ----- corpses -----
  const corpseOf = (i: number, seed: number): Corpse => ({
    x: Z.x[i]!,
    z: Z.z[i]!,
    yaw: Z.renderYaw[i]!,
    height: Z.height[i]!,
    build: Z.build[i]!,
    named: Z.named[i]!,
    missing: Z.missing[i]!,
    color: Z.color[i]!,
    variant: Z.variant[i]!,
    skin: Z.skin[i]!,
    seed,
  })
  const corpseAdd = (i: number, draw: () => number = R): void => void corpses.add(corpseOf(i, draw() * 10))

  // ----- abilities (G 67265 zAbility). true: it took care of the movement -----
  const ability = (i: number, d: number, dx: number, dz: number, tdt: number, b: number, alive: boolean): boolean => {
    const C = T(i)
    const tr = C.traits ?? NO_TRAITS
    const st = Z.state[i]
    const P = target
    // dormant: the stalker wakes under 3 m or with the target's back turned within 10 m; the drowned rises at 5 m
    if (st === STATE.DORMANT) {
      Z.vx[i] = Z.vz[i] = 0
      if (!alive || b > 1) return true
      if (tr.submerged) {
        if (d < tr.submerged.wake) {
          Z.state[i] = STATE.CHASE
          groan(i, d)
          sound('step', 2, Z.x[i]!, 0, Z.z[i]!, d)
        }
        return true
      }
      const am = tr.ambush
      const wake = am?.wake ?? N.dormantWake
      const behind = am?.wakeBehind ?? N.dormantWakeBehind
      const fx = -Math.sin(viewYaw)
      const fz = -Math.cos(viewYaw)
      const costas = (dx * fx + dz * fz) / (d || 1) < (am?.behindCos ?? -0.3)
      if (d < wake || (costas && d < behind)) {
        Z.state[i] = STATE.CHASE
        Z.abilityTimer[i] = am?.sprintSeconds ?? 3
        Z.lost[i] = 0
        sound('runner_groan', 1, Z.x[i]!, 1.6, Z.z[i]!, d)
      }
      return true
    }
    if (st === STATE.AIRBORNE || st === STATE.PILE_STEP) return true
    if (st === STATE.SWELLING) {
      Z.vx[i] = Z.vz[i] = 0
      return true
    }
    if (st === STATE.SWING) {
      Z.vx[i] = Z.vz[i] = 0
      Z.stateTimer[i]! -= tdt
      if (Z.stateTimer[i]! <= 0) {
        const hs = tr.heavySwing!
        Z.state[i] = STATE.CHASE
        Z.attackTimer[i] = 2
        sound('impact', 1.4, Z.x[i]!, 1, Z.z[i]!, d)
        if (d < hs.range && alive && P) {
          P.hurt(C.damage, i)
          P.knock(hs.knock)
          emit('message', { id: 'swing_knock', seconds: 1.5, type: C.id })
        }
      }
      return true
    }
    if (st === STATE.EATING) {
      const ec = tr.eatsCorpses!
      Z.vx[i] = Z.vz[i] = 0
      Z.stateTimer[i]! -= tdt
      if (alive && d < ec.defend) {
        Z.state[i] = STATE.CHASE
        Z.lost[i] = 0
        groan(i, d)
        return false
      } // defends the food
      if (Z.stateTimer[i]! <= 0) {
        let best = -1
        let bd = ec.grabRange
        const list = corpses.entries
        for (let k = 0; k < list.length; k++) {
          const e = Math.hypot(list[k]!.data.x - Z.x[i]!, list[k]!.data.z - Z.z[i]!)
          if (e < bd) {
            bd = e
            best = k
          }
        }
        if (best >= 0) {
          corpses.remove(best)
          Z.hp[i]! += ec.health
          Z.hpMax[i]! += ec.health
          Z.height[i]! *= ec.grow
          Z.build[i]! *= ec.grow
          Z.eaten[i]!++
        }
        Z.state[i] = 0
        Z.abilityTimer[i] = ec.rest
      }
      return true
    }
    if (st === STATE.SEEKING_SOUND) {
      const ss = tr.soundSeeker ?? { arrive: 1, loseChase: 3, hitRadius2: 1.1 }
      if (alive && d < 2.5) {
        Z.state[i] = STATE.CHASE
        return false
      }
      const wx = Z.wx[i]! - Z.x[i]!
      const wz = Z.wz[i]! - Z.z[i]!
      const wl = Math.hypot(wx, wz)
      if (wl < ss.arrive) {
        Z.state[i] = 0
        return false
      }
      Z.vx[i] = (wx / wl) * Z.chaseSpeed[i]!
      Z.vz[i] = (wz / wl) * Z.chaseSpeed[i]!
      Z.yaw[i] = Math.atan2(wx, wz)
      // hits whatever it meets on the way, other agents too
      if (b === 0) {
        Z.attackTimer[i]! -= tdt
        if (Z.attackTimer[i]! <= 0) {
          const hx = Math.floor(Z.x[i]! + HALF)
          const hz = Math.floor(Z.z[i]! + HALF)
          if (hx >= 0 && hz >= 0 && hx < HN && hz < HN)
            for (let j = hHead[hz * HN + hx]!; j !== -1; j = hNext[j]!) {
              if (j !== i && (Z.x[j]! - Z.x[i]!) ** 2 + (Z.z[j]! - Z.z[i]!) ** 2 < ss.hitRadius2) {
                Z.attackTimer[i] = N.attackEvery
                hurtOther(j, C.damage)
                break
              }
            }
        }
      }
      return true
    }
    // custom moves (none in the game): after the timed states, before the moves on the target, with or without a target
    for (const plugin of plugins) if (plugin.ability?.(crowd, i, { d, dx, dz, tdt, band: b, alive })) return true
    if (!alive) return false
    if (Z.hunts[i]! >= 0 && st <= 1 && hunt) return hunt(i, tdt)
    // the blind one does not follow the target across the map: it only goes where it heard
    if (tr.soundSeeker && st === STATE.CHASE && d > tr.soundSeeker.loseChase) {
      Z.state[i] = STATE.SEEKING_SOUND
      Z.wx[i] = P!.state.x
      Z.wz[i] = P!.state.z
      return false
    }
    // pounce up to 6 m, 5 s cooldown
    const po = tr.pounce
    if (po && st === STATE.CHASE && Z.cooldown[i]! <= 0 && d > po.min && d < po.max && b === 0 && losClear(Z.x[i]!, Z.z[i]!, P!.state.x, P!.state.z)) {
      const sp = Math.min(po.speedCap, d / po.time)
      Z.state[i] = STATE.AIRBORNE
      Z.vy[i] = P!.state.y > po.highAbove ? po.liftHigh : po.lift
      Z.vx[i] = (-dx / d) * sp
      Z.vz[i] = (-dz / d) * sp
      Z.yaw[i] = Math.atan2(-dx, -dz)
      Z.cooldown[i] = po.cooldown
      Z.abilityTimer[i] = 1
      sound('runner_groan', 1, Z.x[i]!, 1.6, Z.z[i]!, d)
      return true
    }
    // the bloater swells 0.5 s and bursts when close
    if (tr.burst && st === STATE.CHASE && d < tr.burst.range) {
      Z.state[i] = STATE.SWELLING
      Z.stateTimer[i] = tr.burst.swell
      sound('flesh', 1.2, Z.x[i]!, 1, Z.z[i]!, d)
      return true
    }
    // the devourer looks for corpses (up to 3)
    const ec = tr.eatsCorpses
    if (ec && st === 0 && Z.eaten[i]! < ec.max && Z.abilityTimer[i]! <= 0 && corpses.count) {
      let best = -1
      let bd = ec.search
      const list = corpses.entries
      for (let k = 0; k < list.length; k++) {
        const e = Math.hypot(list[k]!.data.x - Z.x[i]!, list[k]!.data.z - Z.z[i]!)
        if (e < bd) {
          bd = e
          best = k
        }
      }
      if (best >= 0) {
        if (bd < ec.reach) {
          Z.state[i] = STATE.EATING
          Z.stateTimer[i] = ec.seconds
          Z.vx[i] = Z.vz[i] = 0
          return true
        }
        const cp = list[best]!.data
        const ex = cp.x - Z.x[i]!
        const ez = cp.z - Z.z[i]!
        const sp = Z.wanderSpeed[i]! * ec.approach
        Z.vx[i] = (ex / bd) * sp
        Z.vz[i] = (ez / bd) * sp
        Z.yaw[i] = Math.atan2(ex, ez)
        Z.wx[i] = cp.x
        Z.wz[i] = cp.z
        return true
      } else Z.abilityTimer[i] = ec.retry
    }
    // the tracker follows the blood trail and leads up to 8 of its kind
    const tk = tr.tracker
    if (tk && st === 0 && trail.length) {
      let best: { x: number; z: number } | null = null
      for (let k = trail.length - 1; k >= 0; k--) {
        const p = trail[k]!
        if ((p.x - Z.x[i]!) ** 2 + (p.z - Z.z[i]!) ** 2 < tk.range * tk.range) {
          best = p
          break
        }
      }
      if (best) {
        Z.wx[i] = best.x
        Z.wz[i] = best.z
        let led = 0
        const leads = typeIndexById.get(tk.leads) ?? -1
        for (let j = 0; j < Z.n && led < tk.max; j++)
          if (Z.type[j] === leads && Z.state[j] === 0 && (Z.x[j]! - Z.x[i]!) ** 2 + (Z.z[j]! - Z.z[i]!) ** 2 < tk.leadRadius * tk.leadRadius) {
            Z.wx[j] = Z.x[i]!
            Z.wz[j] = Z.z[i]!
            led++
          }
      }
    }
    return false
  }
  const chaseSpeed = (i: number): number => {
    const tr = traits(i)
    if (tr.ambush) return Z.abilityTimer[i]! > 0 ? tr.ambush.sprint : tr.ambush.slow
    if (tr.submerged && water(Z.x[i]!, Z.z[i]!)) return tr.submerged.swim
    return Z.chaseSpeed[i]!
  }
  /** The shared stream with the physics off (the game's order); a counter-based draw of the agent with it on. */
  const physicsDraw = (i: number, salt: number): (() => number) => (engine.active ? () => unit(Z.identity[i]!, engine.ctx.step, salt) : R)
  const hurtOther = (j: number, amount: number): void => {
    Z.hp[j]! -= amount
    blood(Z.x[j]!, Z.height[j]! * 1.2, Z.z[j]!, Z.age[j]!, 30, false, j)
    if (Z.hp[j]! <= 0) deferKill(j)
  }
  const deferKill = (j: number): void => {
    if (!killQ.includes(j)) killQ.push(j)
  }
  const killQFlush = (): void => {
    if (!killQ.length) return
    killQ.sort((a, b) => b - a)
    for (const j of killQ) if (j < Z.n) kill(j, false, physicsDraw(j, SALT.CORPSE))
    killQ.length = 0
  }

  // ----- per frame: height (pile, wall, jump), timed states (G 67377 zFrame) -----
  const frame = (i: number, dt: number, d: number, alive: boolean): void => {
    const st = Z.state[i]
    const tr = traits(i)
    if (st === STATE.PILE_STEP) {
      // a step: lets go when the target is gone
      Z.stateTimer[i]! -= dt
      if (!alive || d > N.pileReleaseDistance || Z.stateTimer[i]! <= 0) stepRelease(i)
      return
    }
    if (st === STATE.SWELLING) {
      Z.stateTimer[i]! -= dt
      if (Z.stateTimer[i]! <= 0) deferKill(i)
      return
    }
    if (tr.ambush && Z.abilityTimer[i]! > 0) Z.abilityTimer[i]! -= dt
    if (tr.eatsCorpses && Z.abilityTimer[i]! > 0 && st === 0) Z.abilityTimer[i]! -= dt
    if (tr.waterWeak && Z.abilityTimer[i] === 0 && water(Z.x[i]!, Z.z[i]!)) {
      Z.abilityTimer[i] = -1
      Z.hp[i]! *= tr.waterWeak.keep
      effect({ effect: 'cloud', point: [Z.x[i]!, 0, Z.z[i]!], radius: 1.5, color: tr.waterWeak.cloud, amount: 3, agent: i })
    }
    if (engine.active && (Z.balance[i] === BALANCE.FALLEN || Z.balance[i] === BALANCE.GETTING_UP)) return
    const c = cellOf(Z.x[i]!, Z.z[i]!)
    const gy = groundAt(c, Z.y[i]!)
    if (st === STATE.DORMANT || Z.floorLocked[i]) return
    if (engine.active && st !== STATE.AIRBORNE && Z.vy[i] === 0 && Z.y[i]! > gy + 0.02 && Z.y[i]! - gy <= WALK_DOWN) {
      // down a step of a mound is a walk, not a fall: only a drop above this height (a base that goes) is a fall
      Z.y[i] = Math.max(gy, Z.y[i]! - N.climbSpeed * dt)
      return
    }
    if (st === STATE.AIRBORNE || Z.y[i]! > gy + 0.02 || Z.vy[i]! > 0) {
      Z.vy[i]! -= N.gravity * dt
      Z.y[i]! += Z.vy[i]! * dt
      if (Z.y[i]! <= gy) {
        const fall = -Z.vy[i]!
        Z.y[i] = gy
        Z.vy[i] = 0
        const collapsed = st === STATE.AIRBORNE && Z.stateTimer[i] === COLLAPSE_MARK
        if (collapsed) Z.stateTimer[i] = 0
        if (engine.active && balanceOn && (st !== STATE.AIRBORNE || collapsed)) engine.balance!.landed(i, (fall * fall) / (2 * N.gravity))
        if (st === STATE.AIRBORNE) {
          Z.state[i] = STATE.CHASE
          if (tr.pounce && alive && d < tr.pounce.landRange && target) {
            target.knock(tr.pounce.knock)
            target.hurt(T(i).damage, i)
            emit('message', { id: 'pounce_knock', seconds: 1.5, type: T(i).id })
          }
        } else if (fall > N.fallStun && Z.state[i]! <= 1) {
          Z.state[i] = STATE.STUNNED
          Z.stateTimer[i] = 0.9
        }
      }
    } else if (gy > Z.y[i]!) Z.y[i] = Math.min(gy, Z.y[i]! + N.climbSpeed * dt)
  }

  // ----- the horde update (G 66835 hordeUpdate) -----
  const update = (dt: number, context: CrowdUpdateContext = {}): void => {
    if (context.target !== undefined) target = context.target
    groanBudget -= dt
    nightF = context.nightFactor ?? 0
    const P = target
    const px = P ? P.state.x : (context.flowTarget?.[0] ?? 0)
    const pz = P ? P.state.z : (context.flowTarget?.[1] ?? 0)
    const alive = !!P && P.state.alive && !P.state.turned
    viewYaw = context.viewYaw ?? (P ? P.state.yaw - Math.PI : 0)
    const bandX = context.bandCentre?.[0] ?? px
    const bandZ = context.bandCentre?.[1] ?? pz
    engine.beginStep(dt, { x: bandX, z: bandZ })
    const fx0 = context.flowTarget?.[0] ?? px
    const fz0 = context.flowTarget?.[1] ?? pz
    const pc = cellOf(fx0, fz0)
    if (flow.cell < 0) {
      flowStart(fx0, fz0)
      flowStep(1e9)
      flow.cell = pc
    } else if (pc !== flow.cell && !flow.phase) {
      flowStart(fx0, fz0)
      flow.cell = pc
    }
    flowStep(N.flowBudgetMs, flowCells)
    // spatial hash for R0
    if (engine.active) {
      for (let k = 0; k < hashTouchedN; k++) hHead[hashTouched[k]!] = -1
      hashTouchedN = 0
    } else hHead.fill(-1)
    for (let i = 0; i < Z.n; i++) {
      if (Z.band[i] !== 0 || (engine.active && Z.balance[i] === BALANCE.THROWN)) continue
      const hx = Math.floor(Z.x[i]! + HALF)
      const hz = Math.floor(Z.z[i]! + HALF)
      if (hx < 0 || hz < 0 || hx >= HN || hz >= HN) continue
      const h = hz * HN + hx
      if (engine.active && hHead[h] === -1) hashTouched[hashTouchedN++] = h
      hNext[i] = hHead[h]!
      hHead[h] = i
    }
    const B = stats.bands
    B[0] = B[1] = B[2] = B[3] = 0
    let slots = 0
    const F = flow.dir
    for (let i = 0; i < Z.n; i++) {
      const dx = Z.x[i]! - px
      const dz = Z.z[i]! - pz
      const d = Math.sqrt(dx * dx + dz * dz)
      const bandD = context.bandCentre ? Math.hypot(Z.x[i]! - bandX, Z.z[i]! - bandZ) : d
      let b = Z.band[i]!
      while (b > 0 && bandD < BANDS[b - 1]!.max - HYST) b--
      while (b < 3 && bandD > BANDS[b]!.max + HYST) b++
      Z.band[i] = b
      B[b as 0 | 1 | 2 | 3]++
      if (engine.active && Z.balance[i] === BALANCE.THROWN) continue
      const grounded = engine.active && balanceOn && (Z.balance[i] === BALANCE.FALLEN || Z.balance[i] === BALANCE.GETTING_UP)
      const C = T(i)
      const tr = C.traits ?? NO_TRAITS
      if (Z.state[i] === STATE.STUNNED) {
        Z.stateTimer[i]! -= dt
        if (Z.stateTimer[i]! <= 0) Z.state[i] = STATE.CHASE
        Z.vx[i]! *= 0.9
        Z.vz[i]! *= 0.9
      }
      if (Z.state[i] === STATE.CALLING) {
        Z.stateTimer[i]! -= dt
        Z.vx[i] = Z.vz[i] = 0
        if (Z.stateTimer[i]! <= 0) {
          Z.state[i] = STATE.CHASE
          screamAt(i, Z.x[i]!, Z.z[i]!)
          Z.cooldown[i] = tr.caller!.cooldown
        }
      }
      Z.cooldown[i]! -= dt
      if (Z.alertIn[i]! > 0) {
        Z.alertIn[i]! -= dt
        if (Z.alertIn[i]! <= 0 && Z.state[i] === 0 && !tr.soundSeeker) {
          Z.state[i] = STATE.CHASE
          Z.lost[i] = 0
        }
      }
      if (!grounded) Z.next[i]! -= dt
      else {
        Z.vx[i] = Z.vz[i] = Z.dvx[i] = Z.dvz[i] = Z.aimX[i] = Z.aimZ[i] = 0
        Z.steering[i] = 0
      }
      if (Z.next[i]! <= 0 && !grounded) {
        const tdt = BANDS[b]!.dt
        Z.next[i]! += tdt
        // perception (R0 and R1 only)
        if (alive && b <= 1 && Z.state[i]! <= 1) {
          let sees = false
          const A = pack.ages[Z.age[i]!]!
          const vis = C.perception.sight * (1 - N.nightSight * nightF) * (P!.state.crouch ? N.crouchSight : 1) * A.sight
          if (d < vis) {
            const fx = Math.sin(Z.yaw[i]!)
            const fz = Math.cos(Z.yaw[i]!)
            const cone = (-dx * fx - dz * fz) / (d || 1)
            if ((cone > N.sightCone || d < N.sightNear) && (Z.floor[i] === P!.state.floor || d < 5) && (Z.floor[i] || P!.state.floor || losClear(Z.x[i]!, Z.z[i]!, px, pz))) sees = true
          }
          if (C.perception.smell && d < C.perception.smell * (P!.state.bleeding || P!.state.scentTimer > 0 ? 2 : 1)) sees = true // smell
          if (sees) {
            if (Z.state[i] === 0) groan(i, d)
            Z.state[i] = STATE.CHASE
            Z.lost[i] = 0
          } else if (Z.state[i] === STATE.CHASE) {
            Z.lost[i]! += tdt
            if (Z.lost[i]! > N.loseAfter) {
              Z.state[i] = 0
              Z.wx[i] = px
              Z.wz[i] = pz
            }
          }
        }
        for (let k = 0; k < noises.length && (Z.state[i] === 0 || Z.state[i] === STATE.SEEKING_SOUND); k++) {
          const Nz = noises[k]!
          const hear = Nz.r * (C.perception.hearing / N.hearingBase) * pack.ages[Z.age[i]!]!.hearing
          if ((Z.x[i]! - Nz.x) ** 2 + (Z.z[i]! - Nz.z) ** 2 < hear * hear) {
            if (tr.soundSeeker) {
              Z.state[i] = STATE.SEEKING_SOUND
              Z.wx[i] = Nz.x
              Z.wz[i] = Nz.z
              break
            } // straight to the source
            Z.state[i] = STATE.CHASE
            Z.lost[i] = N.heardLost
            groan(i, d)
          }
        }
        // the caller winds up 1.5 s and calls the crowd within 150 m
        if (tr.caller && Z.state[i] === STATE.CHASE && d < tr.caller.range && Z.cooldown[i]! <= 0) {
          Z.state[i] = STATE.CALLING
          Z.stateTimer[i] = tr.caller.windUp
        }
        Z.steering[i] = 0
        Z.aimX[i] = Z.aimZ[i] = 0
        if (!ability(i, d, dx, dz, tdt, b, alive)) {
          // where it wants to go
          let tx = 0
          let tz = 0
          let sp = 0
          if (Z.state[i] === STATE.CHASE || Z.state[i] === STATE.GRAB) {
            const c = cellOf(Z.x[i]!, Z.z[i]!)
            const sameL = !P || Z.floor[i] === P.state.floor
            if (d < N.directRange && alive && sameL) {
              tx = -dx / (d || 1)
              tz = -dz / (d || 1)
            } else if (c >= 0 && b === 0 && d < N.pyramidRange && sameL && flow.dist[c]! < 1e8 && flow.dist[c]! * GC > d * 2 + 6 && losClear(Z.x[i]!, Z.z[i]!, px, pz)) {
              tx = -dx / d
              tz = -dz / d
            } // the path goes round: straight against the wall (pyramid)
            else if (c >= 0) {
              const W = flow.win
              const cx = c % FW
              const cz = (c / FW) | 0
              if (cx >= W[0]! && cx <= W[2]! && cz >= W[1]! && cz <= W[3]!) {
                tx = F[c * 2]!
                tz = F[c * 2 + 1]!
              } else {
                tx = -dx
                tz = -dz
              } // outside the window: straight at the target
              const l = Math.hypot(tx, tz) || 1
              tx /= l
              tz /= l
            }
            if (tr.caller && Z.cooldown[i]! > tr.caller.fleeAbove && d < tr.caller.fleeRange && alive) {
              tx = dx / (d || 1)
              tz = dz / (d || 1)
            } // runs from the fight after calling
            sp = chaseSpeed(i) * (P && P.state.screamBoost > 0 ? N.screamSpeed : 1)
            if (!alive) sp = Z.wanderSpeed[i]!
            if (d < N.attackRange && alive && Math.abs(P!.state.y - Z.y[i]!) < N.attackHeight) {
              sp = 0
              if (slots < N.attackSlots - (Z.aggression[i]! < 1 ? RESERVED_SLOTS : 0)) {
                slots++
                attack(i, d, tdt)
              }
            }
          } else if (Z.state[i] === 0) {
            const wx = Z.wx[i]! - Z.x[i]!
            const wz = Z.wz[i]! - Z.z[i]!
            const wl = Math.hypot(wx, wz)
            if (wl < 1 || R() < 0.01 * tdt * 60) {
              Z.wx[i] = clamp(Z.x[i]! + (R() - 0.5) * N.wanderSpan, -HALF + 2, HALF - 2)
              Z.wz[i] = clamp(Z.z[i]! + (R() - 0.5) * N.wanderSpan, -HALF + 2, HALF - 2)
            } else {
              tx = wx / wl
              tz = wz / wl
              Z.pause[i]! -= tdt
              if (Z.pause[i]! < -4 - R() * 6) Z.pause[i] = 1 + R() * 2.5
              sp = Z.pause[i]! > 0 ? 0 : Z.wanderSpeed[i]!
            } // pauses of 1 to 3.5 s between walks
          }
          if (Z.crawl[i]) sp = Math.min(sp, N.crawlSpeed)
          else if (Z.limp[i]) sp *= N.limpSpeed
          if (Z.balance[i] === BALANCE.STAGGERING) sp *= staggerSpeed
          // separation from the neighbours
          let sx = 0
          let sz = 0
          if (b === 0) {
            const hx = Math.floor(Z.x[i]! + HALF)
            const hz = Math.floor(Z.z[i]! + HALF)
            for (let oz = -1; oz <= 1; oz++)
              for (let ox = -1; ox <= 1; ox++) {
                const qx = hx + ox
                const qz = hz + oz
                if (qx < 0 || qz < 0 || qx >= HN || qz >= HN) continue
                for (let j = hHead[qz * HN + qx]!; j !== -1; j = hNext[j]!) {
                  if (j === i || Z.state[j] === STATE.PILE_STEP || Z.state[j] === STATE.DORMANT || (balanceOn && (Z.balance[j] === BALANCE.FALLEN || Z.balance[j] === BALANCE.GETTING_UP))) continue
                  const ex = Z.x[i]! - Z.x[j]!
                  const ez = Z.z[i]! - Z.z[j]!
                  const e2 = ex * ex + ez * ez
                  const rr = N.separation * (Z.build[i]! + Z.build[j]!)
                  if (e2 < rr * rr * 1.6 && e2 > 1e-6) {
                    const e = Math.sqrt(e2)
                    const w = (rr * 1.26 - e) / e
                    sx += ex * w
                    sz += ez * w
                  }
                }
              }
          }
          if (Z.state[i]! <= 2) {
            if (separationMax !== Infinity) {
              const push = Math.hypot(sx, sz) * N.separationPush
              if (push > separationMax) {
                sx *= separationMax / push
                sz *= separationMax / push
              }
            }
            if (engine.active && sp > 0.05) {
              Z.aimX[i] = tx
              Z.aimZ[i] = tz
            }
            Z.dvx[i] = tx * sp + sx * N.separationPush
            Z.dvz[i] = tz * sp + sz * N.separationPush
            Z.steering[i] = 1
            if (sp > 0.05) Z.yaw[i] = Math.atan2(tx, tz)
            else if (d < 3 && alive) Z.yaw[i] = Math.atan2(-dx, -dz)
          }
        }
      }
      // integrates every frame (the wanted speed arrives in ~0.15 s, no jerk)
      if (Z.steering[i] && Z.state[i]! <= 2) {
        const k = 1 - Math.exp(-dt * (b === 0 ? 9 : 5))
        Z.vx[i]! += (Z.dvx[i]! - Z.vx[i]!) * k
        Z.vz[i]! += (Z.dvz[i]! - Z.vz[i]!) * k
      }
      const nx = Z.x[i]! + (Z.vx[i]! + Z.pushX[i]!) * dt
      const nz = Z.z[i]! + (Z.vz[i]! + Z.pushZ[i]!) * dt
      let hitCell = -1
      if (!blockedAt(i, nx, Z.z[i]!)) Z.x[i] = nx
      else {
        if (Z.state[i] !== STATE.AIRBORNE) Z.vx[i] = Z.pushX[i] = 0
        hitCell = cellOf(nx, Z.z[i]!)
      }
      if (!blockedAt(i, Z.x[i]!, nz)) Z.z[i] = nz
      else {
        if (Z.state[i] !== STATE.AIRBORNE) Z.vz[i] = Z.pushZ[i] = 0
        hitCell = cellOf(Z.x[i]!, nz)
      }
      if (hitCell >= 0 && Z.state[i] === STATE.CHASE && b === 0) {
        // runners and leapers jump a low obstacle (car, yard wall)
        const vl = tr.vaultsLow
        if (vl && occ[hitCell] !== 5 && occH[hitCell]! <= vl.maxHeight && occH[hitCell]! > Z.y[i]! + vl.minRise) {
          Z.state[i] = STATE.AIRBORNE
          Z.vy[i] = Math.sqrt(2 * N.gravity * (occH[hitCell]! - Z.y[i]! + vl.clearance))
          const s2 = Z.chaseSpeed[i]! * vl.speedFactor
          Z.vx[i] = Math.sin(Z.yaw[i]!) * s2
          Z.vz[i] = Math.cos(Z.yaw[i]!) * s2
        } else if (occ[hitCell] === 2 || (occ[hitCell] === 0 && pile[hitCell]! > 0)) {
          // stuck on the wall or the pile: becomes a step of the pyramid
          Z.stuck[i]! += engine.active && balanceOn ? dt * (1 + engine.pressureRatio(i)) : dt
          if (Z.stuck[i]! > 0.35 + 0.5 * Z.skin[i]!) {
            Z.stuck[i] = 0
            tryStep(i, hitCell)
          }
        }
      } else if (Z.stuck[i]! > 0) Z.stuck[i]! -= dt
      // a closed door in the way: hits it (10 per blow every 1.5 s; brute x3)
      if (hitCell >= 0 && Z.state[i] === STATE.CHASE && doors.at(hitCell) >= 0) {
        Z.attackTimer[i]! -= dt
        if (Z.attackTimer[i]! <= 0) {
          Z.attackTimer[i] = N.attackEvery
          doors.hit(doors.at(hitCell), N.doorDamage * (tr.doorDamage ?? 1))
        }
      }
      frame(i, dt, d, alive)
      const spd = Math.hypot(Z.vx[i]!, Z.vz[i]!)
      Z.renderSpeed[i]! += (spd - Z.renderSpeed[i]!) * Math.min(1, dt * 6)
      // arms: up when it perceives someone; down against a wall so the hand does not go through
      if (Z.band[i]! <= 1) {
        const s = Z.state[i]
        let goal = s === STATE.CHASE || s === STATE.GRAB || s === STATE.PILE_STEP ? 1 : 0
        if (goal && solidAt(Z.x[i]! + Math.sin(Z.renderYaw[i]!) * 0.62, Z.z[i]! + Math.cos(Z.renderYaw[i]!) * 0.62, 1.0)) goal = 0.1
        Z.arms[i]! += (goal - Z.arms[i]!) * Math.min(1, dt * (goal > Z.arms[i]! ? 3 : 5))
      }
      Z.phase[i]! += dt * (Z.renderSpeed[i]! < 0.05 ? 0.15 : N.cadenceBase + N.cadencePerSpeed * Z.renderSpeed[i]!) * Z.cadenceFactor[i]!
      if (physics.deterministic) {
        const attacking = Z.state[i] === STATE.CHASE && alive
        Z.attackPose[i] = attacking && (Z.x[i]! - P!.state.x) ** 2 + (Z.z[i]! - P!.state.z) ** 2 < (Z.attackPose[i] ? ATTACK_LEAVE : ATTACK_ENTER) ? 1 : 0
      }
      // walking without attacking: the body points where it goes
      if (spd > 0.35 && Z.state[i]! <= 1 && !Z.attackPose[i]) Z.yaw[i] = Math.atan2(Z.vx[i]!, Z.vz[i]!)
      let dy = Z.yaw[i]! - Z.renderYaw[i]!
      dy -= Math.round(dy / TAU_APPROX) * TAU_APPROX
      Z.renderYaw[i]! += dy * Math.min(1, dt * (Z.state[i] === STATE.AIRBORNE ? 20 : 9))
    }
    engine.endStep()
    if (pileColumns.length) collapsePileColumns(Z, pileColumns, FW * FW, stepRelease)
    killQFlush()
    noises.length = 0
    stats.slots = slots
  }

  // ----- trail, corpses, population -----
  const updateTrail = (dt: number, who: CrowdTarget | null = target): void => {
    for (const p of trail) p.t += dt
    while (trail.length && trail[0]!.t > N.trailSeconds) trail.shift()
    if (!who) return
    const s = who.state
    if ((s.bleeding || s.scentTimer > 0) && s.alive && Math.hypot(s.x - trailLast.x, s.z - trailLast.z) > N.trailStep) {
      trail.push({ x: s.x, z: s.z, t: 0 })
      trailLast = { x: s.x, z: s.z }
      if (trail.length > N.trailMax) trail.shift()
    }
  }
  const spawnAway = (minD: number, maxD: number, view: CrowdView): number => {
    const ox = target ? target.state.x : view.x
    const oz = target ? target.state.z : view.z
    for (let t = 0; t < 30; t++) {
      const a = R() * TURN
      const r = minD + Math.sqrt(R()) * (maxD - minD) // denser away from home
      const x = ox + Math.cos(a) * r
      const z = oz + Math.sin(a) * r
      // never born in front of the camera inside the fog
      const vx = x - view.x
      const vz = z - view.z
      const vd = Math.hypot(vx, vz)
      if (vd < view.far && vx * -Math.sin(view.yaw) + vz * -Math.cos(view.yaw) > vd * 0.5) continue
      if (Math.abs(x) < HALF - 3 && Math.abs(z) < HALF - 3 && !grid.blocked(x, z)) return spawn(x, z)
    }
    return -1
  }
  const updatePopulation = (dt: number, view: CrowdView, opts: { readonly target?: number; readonly migration?: MigrationOptions | null } = {}): void => {
    const popTarget = opts.target ?? N.population
    let k = 0
    while (Z.n < popTarget && k++ < 20) spawnAway(N.refillMin, N.refillMax, view)
    // the excess fades away slowly, only far and out of sight
    if (Z.n > popTarget + 120)
      for (let t = 0, rm = 0; t < 40 && rm < 4; t++) {
        const i = Math.floor(R() * Z.n)
        if (Z.band[i]! < 2 || Z.named[i]! >= 0 || (target && i === target.state.grabbedBy)) continue
        const vx = Z.x[i]! - view.x
        const vz = Z.z[i]! - view.z
        const vd = Math.hypot(vx, vz)
        if (vd < view.far && vx * -Math.sin(view.yaw) + vz * -Math.cos(view.yaw) > -vd * 0.35) continue
        remove(i)
        rm++
      }
    const mg = opts.migration === undefined ? null : opts.migration
    if (!mg) return
    migrateT -= dt
    if (migrateT <= 0) {
      migrateT = mg.every
      let m = 0
      for (let q = 0; q < mg.count && Z.n < Z.capacity; q++) {
        const i = spawn(mg.x + (R() - 0.5) * mg.width, mg.z + R() * mg.depth)
        if (i >= 0) {
          Z.wx[i] = mg.goal[0]
          Z.wz[i] = mg.goal[1]
          m++
        }
      }
      if (m) emit('message', { id: 'migration', seconds: 4 })
    }
  }

  const engine = createPhysics(
    {
      store: Z,
      grid,
      doors,
      gravity: N.gravity,
      attackEvery: N.attackEvery,
      types,
      moundHeight,
      corpsesMax: N.corpsesMax,
      typeOf: T,
      target: () => target,
      emit,
      damage: (i, hit, draw) => damageWith(i, hit, draw, true),
      deferKill,
      releasePileStep,
      corpseOf,
      corpseList: () => corpses.entries,
      addCorpse: (corpse) => void corpses.add(corpse),
      groundAt,
      pileBlast,
    },
    physics,
    stats.physics,
  )

  const crowd: Crowd = {
    store: Z,
    pack,
    grid,
    doors,
    corpses,
    numbers: N,
    stats,
    pile,
    mound: moundHeight,
    thrown: engine.thrown,
    blast: (blast) => engine.blasts.enqueue(blast),
    pileCount: () => pileN,
    trail,
    variantsOf,
    get target() {
      return target
    },
    set target(next) {
      target = next
    },
    random,
    sound,
    effect,
    typeIndex: (id) => typeIndexById.get(id) ?? -1,
    spawn: (x, z, type = -1) => spawn(x, z, type),
    remove,
    update,
    dispose: () => engine.dispose(),
    emitNoise,
    damage,
    kill: (i, headshot = false) => kill(i, headshot),
    updateTrail,
    updateCorpses: (dt) => void corpses.update(dt),
    updatePopulation,
    spawnAway,
    pileBlast,
    setHunt(next) {
      hunt = next
    },
    chaseSpeed,
    asPlayerCrowd: () => ({
      count: () => Z.n,
      active: (i) => Z.band[i] === 0,
      x: (i) => Z.x[i]!,
      z: (i) => Z.z[i]!,
      y: (i) => Z.y[i]!,
      floor: (i) => Z.floor[i]!,
      chasing: (i) => Z.state[i] === STATE.CHASE,
      down: (i) => Z.crawl[i] !== 0 || Z.state[i] === STATE.STUNNED,
      panicWeight: (i) => traits(i).panicWeight ?? 1,
      hold(i, x, z, k, lookX, lookZ) {
        Z.x[i]! += (x - Z.x[i]!) * k
        Z.z[i]! += (z - Z.z[i]!) * k
        Z.vx[i] = Z.vz[i] = Z.dvx[i] = Z.dvz[i] = 0
        Z.yaw[i] = Math.atan2(lookX - Z.x[i]!, lookZ - Z.z[i]!)
      },
      stun(i, seconds, vx, vz) {
        Z.state[i] = STATE.STUNNED
        Z.stateTimer[i] = seconds
        Z.vx[i] = vx
        Z.vz[i] = vz
      },
      chase(i, cooldown) {
        Z.state[i] = STATE.CHASE
        Z.attackTimer[i] = cooldown
      },
      damage: (i, hit) => void damage(i, { region: hit.region as CrowdHit['region'], amount: hit.amount, distance: hit.distance, cut: hit.cut, caliber: null }),
    }),
    on(event, listener) {
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(listener as (event: never) => void)
      return () => void set.delete(listener as (event: never) => void)
    },
  }
  return crowd
}
