import { describe, expect, it } from 'vitest'
import { LOD_LAB, createGroundField, createVfx } from '../src'
import type { ExplosionDef, VfxSideRequest, VfxWorld } from '../src'
import { TEST_BLAST, TEST_CATALOGUE } from './fixtures'

const ORIGIN = [0, 0.1, 0] as const

function makeWorld(extra: Parameters<typeof createVfx>[0] = {}): { world: VfxWorld; requests: VfxSideRequest[] } {
  const requests: VfxSideRequest[] = []
  const world = createVfx({ seed: 7, profile: 'high', explosions: TEST_CATALOGUE, aliases: { alias_blast: 'test_blast' }, onRequest: (request) => requests.push(request), ...extra })
  return { world, requests }
}

function run(world: VfxWorld, seconds: number): void {
  for (let frame = 0; frame < seconds * 60; frame++) world.update(1 / 60)
}

function fingerprint(world: VfxWorld): string {
  const pools = world.pools()
  const rows = [
    ...pools.puffs.items.map((p) => [p.x, p.y, p.z, p.t, p.seed].join(',')),
    ...pools.sparks.items.map((s) => [s.x, s.y, s.z].join(',')),
    ...pools.chunks.items.map((c) => [c.x, c.y, c.z, c.rx].join(',')),
    ...pools.marks.entries.map((m) => JSON.stringify(m)),
  ]
  return rows.join('|')
}

