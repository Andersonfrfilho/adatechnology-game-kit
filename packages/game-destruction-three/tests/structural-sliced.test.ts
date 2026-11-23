import * as THREE from 'three'
import type { DestructionEvent, ExplosionJob, HitResult } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { createBlastPacer } from '../src/blast-pacer'
import { EVENT_APPLY_WEIGHT } from '../src/event-weight'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const FRAME = 1 / 60

type Renderer = ReturnType<typeof createDestructionRenderer>
type Emitted = Parameters<FakeWorld['emit']>[0]

/** Two objects with a base and a loose group each; `applied` lists every event the renderer applies, in order. */
function scene(): { readonly world: FakeWorld; readonly renderer: Renderer; readonly applied: DestructionEvent[]; readonly sounds: string[] } {
  const threeScene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene: threeScene, world: world.asWorld(), onSound: (key) => sounds.push(key) })
  for (const id of ['o1', 'o2']) {
    world.addObject(id, [partState('base', 'glass'), partState('b', 'glass')], [['base'], ['b']])
    const root = new THREE.Group()
    const meshes: Record<string, THREE.Mesh> = {}
    for (const [index, part] of ['base', 'b'].entries()) {
      meshes[part] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
      meshes[part]!.position.set(index, 0.1, id === 'o1' ? 0 : 2)
      root.add(meshes[part]!)
    }
    threeScene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: meshes })
  }
  const applied: DestructionEvent[] = []
  const host = renderer as unknown as { apply(event: DestructionEvent): void }
  const apply = host.apply.bind(renderer)
  host.apply = (event) => {
    applied.push(event)
    apply(event)
  }
  return { world, renderer, applied, sounds }
}

const hole = (object: string): Emitted => ({ type: 'hole', object, part: 'b', hole: { normal: [0, 1, 0], diameter: 0.01, through: false }, worldPoint: [1, 0.2, 0], blow: undefined }) as unknown as Emitted
const detach = (object: string): Emitted => ({ type: 'detach', object, part: 'b', by: 'force' }) as unknown as Emitted
const crack = (object: string): Emitted => ({ type: 'crack', object, part: 'base', time: 0 }) as unknown as Emitted

/** A blast's worth of events: visual ones around structural ones of two objects, a visual one of an object after its structural one, and a visual tail. */
const BLAST: readonly Emitted[] = [hole('o1'), crack('o2'), hole('o2'), detach('o2'), hole('o1'), crack('o1'), detach('o1'), hole('o2'), crack('o1'), crack('o2')]

const emitAll = (world: FakeWorld): void => {
  for (const event of BLAST) world.emit(event)
}

