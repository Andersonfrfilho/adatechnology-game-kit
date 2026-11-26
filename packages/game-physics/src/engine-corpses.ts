import { createBodyLod, farthestSleeping } from './body-lod'
import { createCorpseHeap } from './engine-corpses-heap'
import type { BodyRung } from './body-lod'
import type { BodyId, SeamWorld, Vec3 } from './contract'
import { yawQuat } from './corpse-pose'
import type { CorpseBodyKit, Rigid } from './corpse-pose'
import { bornInFullPile, distanceTo, enforceIslands, enforceQuotas, evaluateCorpses, rankPiles } from './engine-corpses-eval'
import { freezeCorpses, releaseResting } from './engine-corpses-pile'
import { bornAt, removeRungBodies, storeTorso, switchRung, torsoOf, wakeRecord, writeTorso } from './engine-corpses-swap'
import type { AddCorpseParams, AddLyingCorpseParams, CorpseBodiesOptions, CorpseContext, CorpseRecord } from './engine-corpses-types'
import { isPhysicsLoop } from './loop'
import type { PhysicsLoop } from './loop'
import { standingTorso } from './corpse-pose'

export type { AddCorpseParams, AddLyingCorpseParams, CorpseBodiesOptions, SettledCorpse } from './engine-corpses-types'

const DEFAULT_EVALUATE_EVERY = 8
const DEFAULT_SETTLE_DISTANCE = 2
/** A body that dies moving slides to rest about this many seconds of its speed from where it died (measured at 2 to 7 m/s, R0 and R1: 0.75 to 0.8, give or take the tumble): the push `onSettled` looks for is measured from there. */
const SLIDE_SECONDS = 0.8
/** Fixed steps between looks at the islands' size. */
const ISLAND_EVERY = 60
const NO_INTEREST: readonly Vec3[] = []

export interface CorpseCounts {
  readonly r0: number
  readonly r1: number
  readonly r2: number
  readonly r2f: number
  readonly r3: number
  /** Rigid bodies the corpses hold in the engine (a pile's static compound is not one). */
  readonly rigidBodies: number
  readonly piles: number
}

/** What a save of the corpses holds: numbers only, so it goes in the game's save. The bodies are the world's own (`saveState`), made in the same order. */
export interface CorpseBodiesState {
  readonly tick: number
  readonly born: number
  readonly nextPile: number
  /** How far (m) the interest has travelled in all, and where it was (x, z per point): what the dormant corpses' keys are measured against. */
  readonly travel: number
  readonly interest: readonly number[]
  readonly records: ReadonlyArray<{
    readonly id: number
    readonly rung: BodyRung
    readonly ragdoll: number
    readonly bodies: readonly number[]
    readonly pile: number
    readonly pileRank: number
    readonly torso: readonly number[]
    readonly asleepSeconds: number
    readonly sinceChangeSeconds: number
    readonly woken: boolean
    readonly asleep: boolean
    readonly stale: boolean
    readonly touching: readonly number[]
    readonly born: number
    readonly originX: number
    readonly originZ: number
    readonly lastLookedAt: number
    readonly distance: number
    readonly dormant: boolean
    /** The travel of the interest it waits for; -1 for a corpse that waits for nothing (frozen into a pile). */
    readonly dormantKey: number
  }>
  readonly piles: ReadonlyArray<{ readonly id: number; readonly body: number; readonly members: readonly number[] }>
}

/** What follows the ledger of the corpses (`CorpseLedger.subscribe` of `game-characters`): a corpse that leaves it leaves the world. */
export interface CorpseLedgerFollower {
  readonly removed: (entry: { readonly id: number }) => void
}

