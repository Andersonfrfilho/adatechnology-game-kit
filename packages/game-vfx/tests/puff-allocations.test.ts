import { createHash } from 'node:crypto'
import { Session } from 'node:inspector/promises'

import { describe, expect, it } from 'vitest'

import { Enclosures, LOD_LAB, createVfx } from '../src'
import type { VfxWorld } from '../src'

/** What moves the smoke each frame: the puffs' update and the walls of the shut spaces it goes round. */
const PUFF_STEP = new Set(['updatePuffs', 'moveFree', 'moveOnRing', 'confine', 'confineMove', 'slideInto'])
const EXPLOSIVES = ['m67', 'c4', 'molotov', 'pipe_bomb', 'dynamite', 'at4_84mm']
const FRAMES = 600

interface ProfileNode {
  readonly callFrame: { readonly functionName: string }
  readonly selfSize: number
  readonly children?: readonly ProfileNode[]
}

const stepBytes = (node: ProfileNode): number =>
  (PUFF_STEP.has(node.callFrame.functionName) ? node.selfSize : 0) + (node.children ?? []).reduce((sum, child) => sum + stepBytes(child), 0)

/** Every 30 frames one of the arsenal's blasts among six shut cars, under wind: the smoke of a burst pressing on the cars' walls. */
const burst = (): { world: VfxWorld; frame: (frame: number) => void } => {
  const world = createVfx({ seed: 7, profile: 'high', areaCap: false, lod: LOD_LAB })
  world.setCamera([10, 6.5, 14])
  world.setWind([0.5, 0, 0.2])
  for (let car = 0; car < 6; car++) world.enclose(`car${car}`, { center: [car * 3 - 6, 0.8, 2], halfSize: [2, 0.7, 0.9] })
  // the random draws of `through`: a seeping wall and a wall with a rated hole
  world.enclose('leaky', { center: [0, 0.8, -2], halfSize: [2, 0.7, 0.9], leak: 0.8 })
  world.enclose('holed', { center: [5, 0.8, -2], halfSize: [2, 0.7, 0.9], openings: [{ center: [0, 0, 0.9], halfSize: [1, 0.5, 0.2], rate: 1.5 }] })
  return {
    world,
    frame: (frame) => {
      if (frame % 30 === 0) world.explosion(EXPLOSIVES[(frame / 30) % EXPLOSIVES.length | 0]!, [(frame % 7) - 3, 0.1, frame % 5])
      world.update(1 / 60)
    },
  }
}

/** Most the smoke's step may make per frame (bytes). Each puff near a car once boxed the eight numbers of its `confine` call (~110 kB a frame here, ~10 MB/s in the test room's burst). */
const STEP_BYTES_PER_FRAME = 1024

describe('what moving the smoke makes per frame', () => {
  it(`hundreds of puffs round six shut cars: under ${STEP_BYTES_PER_FRAME} bytes a frame, garbage included`, { timeout: 120000 }, async () => {
    const { world, frame } = burst()
    // warm: the JIT optimises the step before it is measured, as in a game that has run a while
    for (let at = 0; at < 4000; at++) frame(at)
    const session = new Session()
    session.connect()
    await session.post('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
    for (let at = 0; at < FRAMES; at++) frame(at)
    const { profile } = await session.post('HeapProfiler.stopSampling')
    session.disconnect()
    const perFrame = stepBytes(profile.head as unknown as ProfileNode) / FRAMES
    // a rename of the step's functions would make the sum 0 and pass: prove the sample had smoke at the walls
    expect(typeof Enclosures.prototype.confineMove).toBe('function')
    let puffFrames = 0
    let calls = 0
    let stopped = 0
    const enclosures = world.enclosures()
    const confineMove = Enclosures.prototype.confineMove
    enclosures.confineMove = (move, dt) => {
      calls++
      const isStopped = confineMove.call(enclosures, move, dt)
      if (isStopped) stopped++
      return isStopped
    }
    for (let at = 0; at < 120; at++) {
      frame(FRAMES + at)
      if (world.pools().puffs.items.length > 0) puffFrames++
    }
    expect(puffFrames).toBe(120)
    expect(calls).toBeGreaterThan(0)
    expect(stopped).toBeGreaterThan(0)
    console.log(JSON.stringify({ name: 'puff-allocations', bytesPerFrame: Math.round(perFrame) }))
    expect(perFrame).toBeLessThan(STEP_BYTES_PER_FRAME)
  })

  // the puffs' state every frame, recorded with the code that boxed its calls (origin/main 80680fa51): reusing the step changes no byte
  it('moves the smoke as before: the same puffs, frame by frame, with 24 thousand of them stopped at a wall', () => {
    const { world, frame } = burst()
    let stopped = 0
    const confineMove = Enclosures.prototype.confineMove
    const enclosures = world.enclosures()
    enclosures.confineMove = (move, dt) => {
      const isStopped = confineMove.call(enclosures, move, dt)
      if (isStopped) stopped++
      return isStopped
    }
    const hash = createHash('sha256')
    for (let at = 0; at < 900; at++) {
      frame(at)
      const puffs = world.pools().puffs.items
      const state = new Float64Array(puffs.length * 9)
      puffs.forEach((puff, index) => state.set([puff.x, puff.y, puff.z, puff.vx, puff.vy, puff.vz, puff.size, puff.age, puff.heat], index * 9))
      hash.update(new Uint8Array(state.buffer))
    }
    const message = 'this hash guards the confinement refactor: on an intended tuning change, re-record it (and the stop count) from the code before the change'
    expect(stopped, message).toBe(24551)
    expect(hash.digest('hex'), message).toBe('075815e84b6df3eff050ba9521a29609f54132eea59d4f33ab70e2b612c93131')
  })
})