describe('applyStructuralEventsSliced: the whole call cut by fixed weights (spec 018 D2)', () => {
  it('applies the same events in the same order as applyStructuralEvents for any units per slice, the tail last', () => {
    const whole = scene()
    whole.renderer.setStructuralInTick(true)
    emitAll(whole.world)
    whole.renderer.applyStructuralEvents()
    whole.renderer.deferredQueue().flush()
    expect(whole.applied).toHaveLength(BLAST.length)
    for (const units of [1, 10, 15, 25, 1000]) {
      const cut = scene()
      cut.renderer.setStructuralInTick(true)
      emitAll(cut.world)
      let slices = 0
      while (cut.renderer.applyStructuralEventsSliced(units) > 0) slices++
      cut.renderer.deferredQueue().flush()
      expect(cut.applied, `units ${units}`).toEqual(whole.applied)
      if (units < 25) expect(slices).toBeGreaterThan(0)
    }
  })

  it('a slice stops where the next event would pass its units, and always applies at least one', () => {
    const { world, renderer, applied } = scene()
    renderer.setStructuralInTick(true)
    emitAll(world)
    // one unit: one event, whatever it weighs; the rest of the batch up to its last structural event stays held
    expect(renderer.applyStructuralEventsSliced(1)).toBeGreaterThan(5)
    expect(applied).toHaveLength(1)
    const before = applied.length
    renderer.applyStructuralEventsSliced(EVENT_APPLY_WEIGHT.hole + EVENT_APPLY_WEIGHT.crack)
    const spent = applied.slice(before).reduce((sum, event) => sum + EVENT_APPLY_WEIGHT[event.type], 0)
    expect(spent).toBeLessThanOrEqual(EVENT_APPLY_WEIGHT.hole + EVENT_APPLY_WEIGHT.crack)
    expect(renderer.structuralBacklog()).toBeGreaterThan(0)
    // the tick applies what is left first, then the queue
    renderer.applyStructuralEvents()
    expect(renderer.structuralBacklog()).toBe(0)
  })

  it('held, a frame drains nothing and the stall watch never dumps; let go, the frame drains the visual events ahead again', () => {
    const { world, renderer, applied } = scene()
    const queue = renderer.deferredQueue()
    renderer.setStructuralInTick(true)
    renderer.holdEvents(true)
    emitAll(world)
    for (let frame = 1; frame <= 20; frame++) if (queue.pending(frame) > 0) queue.run(Infinity, () => 0)
    renderer.update(FRAME)
    expect(applied).toHaveLength(0)
    renderer.applyStructuralEvents()
    expect(applied).toHaveLength(0)
    renderer.holdEvents(false)
    renderer.update(FRAME)
    expect(applied.length).toBeGreaterThan(0)
    expect(applied.every((event) => event.type !== 'detach')).toBe(true)
    // while slices are held the stall watch stays quiet too
    renderer.applyStructuralEventsSliced(1)
    for (let frame = 21; frame <= 40; frame++) if (queue.pending(frame) > 0) queue.run(Infinity, () => 0)
    expect(renderer.structuralBacklog()).toBeGreaterThan(0)
  })
})

/** A job of `slices` calls whose events are emitted by the fake world as it advances. */
const fakeJob = (world: FakeWorld, slices: number, log: string[], name: string): ExplosionJob => {
  let left = slices
  const results: HitResult[] = [{ object: name, damage: 1, penetrated: false, exitEnergy: 0, events: [] }]
  return {
    get isDone() {
      return left === 0
    },
    advance() {
      if (left === 0) return true
      left--
      log.push(`${name}:${slices - left}`)
      world.emit(left === 0 ? detach('o1') : hole('o1'))
      return left === 0
    },
    result() {
      if (left > 0) throw new Error('not done')
      return results
    },
  }
}