describe('createVfx', () => {
  it('answers null for an unknown id and a handle for a known one or an alias', () => {
    const { world } = makeWorld()
    expect(world.explosion('nope', ORIGIN)).toBeNull()
    expect(world.explosion('test_blast', ORIGIN)).toBe(1)
    expect(world.explosion('alias_blast', ORIGIN)).toBe(2)
    expect(world.catalog()).toEqual(['test_blast', 'alias_blast'])
  })

  it('makes every layer of an explosion and counts what it made', () => {
    const { world } = makeWorld({ areaCap: false, lod: LOD_LAB })
    world.setCamera([10, 6.5, 14])
    world.explosion('test_blast', ORIGIN)
    const stats = world.stats()
    expect(stats.puffs).toBeGreaterThan(30)
    expect(stats.sparks).toBe(20 + 6)
    expect(stats.chunks).toBe(6 + Math.round(4 + 0.9 * 4))
    expect(stats.shocks).toBe(1)
    expect(stats.rings).toBe(1)
    expect(stats.glows).toBeGreaterThanOrEqual(2)
    expect(world.pools().marks.entries.some((mark) => mark.kind === 'scorch')).toBe(true)
    expect(world.pools().marks.entries.some((mark) => mark.kind === 'dirt')).toBe(true)
    expect(stats.lastBlast.lights).toBe(1)
    expect(stats.lod).toBe(1)
    expect(world.stats().blastTime).toBe(0)
    run(world, 0.5)
    expect(world.stats().blastTime).toBeCloseTo(0.5, 6)
  })

  it('draws the same effect from the same seed in shared mode, and a different one from another', () => {
    const play = (seed: number): string => {
      const { world } = makeWorld({ randomMode: 'shared', seed, areaCap: false })
      world.explosion('test_blast', ORIGIN)
      run(world, 2)
      return fingerprint(world)
    }
    expect(play(5)).toBe(play(5))
    expect(play(5)).not.toBe(play(6))
  })

  it('in per_event mode the event seed alone decides the visual, whatever played before', () => {
    const alone = makeWorld({ randomMode: 'per_event', areaCap: false })
    alone.world.explosion('test_blast', ORIGIN, { seed: 99 })
    const busy = makeWorld({ randomMode: 'per_event', areaCap: false })
    busy.world.explosion('test_blast', [50, 0.1, 50], { seed: 1 })
    busy.world.clear()
    busy.world.explosion('test_blast', ORIGIN, { seed: 99 })
    expect(fingerprint(busy.world)).toBe(fingerprint(alone.world))
  })

  it('the layers turn off one by one', () => {
    const { world } = makeWorld({ areaCap: false })
    world.setLayer('shrapnel', false)
    world.setLayer('shock', false)
    world.setLayer('mark', false)
    world.setLayer('fire', false)
    world.setLayer('flash', false)
    world.explosion('test_blast', ORIGIN)
    const stats = world.stats()
    expect(stats.sparks).toBe(0)
    expect(stats.chunks).toBe(0)
    expect(stats.shocks).toBe(0)
    expect(stats.rings).toBe(0)
    expect(stats.fires).toBe(0)
    expect(stats.glows).toBe(0)
    expect(stats.lastBlast.lights).toBe(0)
    expect(world.pools().marks.entries).toHaveLength(0)
    expect(world.layer('smoke')).toBe(true)
    expect(stats.puffs).toBeGreaterThan(0)
  })

  it('sends the host what it must do: dig, break the glass, set characters alight', () => {
    const { world, requests } = makeWorld()
    world.explosion('test_blast', [3, 0.1, 4])
    expect(requests).toContainEqual({ type: 'crater', x: 3, z: 4, radius: 0.9, depth: 0.25 })
    const front = requests.find((request) => request.type === 'blast_front')
    expect(front).toMatchObject({ explosion: 'test_blast', point: [3, 0.1, 4], glassRadius: 15 * 0.85, speed: 340, lethal: 5, injury: 15, push: 9, hotParts: false, blinding: false })
    expect(requests).toContainEqual({ type: 'ignite', point: [3, 0.1, 4], radius: 4 })
  })

  it('a blast above the ground leaves no marks and digs nothing', () => {
    const { world, requests } = makeWorld()
    world.explosion('test_blast', [0, 5, 0])
    expect(world.pools().marks.entries).toHaveLength(0)
    expect(requests.some((request) => request.type === 'crater')).toBe(false)
  })

  it('digs the ground field it was given', () => {
    const ground = createGroundField()
    const { world } = makeWorld({ ground })
    world.explosion('test_blast', ORIGIN)
    expect(ground.heightAt(0, 0)).toBeLessThan(0)
    world.clear()
    expect(ground.heightAt(0, 0)).toBe(0)
  })

  it('the distance bands and the area cap scale the effect, the cap only past the sixth', () => {
    const { world } = makeWorld()
    world.setCamera([0, 1.6, 100])
    world.explosion('test_blast', ORIGIN)
    expect(world.stats().lod).toBe(0.1)
    const near = makeWorld()
    near.world.setCamera([0, 1.6, 1])
    const scales: number[] = []
    for (let index = 0; index < 8; index++) {
      near.world.explosion('test_blast', ORIGIN)
      scales.push(near.world.stats().lod)
    }
    expect(scales).toEqual([1, 1, 1, 1, 1, 1, 0.3, 0.3])
  })

  it('forceLod pins the scale and null gives the bands back', () => {
    const { world } = makeWorld({ areaCap: false })
    world.forceLod(0.5)
    world.explosion('test_blast', ORIGIN)
    expect(world.stats().lod).toBe(0.5)
    world.forceLod(null)
    world.setCamera([0, 1.6, 1])
    world.explosion('test_blast', ORIGIN)
    expect(world.stats().lod).toBe(1)
  })

  it('a delayed explosion goes off when its time comes', () => {
    const { world } = makeWorld()
    world.explosion('test_blast', ORIGIN, { delay: 0.5 })
    expect(world.stats().puffs).toBe(0)
    run(world, 0.45)
    expect(world.stats().puffs).toBe(0)
    run(world, 0.1)
    expect(world.stats().puffs).toBeGreaterThan(0)
  })

  it('scale makes a bigger explosion: radius, marks and mushroom grow', () => {
    const { world, requests } = makeWorld()
    world.explosion('test_blast', ORIGIN, { scale: 2 })
    expect(requests.find((request) => request.type === 'blast_front')).toMatchObject({ lethal: 10, injury: 30 })
    expect(requests.find((request) => request.type === 'crater')).toMatchObject({ radius: 1.8, depth: 0.5 })
    expect(world.pools().rings.items[0]!.R1).toBe(3)
  })

  it('a flash grenade blinds whoever is near and nobody far, and a reduced-motion world never flashes', () => {
    const flashbang: ExplosionDef = { ...TEST_BLAST, id: 'flash', flash: { light: 160, blinding: true }, shock: false }
    const near = makeWorld({ explosions: { flash: flashbang }, areaCap: false })
    near.world.setCamera([0, 1.6, 20])
    near.world.explosion('flash', ORIGIN)
    expect(near.world.screen().flash).toBe(1)
    expect(near.world.screen().flashDecay).toBe(0.5)
    expect(near.world.pools().glows.items.filter((glow) => !glow.follow)).toHaveLength(1)
    const far = makeWorld({ explosions: { flash: flashbang }, areaCap: false })
    far.world.setCamera([0, 1.6, 60])
    far.world.explosion('flash', ORIGIN)
    expect(far.world.screen().flash).toBe(0)
    const still = makeWorld({ explosions: { flash: flashbang }, areaCap: false, reducedMotion: true })
    still.world.setCamera([0, 1.6, 5])
    still.world.explosion('flash', ORIGIN)
    expect(still.world.screen().flash).toBe(0)
  })

  it('shakes the screen less the farther the camera is', () => {
    const near = makeWorld({ areaCap: false })
    near.world.setCamera([0, 1.6, 1])
    near.world.explosion('test_blast', ORIGIN)
    const far = makeWorld({ areaCap: false })
    far.world.setCamera([0, 1.6, 30])
    far.world.explosion('test_blast', ORIGIN)
    expect(near.world.screen().shake).toBeGreaterThan(far.world.screen().shake)
    expect(far.world.screen().shake).toBeCloseTo(1.1 / (1 + Math.hypot(30, 1.5) * 0.12), 6)
  })

  it('a lingering fire grows, gives flames and smoke, fades and ends', () => {
    const { world } = makeWorld({ areaCap: false })
    const handle = world.fire({ point: [0, 0, 0], radius: 1, life: 3, grow: 1, startRadius: 0.2 })
    run(world, 1)
    expect(world.stats().puffs).toBeGreaterThan(5)
    expect(world.pools().lights.fire[0]!.intensity).toBeGreaterThan(0)
    run(world, 3)
    expect(world.stats().fires).toBe(0)
    const again = world.fire({ point: [0, 0, 0], radius: 1, life: 30 })
    world.stop(again)
    world.stop(handle)
    expect(world.stats().fires).toBe(0)
  })

  it('a fire follows what it is given', () => {
    const { world } = makeWorld({ areaCap: false })
    const target = { x: 1, y: 2, z: 3 }
    world.fire({ point: [0, 0, 0], radius: 0.5, life: 5, follow: { position: target } })
    target.x = 8
    world.update(1 / 60)
    expect(world.pools().lights.fire[0]!.x).toBe(8)
  })

  it('push moves the smoke around a point outwards', () => {
    const { world } = makeWorld({ areaCap: false })
    world.explosion('test_blast', [0, 0.1, 0])
    const puff = world.pools().puffs.items[0]!
    const before = puff.vx
    world.push([puff.x - 1, puff.y, puff.z], 3, 10)
    expect(puff.vx).toBeGreaterThan(before)
  })

  it('clear takes everything away and starts the clock again', () => {
    const { world } = makeWorld()
    world.explosion('test_blast', ORIGIN, { delay: 5 })
    world.explosion('test_blast', ORIGIN)
    run(world, 1)
    world.clear()
    const stats = world.stats()
    expect([stats.puffs, stats.sparks, stats.glows, stats.chunks, stats.fires, stats.shocks, stats.rings]).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(world.pools().marks.entries).toHaveLength(0)
    expect(world.time()).toBe(0)
    expect(world.screen().shake).toBe(0)
    run(world, 6)
    expect(world.stats().puffs).toBe(0)
  })

  it('the pools never grow past their profile, and the oldest puffs go first', () => {
    const { world } = makeWorld({ profile: { puffs: 40, sparks: 30, glows: 10, chunks: 8, sprites: { add: 1, normal: 1 }, streaks: 1, debris: 1 }, areaCap: false })
    for (let index = 0; index < 5; index++) world.explosion('test_blast', ORIGIN)
    const stats = world.stats()
    expect(stats.puffs).toBe(40)
    expect(stats.sparks).toBe(30)
    expect(stats.chunks).toBe(8)
    expect(stats.glows).toBeLessThanOrEqual(10)
  })

  it('keeps reusing the same records after many frames (nothing is allocated per frame)', () => {
    const { world } = makeWorld({ areaCap: false })
    world.explosion('test_blast', ORIGIN)
    const seen = new Set(world.pools().puffs.items)
    run(world, 12)
    world.explosion('test_blast', ORIGIN)
    const reused = world.pools().puffs.items.filter((puff) => seen.has(puff)).length
    expect(reused).toBeGreaterThan(30)
  })

  it('the colours of an explosion are converted once, at spawn', () => {
    const { world } = makeWorld({ areaCap: false })
    world.explosion('test_blast', ORIGIN)
    const fireballs = world.pools().puffs.items.filter((puff) => puff.kind === 0 && puff.heat >= 0).slice(0, 10)
    const first = fireballs[0]!.color
    expect(fireballs.every((puff) => puff.color === first)).toBe(true)
  })

  it('a hot piece is followed by a halo and leaves an ember trail while it flies', () => {
    const { world } = makeWorld({ areaCap: false })
    world.explosion('test_blast', ORIGIN)
    const sparksBefore = world.pools().sparks.count
    expect(world.pools().chunks.items.some((chunk) => chunk.hot && chunk.glow)).toBe(true)
    run(world, 0.2)
    expect(world.pools().sparks.count).toBeGreaterThan(sparksBefore - 5)
    run(world, 6)
    expect(world.pools().chunks.items.every((chunk) => chunk.rest)).toBe(true)
  })

  it('a cone profile aims its shrapnel where it is pointed', () => {
    const claymore: ExplosionDef = { ...TEST_BLAST, id: 'claymore', cone: { angle: 0, half: Math.PI / 6, length: 50 }, shrapnel: { count: 60, kind: 1, speed: 55 }, chunks: { count: 0, colors: [], hot: 0 } }
    const { world, requests } = makeWorld({ explosions: { claymore }, areaCap: false })
    world.setCamera([0, 1.6, 1])
    world.explosion('claymore', ORIGIN, { direction: [0, 0, 1] })
    const sparks = world.pools().sparks.items.filter((spark) => spark.kind === 1)
    expect(sparks.length).toBe(60)
    expect(sparks.every((spark) => spark.vz > 0 && spark.vz > Math.abs(spark.vx) * 0.5)).toBe(true)
    const front = requests.find((request) => request.type === 'blast_front')
    expect(front && 'cone' in front && front.cone?.angle).toBeCloseTo(Math.PI / 2, 12)
  })

  it('tells a listener each mark the moment it is made, and when they are cleared', () => {
    const { world } = makeWorld({ ground: createGroundField() })
    const events: string[] = []
    const stop = world.onMarks((event) => events.push(event.type === 'add' ? event.mark.kind : 'clear'))
    world.explosion('test_blast', ORIGIN)
    expect(events[0]).toBe('dirt')
    expect(events).toContain('scorch')
    expect(events.filter((kind) => kind === 'rock').length).toBeGreaterThan(5)
    world.clear()
    expect(events.at(-1)).toBe('clear')
    stop()
    world.explosion('test_blast', ORIGIN)
    expect(events.at(-1)).toBe('clear')
  })

  it('a trace hears what spawns, in order, and the shared stream state is readable', () => {
    const heard: string[] = []
    const { world } = makeWorld({ randomMode: 'shared', trace: { light: () => heard.push('light'), glow: () => heard.push('glow'), puff: () => heard.push('puff'), shock: () => heard.push('shock') } })
    const before = world.randomState()
    world.setCamera([0, 1.6, 1])
    world.explosion('test_blast', ORIGIN)
    expect(heard.slice(0, 4)).toEqual(['light', 'glow', 'glow', 'puff'])
    expect(heard).toContain('shock')
    expect(world.randomState()).not.toBe(before)
    expect(world.fires().length).toBe(1)
  })
})

describe('the wind', () => {
  it('starts at the option and is moved by the weather', () => {
    const { world } = makeWorld({ wind: [1, 0, 0.5] })
    expect(world.wind()).toEqual([1, 0, 0.5])
    world.setWind([4.5, 0, -2])
    expect(world.wind()).toEqual([4.5, 0, -2])
  })

  it('carries the smoke the other way when the wind turns', () => {
    const drift = (wind: [number, number, number]): number => {
      const { world } = makeWorld({ wind })
      world.explosion('test_blast', ORIGIN)
      for (let frame = 0; frame < 120; frame++) world.update(1 / 60)
      let sum = 0
      for (const puff of world.pools().puffs.items) sum += puff.x
      return sum
    }
    expect(drift([6, 0, 0])).toBeGreaterThan(drift([-6, 0, 0]))
  })
})