export interface CorpseBodies {
  /** Puts a dead body in the world, falling; returns the rung it was born on (R0 while the quota has room, else R1). */
  add(params: AddCorpseParams): BodyRung
  /** Puts a body that already lies where it lies in the world, asleep, on `rung`; returns the rung it got (R1 or R2 wait while there is no room, R3 always). */
  addLying(params: AddLyingCorpseParams): BodyRung
  /** Moves a corpse to `rung` now, whatever the policy says (a host that holds a body, a test); false when a rung without room waits. R2f freezes it into the pile it touches. */
  changeRung(id: number, rung: BodyRung): boolean
  /** Takes a corpse out of the world (eaten, expired, pushed out): what rested on it is woken and falls. */
  remove(id: number): void
  /** `ledger.subscribe(bodies.follower)`: the ledger's removals remove the bodies. */
  readonly follower: CorpseLedgerFollower
  /** One fixed step of the policy; a host with a `PhysicsLoop` does not call it (it is a `beforeStep` of the loop's `actors` phase). */
  step(h: number): void
  rungOf(id: number): BodyRung | undefined
  /** Whose body `body` is: a corpse's own part, or a pile's compound with the child's `tag` (`RayHit.tag`) of the member hit; undefined for anything else. */
  corpseOfBody(body: BodyId, tag?: number): number | undefined
  /** The rigid bodies of the corpse's rung (parts of a ragdoll or chain in kit order, the capsule), for reading their poses to draw; empty for R2f and R3. */
  partsOf(id: number): readonly BodyId[]
  /** The torso's pose (x y z, then x y z w) at `offset`, for any rung; false for a corpse the world does not know. */
  readTorso(id: number, out: Float32Array | Float64Array, offset: number): boolean
  counts(): CorpseCounts
  /** Corpses looked at since the start, in all: a step that leaves the sleepers alone adds none (read it before and after to count what a step visited). */
  looks(): number
  /** A hash of every corpse's id and rung in id order: equal runs have equal hashes. */
  rungHash(): number
  saveState(): CorpseBodiesState
  /** Puts a `saveState` back; the world must hold the same bodies (it was restored from its own save first). False when a body is missing. */
  restoreState(state: CorpseBodiesState): boolean
  /** Takes every body the corpses hold (the rungs' and the piles' compounds) out of the world and stops following the loop; the world stays. */
  dispose(): void
}

const RUNG_CODE: Readonly<Record<BodyRung, number>> = { r0: 0, r1: 1, r2: 2, r2f: 3, r3: 4 }

/**
 * The bodies of the dead: each rung of the body LOD (`design/pilha-e-lod.md`) made, changed and taken out through the contract, never the engine. A `PhysicsLoop` runs the
 * policy in its fixed steps; a host without one calls `step(h)` itself.
 */
