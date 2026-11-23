// A blast spread over frames with the world held (`blastPacing`, spec 018 D2): the world it leaves, when its damage lands, and what a clear in the middle leaves.
import { describe, expect, it } from 'vitest'
import type { HostEvent } from '@adatechnology/game-contracts'

import { makeRoom } from './helpers'
import type { TestRoom, TestRoomOptions } from '../src'

const TICK = 1 / 60
/** Simulated ticks after which the rooms are compared: past the grenade's fuse and a second more. */
const TICKS = 420
const SPOT: [number, number, number] = [0, 0.4, -3]

const fnv = (text: string): number => {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0
  return hash
}

/** Fixed ticks run so far, by the room's own scheduler stats (the typed `frameStats` hook). */
const ticksOf = (room: TestRoom): number => room.frameStats?.().tick ?? 0

type Run = {
  readonly state: number
  readonly frozenFrames: number
  /** Fixed ticks run while structural events of a spread blast were still waiting: must be 0. */
  readonly ticksWithBacklog: number
  readonly explosions: readonly HostEvent[]
  /** World time of the first event a fragment of the player's blast emitted. */
  readonly blastTime: number | undefined
  readonly pieces: number
}

/** Concrete blocks and steel sheets around the spot, a blast the script sets off (`fire`), then frames of 1/60 s until `TICKS` fixed ticks have run. */
const run = (blastPacing: TestRoomOptions['blastPacing'], fire: (room: TestRoom) => void, ticks = TICKS): Run & { readonly room: TestRoom } => {
  const room = makeRoom(blastPacing === undefined ? {} : { blastPacing })
  const explosions: HostEvent[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => event.type === 'explosion' && explosions.push(event)) })
  for (const [index, id] of ['concrete_block', 'steel_sheet', 'concrete_block', 'glass_pane', 'steel_sheet'].entries()) room.spawn(id, [(index - 2) * 0.9, 0, -4 - (index % 2) * 0.6], index * 0.4)
  let blastTime: number | undefined
  room.world.on('*', (event) => {
    if (blastTime === undefined && event.source === 'player' && event.blow === 'ballistic') blastTime = event.time
  })
  room.update(TICK)
  const start = ticksOf(room)
  fire(room)
  let frames = 0
  let frozenFrames = 0
  let ticksWithBacklog = 0
  while (ticksOf(room) - start < ticks && frames < 2 * ticks) {
    const before = ticksOf(room)
    const backlog = room.renderer.structuralBacklog()
    room.update(TICK)
    frames++
    if (ticksOf(room) === before) frozenFrames++
    else if (backlog > 0) ticksWithBacklog++
  }
  // serialize runs an open blast to its end: never read in the middle of one (a run of 0 ticks hands the room over mid-blast)
  return { room, state: ticks > 0 ? fnv(JSON.stringify(room.world.serialize())) : 0, frozenFrames, ticksWithBacklog, explosions, blastTime, pieces: room.renderer.pieces().length }
}

const throwGrenade = (room: TestRoom): void => {
  room.setTool('frag_grenade')
  for (let i = 0; i < 30; i++) room.update(TICK)
  room.look([0, 1.7, 1], [0, 0.4, -3])
  room.use()
}

const blastAtSpot = (room: TestRoom): void => {
  expect(room.blastAt('m67', SPOT)).toBe(true)
}

