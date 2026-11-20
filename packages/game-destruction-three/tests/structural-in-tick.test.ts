import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const FRAME = 1 / 60

/** One object `o1` with a base and a loose group `b`; `sounds` collects the keys the renderer plays. */
function scene(): { readonly world: FakeWorld; readonly renderer: ReturnType<typeof createDestructionRenderer>; readonly sounds: string[] } {
  const threeScene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene: threeScene, world: world.asWorld(), onSound: (key) => sounds.push(key) })
  world.addObject('o1', [partState('base', 'glass'), partState('b', 'glass')], [['base'], ['b']])
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const [index, id] of ['base', 'b'].entries()) {
    meshes[id] = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    meshes[id]!.position.set(index, 0.1, 0)
    root.add(meshes[id]!)
  }
  threeScene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  return { world, renderer, sounds }
}

const emitHole = (world: FakeWorld): void => world.emit({ type: 'hole', object: 'o1', part: 'b', hole: { normal: [0, 1, 0], diameter: 0.01, through: false }, worldPoint: [1, 0.2, 0], blow: undefined })
const emitDetach = (world: FakeWorld): void => world.emit({ type: 'detach', object: 'o1', part: 'b', by: 'force' })
const shots = (sounds: readonly string[]): number => sounds.filter((key) => key.startsWith('shot_')).length

describe('structural events apply at the end of the tick when the host asks (spec 017 T2.2)', () => {
  it('without a host the frame applies them, as before', () => {
    const { world, renderer, sounds } = scene()
    emitDetach(world)
    renderer.update(FRAME)
    expect(sounds).toContain('detach')
  })

  it('in tick mode a frame without a tick leaves them waiting, and the next tick applies them', () => {
    const { world, renderer, sounds } = scene()
    renderer.setStructuralInTick(true)
    emitDetach(world)
    renderer.update(FRAME)
    expect(sounds).not.toContain('detach')
    renderer.applyStructuralEvents()
    expect(sounds).toContain('detach')
  })

  it('in tick mode the visual events of the object, even one emitted after the structural one, are drawn before it, in the tick', () => {
    const { world, renderer, sounds } = scene()
    renderer.setStructuralInTick(true)
    emitHole(world)
    emitDetach(world)
    emitHole(world)
    renderer.applyStructuralEvents()
    expect(shots(sounds)).toBe(2)
    expect(sounds.indexOf('detach')).toBeGreaterThan(sounds.findIndex((key) => key.startsWith('shot_')))
    renderer.update(FRAME)
    expect(shots(sounds)).toBe(2)
  })

  it('a visual event ahead of a structural one that waits is drawn by the frame', () => {
    const { world, renderer, sounds } = scene()
    renderer.setStructuralInTick(true)
    emitHole(world)
    emitDetach(world)
    renderer.update(FRAME)
    expect(shots(sounds)).toBe(1)
    expect(sounds).not.toContain('detach')
  })

  it('a flush applies everything, tick mode or not', () => {
    const { world, renderer, sounds } = scene()
    renderer.setStructuralInTick(true)
    emitDetach(world)
    renderer.deferredQueue().flush()
    expect(sounds).toContain('detach')
  })
})

describe('the queue cap keeps what changes the simulation (spec 017 T2.2)', () => {
  const CAP = 4000

  it('past the cap a chip, a dent and a spall are kept and a hole is dropped', () => {
    const { world, renderer } = scene()
    const base = renderer.deferredQueue().pending()
    const pending = (): number => renderer.deferredQueue().pending() - base
    for (let i = 0; i < CAP; i++) world.emit({ type: 'damage', object: 'o1', part: 'b', amount: 1, hp: 99, damageType: 'blunt', time: 0 })
    expect(pending()).toBe(CAP)
    emitHole(world)
    expect(pending()).toBe(CAP)
    world.emit({ type: 'dent', object: 'o1', part: 'b', time: 0 } as never)
    world.emit({ type: 'chip', object: 'o1', part: 'b', time: 0 } as never)
    world.emit({ type: 'spall', object: 'o1', part: 'b', time: 0 } as never)
    expect(pending()).toBe(CAP + 3)
  })
})

describe('a structural event never waits for ever for a tick (spec 017 T2.2)', () => {
  it('with no tick it applies by the eighth frame', () => {
    const { world, renderer, sounds } = scene()
    const queue = renderer.deferredQueue()
    renderer.setStructuralInTick(true)
    emitDetach(world)
    let appliedAt = 0
    for (let frame = 1; frame <= 12 && appliedAt === 0; frame++) {
      if (queue.pending(frame) > 0) queue.run(Infinity, () => 0)
      if (sounds.includes('detach')) appliedAt = frame
    }
    expect(appliedAt).toBeGreaterThan(0)
    expect(appliedAt).toBeLessThanOrEqual(8)
  })

  it('at 144 Hz, with ticks every other frame, the watch never fires', () => {
    const { world, renderer, sounds } = scene()
    const queue = renderer.deferredQueue()
    renderer.setStructuralInTick(true)
    for (let frame = 1; frame <= 40; frame++) {
      if (frame % 20 === 1) emitDetach(world)
      if (queue.pending(frame) > 0) queue.run(Infinity, () => 0)
      expect(sounds, `frame ${frame}`).not.toContain('detach')
      if (frame % 2 === 0) renderer.applyStructuralEvents()
      if (frame % 2 === 0) sounds.length = 0
    }
  })
})

describe('dispose with events waiting (spec 017 T2.2)', () => {
  it('empties the queue and takes no more', () => {
    const { world, renderer } = scene()
    renderer.setStructuralInTick(true)
    emitHole(world)
    emitDetach(world)
    renderer.dispose?.()
    expect(renderer.deferredQueue().pending()).toBe(0)
    emitDetach(world)
    expect(renderer.deferredQueue().pending()).toBe(0)
    expect(() => renderer.applyStructuralEvents()).not.toThrow()
  })
})
