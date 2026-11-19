import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildFrame } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import type { HostEvent } from '@adatechnology/game-contracts'
import type { PhysicsLoop } from '@adatechnology/game-physics'

import { buildFromSpec } from '../src/build-from-spec'
import type { TestRoom, TestRoomItem } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

// The baseline of spec 010 T3.2: what the room's current path gives for one scene at 1/60 s per frame. T3.4 moves the simulation into `fixedSimulate`; this test must pass unchanged.
// RECORD_STEP_BASELINE=1 writes the fixture from the code as it is (done once, before T3.3/T3.4); the test never writes it otherwise.
const FIXTURE = resolve(process.cwd(), 'tests/fixtures/step-equivalence.json')
const FRAMES = 180
const BLAST_JOULES = 4_000_000
const BLAST_RADIUS = 14

const sobradoSpec = () => ({ ...buildFrame({ spanX: 6, spanZ: 5, columnsX: 3, columnsZ: 2, height: 2.7, floors: 2, walls: true, roof: true }), name: 'sobrado' })
const SOBRADO: TestRoomItem = { id: 'sobrado', name: 'Sobrado', group: 'structure', spec: sobradoSpec(), movable: false, build: (T) => buildFromSpec(T, sobradoSpec()) }

/** cyrb53: a 53-bit string hash, plenty to tell two frames apart. */
const hashOf = (text: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

type FrameHash = readonly [events: string, state: string]

const stateOf = (room: TestRoom, loop: PhysicsLoop | null): string => {
  const pieces = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray(), piece.velocity, piece.angularVelocity, piece.sleeping])
  const frame = loop ? [loop.frame.time, loop.frame.steps] : null
  return JSON.stringify([room.world.serialize(), pieces, room.fluids.stains(), frame])
}

/** One run of the scene: frame by frame `room.update(1/60)`, the way the page and the scenarios drive the room. */
const record = (room: TestRoom, loop: PhysicsLoop | null): FrameHash[] => {
  const events: string[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event: HostEvent) => events.push(JSON.stringify(event))) })
  const sobrado = room.spawn('sobrado', [0, 0, -9]).objectId
  const hashes: FrameHash[] = []
  let seen = 0
  let crate = ''
  for (let frame = 0; frame < FRAMES; frame++) {
    if (frame === 10) {
      crate = room.spawn('wooden_crate', [4, 0, -5]).objectId
      room.fluids.splash('fuel', [4.6, 0.02, -5], 0.5)
      room.fluids.splash('water', [-3, 0.02, -4], 0.4)
    }
    if (frame >= 20 && frame < 60 && frame % 5 === 0) room.world.hit(crate, { type: 'fire', point: [4, 0.4, -5], temperature: 900, radius: 0.8, duration: 2, source: 'fire' })
    if (frame === 30) room.world.explode([0, 1, -6.4], BLAST_JOULES, BLAST_RADIUS, 'c4')
    room.setFastForward(frame >= 100 && frame < 120)
    room.update(1 / 60)
    const entries = room.log.entries()
    const fresh = entries.slice(seen).map((entry) => [entry.seq, entry.t, entry.channel, entry.type, entry.objectId, entry.part])
    seen = entries.length
    hashes.push([hashOf(JSON.stringify([events.splice(0), fresh])), hashOf(stateOf(room, loop) + sobrado)])
  }
  return hashes
}

const baselineOf = (variant: string): FrameHash[] => (JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, FrameHash[]>)[variant] ?? []

const verify = (variant: string, hashes: FrameHash[]): void => {
  if (process.env.RECORD_STEP_BASELINE) {
    let stored: Record<string, FrameHash[]> = {}
    try {
      stored = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, FrameHash[]>
    } catch {
      stored = {}
    }
    writeFileSync(FIXTURE, `${JSON.stringify({ ...stored, [variant]: hashes }, null, 1)}\n`)
  }
  const expected = baselineOf(variant)
  expect(hashes).toHaveLength(FRAMES)
  const firstDifferent = hashes.findIndex((pair, index) => pair[0] !== expected[index]?.[0] || pair[1] !== expected[index]?.[1])
  expect(firstDifferent).toBe(-1)
}

describe('the room simulates the same scene to the same bytes at 1/60 s per frame (spec 010 T3.2)', () => {
  it('on the kit own solver: a 4 MJ blast on the sobrado, a fire, spilled fuel and water, fast forward on for 20 frames', () => {
    const room = makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 } })
    const hashes = record(room, null)
    expect(new Set(hashes.map((pair) => pair[1])).size).toBeGreaterThan(60)
    expect(room.log.entries({ type: 'ignite' }).length).toBeGreaterThan(0)
    expect(room.fluids.stains().length).toBeGreaterThan(0)
    verify('own', hashes)
  })

  it('on a Jolt physics loop of 1/120 s steps: the same scene', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ ...KIT_WORLD })
    const loop = createPhysicsLoop(world)
    const room = makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 }, physics: loop })
    const hashes = record(room, loop)
    expect(loop.frame.steps).toBeLessThanOrEqual(2)
    expect(loop.frame.time).toBeCloseTo(FRAMES / 60, 6)
    verify('jolt', hashes)
    world.dispose()
  })
})