describe('createBlastPacer (spec 018 D2)', () => {
  it('holds while the blast runs (one slice a frame, the first in begin) and while its structural events apply, then lets go', () => {
    const { world, renderer, applied } = scene()
    renderer.setStructuralInTick(true)
    const log: string[] = []
    const jobs = [fakeJob(world, 3, log, 'a')]
    const pacer = createBlastPacer({ world: { beginExplosion: () => jobs.shift()!, cancelExplosions: () => undefined }, renderer, unitsPerFrame: 1 })
    const done: string[] = []
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, (results) => done.push(results[0]!.object))
    expect(log).toEqual(['a:1'])
    expect(pacer.isHolding()).toBe(true)
    pacer.step()
    expect(log).toEqual(['a:1'])
    pacer.step()
    pacer.step()
    expect(log).toEqual(['a:1', 'a:2', 'a:3'])
    expect(done).toEqual(['a'])
    expect(applied).toHaveLength(0)
    let frames = 0
    while (pacer.isHolding() && frames < 10) {
      pacer.step()
      frames++
    }
    expect(pacer.isHolding()).toBe(false)
    expect(applied.map((event) => event.type)).toEqual(['hole', 'hole', 'detach'])
    expect(frames).toBe(3)
  })

  it('a second blast waits for the first; a blast that fits in one slice holds nothing', () => {
    const { world, renderer } = scene()
    const log: string[] = []
    const jobs = [fakeJob(world, 2, log, 'a'), fakeJob(world, 2, log, 'b'), fakeJob(world, 1, log, 'c')]
    const pacer = createBlastPacer({ world: { beginExplosion: () => jobs.shift()!, cancelExplosions: () => undefined }, renderer })
    const done: string[] = []
    const onDone = (results: HitResult[]): void => void done.push(results[0]!.object)
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, onDone)
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, onDone)
    expect(log).toEqual(['a:1'])
    for (let frame = 0; frame < 4; frame++) pacer.step()
    expect(log).toEqual(['a:1', 'a:2', 'b:1', 'b:2'])
    expect(done).toEqual(['a', 'b'])
    while (pacer.isHolding()) pacer.step()
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, onDone)
    expect(done).toEqual(['a', 'b', 'c'])
    expect(pacer.isHolding()).toBe(false)
  })

  it('a slice that throws drops its blast (no onDone), lets go of both holds and throws on; in begin too', () => {
    const { world, renderer, applied } = scene()
    renderer.setStructuralInTick(true)
    const failing = (failOn: number): ExplosionJob => {
      let calls = 0
      let failure: Error | undefined
      return {
        get isDone() {
          return failure !== undefined
        },
        advance() {
          calls++
          world.emit(hole('o1'))
          if (calls < failOn) return false
          failure = new Error('step threw')
          throw failure
        },
        result() {
          throw failure ?? new Error('not done')
        },
      }
    }
    const jobs = [failing(2), failing(1)]
    const pacer = createBlastPacer({ world: { beginExplosion: () => jobs.shift()!, cancelExplosions: () => undefined }, renderer })
    const done: string[] = []
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, () => done.push('a'))
    expect(pacer.isHolding()).toBe(true)
    pacer.step()
    expect(() => pacer.step()).toThrow('step threw')
    expect(pacer.isHolding()).toBe(false)
    // the events are not held any more: the frame draws them
    renderer.update(FRAME)
    expect(applied.length).toBeGreaterThan(0)
    expect(() => pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, () => done.push('b'))).toThrow('step threw')
    expect(pacer.isHolding()).toBe(false)
    expect(done).toEqual([])
  })

  it('a blast begun inside the step of another (already whole) is told at once, before the one that set it off, and holds nothing more', () => {
    const { world, renderer } = scene()
    const log: string[] = []
    const done: string[] = []
    const host: { pacer?: ReturnType<typeof createBlastPacer> } = {}
    const chained = fakeJob(world, 0, log, 'chained')
    const outer = fakeJob(world, 2, log, 'outer')
    const outerAdvance = outer.advance.bind(outer)
    // the first slice of `outer` sets off a charge whose blast runs whole inside it
    let isChaining = true
    outer.advance = (rays, parts) => {
      if (isChaining) {
        isChaining = false
        host.pacer?.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, () => done.push('chained'))
      }
      return outerAdvance(rays, parts)
    }
    const jobs = [outer, chained]
    const pacer = createBlastPacer({ world: { beginExplosion: () => jobs.shift()!, cancelExplosions: () => undefined }, renderer })
    host.pacer = pacer
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, () => done.push('outer'))
    expect(done).toEqual(['chained'])
    pacer.step()
    pacer.step()
    expect(done).toEqual(['chained', 'outer'])
    let frames = 0
    while (pacer.isHolding() && frames < 10) {
      pacer.step()
      frames++
    }
    expect(frames).toBeLessThan(4)
  })

  it('clear drops the open blast (no onDone), cancels it in the world and lets go of both holds', () => {
    const { world, renderer, applied } = scene()
    renderer.setStructuralInTick(true)
    const log: string[] = []
    let cancelled = 0
    const jobs = [fakeJob(world, 4, log, 'a')]
    const pacer = createBlastPacer({ world: { beginExplosion: () => jobs.shift()!, cancelExplosions: () => void cancelled++ }, renderer })
    const done: string[] = []
    pacer.begin({ point: [0, 0, 0], energy: 1, radius: 1 }, () => done.push('a'))
    pacer.step()
    pacer.step()
    pacer.clear()
    expect(cancelled).toBe(1)
    expect(pacer.isHolding()).toBe(false)
    pacer.step()
    expect(log).toEqual(['a:1', 'a:2'])
    expect(done).toEqual([])
    // the renderer's clear drops what it held
    renderer.holdEvents(true)
    renderer.applyStructuralEventsSliced(1)
    renderer.clear()
    expect(renderer.structuralBacklog()).toBe(0)
    world.emit(hole('o1'))
    renderer.update(FRAME)
    expect(applied.some((event) => event.type === 'hole')).toBe(true)
  })
})