describe('blastPacing: a grenade spread over frames (spec 018 D2)', () => {
  it('set off outside a step (blastAt), it leaves the world of the one-shot blast without pacing, frozen frames and all', () => {
    const plain = run(undefined, blastAtSpot)
    const paced = run({ raysPerFrame: 64, unitsPerFrame: 200 }, blastAtSpot)
    expect(plain.explosions).toHaveLength(1)
    expect(paced.explosions).toHaveLength(1)
    expect(plain.frozenFrames).toBe(0)
    expect(paced.frozenFrames).toBeGreaterThan(4)
    expect(paced.state).toBe(plain.state)
    expect(paced.pieces).toBe(plain.pieces)
    expect(paced.ticksWithBacklog).toBe(0)
    expect(paced.room.frameStats?.().heldSeconds).toBeGreaterThan(0)
  })

  it('set off inside a step (a fuse), sliced or whole it is the same world, and no step runs before its damage is applied', () => {
    const whole = run({ raysPerFrame: Infinity }, throwGrenade)
    for (const pacing of [{ raysPerFrame: 64, unitsPerFrame: 200 }, { raysPerFrame: 7, wavePartsPerFrame: 3, unitsPerFrame: 1000 }]) {
      const sliced = run(pacing, throwGrenade)
      expect(sliced.explosions).toHaveLength(1)
      expect(sliced.frozenFrames).toBeGreaterThan(2)
      expect(sliced.ticksWithBacklog).toBe(0)
      expect(sliced.state).toBe(whole.state)
      expect(sliced.pieces).toBe(whole.pieces)
    }
    expect(whole.explosions).toHaveLength(1)
    expect(whole.frozenFrames).toBe(0)
    // the grenade did something: the world without it is another
    expect(run({ raysPerFrame: Infinity }, (room) => room.setTool('frag_grenade')).state).not.toBe(whole.state)
  })

  it('set off inside a step (a fuse), it goes off later in the step than without pacing: same point, its events one tick later (the documented shift)', () => {
    const plain = run(undefined, throwGrenade)
    const paced = run({ raysPerFrame: 64, unitsPerFrame: 200 }, throwGrenade)
    expect(plain.explosions).toHaveLength(1)
    expect(paced.explosions).toHaveLength(1)
    expect(paced.explosions[0]).toMatchObject({ point: (plain.explosions[0] as { point: unknown }).point })
    expect(plain.blastTime).toBeDefined()
    // without pacing it goes off inside the explosives' update, before the step's world update; with it, at the end of the step, after that update
    expect(paced.blastTime! - plain.blastTime!).toBeCloseTo(TICK, 9)
  })

  it('a clear in the middle of a spread blast drops it: nothing of it lands after, and the world is the world of a room cleared without it', () => {
    const settle = (room: TestRoom, ticks: number): void => {
      const start = ticksOf(room)
      while (ticksOf(room) - start < ticks) room.update(TICK)
    }
    const fresh = run({}, () => undefined, 0)
    fresh.room.clear()
    settle(fresh.room, 60)
    const cleared = run({}, blastAtSpot, 0)
    // a frame into it: the rays still being cast, the world held
    const held = ticksOf(cleared.room)
    cleared.room.update(TICK)
    expect(ticksOf(cleared.room)).toBe(held)
    cleared.room.clear()
    settle(cleared.room, 60)
    expect(cleared.explosions).toHaveLength(0)
    expect(cleared.room.renderer.structuralBacklog()).toBe(0)
    expect(cleared.room.world.explosionProbe().finishedByOperation).toBe(0)
    // the same objects in the same state; the world clock differs by the frames the blast held, so it is left out
    const objectsOf = (room: TestRoom): string => JSON.stringify(room.world.serialize().objects)
    expect(objectsOf(cleared.room)).toBe(objectsOf(fresh.room))
  })

  it('the share the player takes of a spread blast is read where they stood when it went off, not where they are when it ends', () => {
    const share = (blastPacing: TestRoomOptions['blastPacing']): unknown[] => {
      const room = makeRoom(blastPacing === undefined ? {} : { blastPacing })
      room.look([0, 1.7, -1], [0, 0.4, -3])
      room.update(TICK)
      expect(room.blastAt('m67', SPOT)).toBe(true)
      // the player walks away while the blast is still being cast
      room.look([0, 1.7, 60], [0, 1.7, 70])
      for (let frame = 0; frame < 30; frame++) room.update(TICK)
      return room.log.entries({ type: 'blast_player' }).map((entry) => entry.data)
    }
    const plain = share(undefined)
    expect(plain).toHaveLength(1)
    expect(share({})).toEqual(plain)
  })
})