export const createCorpseBodies = (host: SeamWorld | PhysicsLoop, options: CorpseBodiesOptions = {}): CorpseBodies => {
  const loop = isPhysicsLoop(host) ? host : null
  const world = loop ? loop.world : (host as SeamWorld)
  const lod = createBodyLod(options.lod)
  const interest = (): readonly Vec3[] => options.interest?.() ?? NO_INTEREST
  const ctx: CorpseContext = {
    world, lod, budget: options.budget, records: new Map(), piles: new Map(), ownerOf: new Map(), pileOf: new Map(), nextPile: 1, born: 0, tick: 0,
    rungCounts: { r0: 0, r1: 0, r2: 0, r2f: 0, r3: 0 }, rigidCount: 0, live: new Set(), dormant: createCorpseHeap(), travel: 0, interest: new Float64Array(0), looks: 0, readInterest: interest, pending: [], freezing: [],
  }
  const every = Math.max(1, Math.floor(options.evaluateEvery ?? DEFAULT_EVALUATE_EVERY))

  const step = (h: number): void => {
    ctx.tick++
    if (ctx.tick % every === 0) rankPiles(ctx, options.moundAt)
    evaluateCorpses(ctx, { h, interest: interest(), every, moundAt: options.moundAt, onSettled: options.onSettled, settleDistance: options.settleDistance ?? DEFAULT_SETTLE_DISTANCE })
    enforceQuotas(ctx)
    if (ctx.tick % ISLAND_EVERY === 0) enforceIslands(ctx)
  }
  const stop = loop ? loop.add({ beforeStep: (h) => step(h) }, 'actors') : () => undefined

  const bornRung = (distance: number, kit: CorpseBodyKit, frame: Rigid): 'r0' | 'r1' | 'r2' => {
    if (bornInFullPile(ctx, kit, frame, options.moundAt)) return 'r2'
    if (distance > lod.numbers.ragdollDistance) return 'r1'
    if (ctx.rungCounts.r0 < lod.numbers.ragdollsMax) return 'r0'
    const victim = farthestSleeping(ctx.records.values(), 'r0')
    if (victim < 0) return 'r1'
    switchRung(ctx, ctx.records.get(victim) as CorpseRecord, 'r1', true)
    return 'r0'
  }

  const add = (params: AddCorpseParams): BodyRung => {
    if (ctx.records.has(params.id)) throw new Error(`game-physics: corpse ${params.id} is already in the world`)
    const frame: Rigid = { position: params.position, rotation: yawQuat(params.yaw) }
    const distance = distanceTo(interest(), params.position[0], params.position[2])
    const rung = bornRung(distance, params.kit, frame)
    const record: CorpseRecord = {
      id: params.id, kit: params.kit, rung, ragdoll: 0, bodies: [], pile: 0, pileRank: 0, torso: new Float64Array(7), asleepSeconds: 0, sinceChangeSeconds: 0, woken: false, asleep: false, stale: true,
      touching: [], born: ctx.born++, originX: params.position[0] + (params.velocity?.[0] ?? 0) * SLIDE_SECONDS, originZ: params.position[2] + (params.velocity?.[2] ?? 0) * SLIDE_SECONDS, lastLookedAt: ctx.tick, distance, dormant: false, dormantKey: 0,
    }
    storeTorso(record, standingTorso(params.kit, frame))
    ctx.records.set(params.id, record)
    ctx.live.add(record)
    ctx.rungCounts[rung]++
    bornAt(ctx, record, rung, frame, params.velocity ?? [0, 0, 0])
    enforceQuotas(ctx)
    return record.rung
  }

  const addLying = (params: AddLyingCorpseParams): BodyRung => {
    if (ctx.records.has(params.id)) throw new Error(`game-physics: corpse ${params.id} is already in the world`)
    const record: CorpseRecord = {
      id: params.id, kit: params.kit, rung: 'r3', ragdoll: 0, bodies: [], pile: 0, pileRank: 0, torso: new Float64Array(7), asleepSeconds: 0, sinceChangeSeconds: 0, woken: false, asleep: true, stale: true,
      touching: [], born: ctx.born++, originX: params.torso.position[0], originZ: params.torso.position[2], lastLookedAt: ctx.tick, distance: 0, dormant: false, dormantKey: 0,
    }
    storeTorso(record, params.torso)
    ctx.records.set(params.id, record)
    ctx.live.add(record)
    ctx.rungCounts.r3++
    if (params.rung === 'r3') return 'r3'
    switchRung(ctx, record, 'r2', true)
    if (params.rung === 'r1') switchRung(ctx, record, 'r1', true)
    record.asleepSeconds = lod.numbers.sleepSeconds
    return record.rung
  }

  const remove = (id: number): void => {
    const record = ctx.records.get(id)
    if (!record) return
    // where it lies is kept first: the compounds are asked what rested on it, and a body that is gone has no pose to read
    storeTorso(record, torsoOf(ctx, record))
    if (record.rung !== 'r2f' && record.rung !== 'r3') removeRungBodies(ctx, record)
    if (record.rung !== 'r3') releaseResting(ctx, record)
    ctx.rungCounts[record.rung]--
    record.dormant = false
    ctx.live.delete(record)
    ctx.records.delete(id)
  }

  const changeRung = (id: number, rung: BodyRung): boolean => {
    const record = ctx.records.get(id)
    if (!record || record.rung === rung) return record !== undefined
    if (rung === 'r2f') {
      freezeCorpses(ctx, [record])
      return true
    }
    if (record.rung === 'r2f') {
      // leaving the pile's compound: what rested on it loses its support as when a body is eaten
      releaseResting(ctx, record)
      record.pile = 0
    }
    wakeRecord(ctx, record)
    return switchRung(ctx, record, rung, false)
  }

  const saveState = (): CorpseBodiesState => ({
    tick: ctx.tick,
    born: ctx.born,
    nextPile: ctx.nextPile,
    travel: ctx.travel,
    interest: [...ctx.interest],
    records: [...ctx.records.values()].map((record) => ({
      id: record.id, rung: record.rung, ragdoll: record.ragdoll, bodies: [...record.bodies], pile: record.pile, pileRank: record.pileRank, torso: [...record.torso], asleepSeconds: record.asleepSeconds,
      sinceChangeSeconds: record.sinceChangeSeconds, woken: record.woken, asleep: record.asleep, stale: record.stale, touching: [...record.touching], born: record.born, originX: record.originX, originZ: record.originZ, lastLookedAt: record.lastLookedAt, distance: record.distance, dormant: record.dormant, dormantKey: record.dormantKey === Infinity ? -1 : record.dormantKey,
    })),
    piles: [...ctx.piles.values()].map((pile) => ({ id: pile.id, body: pile.body, members: [...pile.members] })),
  })

  const restoreState = (state: CorpseBodiesState): boolean => {
    const kits = new Map([...ctx.records.values()].map((record) => [record.id, record.kit]))
    const bodies = state.records.flatMap((record) => record.bodies).concat(state.piles.map((pile) => pile.body))
    if (state.records.some((record) => !kits.has(record.id)) || bodies.some((body) => !world.has(body as BodyId))) return false
    ctx.records.clear()
    ctx.ownerOf.clear()
    ctx.piles.clear()
    ctx.pileOf.clear()
    ctx.tick = state.tick
    ctx.born = state.born
    ctx.nextPile = state.nextPile
    ctx.travel = state.travel
    ctx.interest = Float64Array.from(state.interest)
    ctx.live.clear()
    ctx.dormant.clear()
    ctx.rigidCount = 0
    for (const key of Object.keys(ctx.rungCounts)) ctx.rungCounts[key as BodyRung] = 0
    for (const saved of state.records) {
      const record: CorpseRecord = {
        id: saved.id, kit: kits.get(saved.id) as CorpseRecord['kit'], rung: saved.rung, ragdoll: saved.ragdoll as CorpseRecord['ragdoll'], bodies: saved.bodies as BodyId[], pile: saved.pile, pileRank: saved.pileRank,
        torso: Float64Array.from(saved.torso), asleepSeconds: saved.asleepSeconds, sinceChangeSeconds: saved.sinceChangeSeconds, woken: saved.woken, asleep: saved.asleep, stale: saved.stale,
        touching: saved.touching as BodyId[], born: saved.born, originX: saved.originX, originZ: saved.originZ, lastLookedAt: saved.lastLookedAt, distance: saved.distance,
        dormant: saved.dormant, dormantKey: saved.dormantKey === -1 ? Infinity : saved.dormantKey,
      }
      ctx.records.set(record.id, record)
      ctx.rungCounts[record.rung]++
      ctx.rigidCount += record.bodies.length
      for (const body of record.bodies) ctx.ownerOf.set(body, record.id)
      if (!record.dormant) ctx.live.add(record)
      else if (record.dormantKey !== Infinity) ctx.dormant.push(record.dormantKey, record)
    }
    for (const pile of state.piles) {
      ctx.piles.set(pile.id, { id: pile.id, body: pile.body as BodyId, members: [...pile.members] })
      ctx.pileOf.set(pile.body as BodyId, pile.id)
    }
    return true
  }

  return {
    add,
    addLying,
    changeRung,
    remove,
    follower: { removed: (entry) => remove(entry.id) },
    step,
    rungOf: (id) => ctx.records.get(id)?.rung,
    corpseOfBody: (body, tag = -1) => ctx.ownerOf.get(body) ?? (ctx.pileOf.has(body) && ctx.records.has(tag) ? tag : undefined),
    partsOf: (id) => ctx.records.get(id)?.bodies ?? [],
    readTorso(id, out, offset) {
      const record = ctx.records.get(id)
      if (!record) return false
      writeTorso(ctx, record, out, offset)
      return true
    },
    counts: () => ({ ...ctx.rungCounts, rigidBodies: ctx.rigidCount, piles: ctx.piles.size }),
    looks: () => ctx.looks,
    rungHash() {
      let hash = 0x811c9dc5
      for (const id of [...ctx.records.keys()].sort((a, b) => a - b)) {
        hash = Math.imul(hash ^ id, 0x01000193) >>> 0
        hash = Math.imul(hash ^ RUNG_CODE[(ctx.records.get(id) as CorpseRecord).rung], 0x01000193) >>> 0
      }
      return hash
    },
    saveState,
    restoreState,
    dispose() {
      stop()
      for (const record of ctx.records.values()) if (record.rung !== 'r2f' && record.rung !== 'r3') removeRungBodies(ctx, record)
      for (const pile of ctx.piles.values()) world.removeBody(pile.body)
      ctx.records.clear()
      ctx.ownerOf.clear()
      ctx.piles.clear()
      ctx.pileOf.clear()
      ctx.live.clear()
      ctx.dormant.clear()
      ctx.rigidCount = 0
      for (const key of Object.keys(ctx.rungCounts)) ctx.rungCounts[key as BodyRung] = 0
    },
  }
}
