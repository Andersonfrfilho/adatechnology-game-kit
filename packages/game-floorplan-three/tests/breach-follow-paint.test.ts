import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { wallPiece } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { THREE } from './helpers/houses'

// A followed wall (a free-standing wall of a test room) paints its damage once per flush, not once per `chip` event: the repaint of a wall is the costly part of an explosion.

const FALLBACK_MS = 100
const SHOTS = 12

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup() {
  const piece = wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })
  const world = createDestruction({ seed: 1 })
  const id = world.add(piece.spec, { id: 'target' })
  const root = piece.build(THREE)
  const follower = piece.follow(root, world, id)!
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  // `paint` rewrites the wall's mask and core textures and flags each one (`needsUpdate = true`): two flags are one repaint of one wall
  const flags = vi.spyOn(THREE.Texture.prototype, 'needsUpdate', 'set')
  const rifle = (x: number): void => { world.shoot([x, 1.2, 5], [0, 0, -1], 2100, 7.62, 'test') }
  // the first shot creates the wall's view (which flags its textures once): the count starts after it
  rifle(-4.5)
  const flagsAtStart = flags.mock.calls.length
  const repaints = (): number => (flags.mock.calls.length - flagsAtStart) / 2
  const units = (): number => (root.getObjectByName('breach:wall_0_0') as THREE.InstancedMesh | undefined)?.count ?? 0
  const chips = (): number => events.filter((event) => event.type === 'chip').length
  return { world, root, follower, events, rifle, repaints, units, chips }
}

describe('a followed wall paints once per flush (not once per chip)', () => {
  it('many chips in one frame: no repaint before the host flushes, one repaint at the flush', () => {
    const scene = setup()
    for (let shot = 0; shot < SHOTS; shot++) scene.rifle(-3 + shot * 0.3)
    expect(scene.chips()).toBeGreaterThanOrEqual(10)
    expect(scene.repaints()).toBe(0)
    scene.follower.update()
    expect(scene.repaints()).toBe(1)
    expect(scene.units()).toBeGreaterThan(0)
    scene.follower.update()
    expect(scene.repaints()).toBe(1)
    scene.follower.dispose()
  })

  it('a host that never calls update still gets the damage painted, once, after the fallback clock', () => {
    vi.useFakeTimers()
    const scene = setup()
    for (let shot = 0; shot < SHOTS; shot++) scene.rifle(-3 + shot * 0.3)
    vi.advanceTimersByTime(FALLBACK_MS - 1)
    expect(scene.repaints()).toBe(0)
    vi.advanceTimersByTime(1)
    expect(scene.repaints()).toBe(1)
    expect(scene.units()).toBeGreaterThan(0)
    scene.follower.update()
    expect(scene.repaints()).toBe(1)
    scene.follower.dispose()
  })

  // Standing units come from what the world recorded (`breach.standing`, refreshed when stale), not from the paint, which `blocks` reads for the body (spec 017). The house path
  // is covered by breach-standing-timing.test.ts; this is the follower path, which that file does not exercise.
  it('between the blow and the flush a body already walks through the hole the world made (collision reads the damage, not the paint)', () => {
    const scene = setup()
    const body = (x: number): boolean => scene.follower.blocks(x, 0, 0.3, 0.45, 1.75)
    const probes = [-4.6, -2, 0, 1.2, 2.5, 4.6]
    expect(body(0)).toBe(true)
    scene.world.explode([0, 1.4, 0.3], 200000, 16, 'test')
    for (let step = 0; step < 20; step++) scene.world.update(0.1)
    expect(scene.repaints()).toBe(0)
    const beforeFlush = probes.map(body)
    expect(body(0)).toBe(false)
    scene.follower.update()
    expect(scene.repaints()).toBe(1)
    expect(probes.map(body)).toEqual(beforeFlush)
    scene.follower.dispose()
  })

  // Today an opening waits for the flush like a chip: the code comment in `drawIn` still says "only an opening shows at once", which holds for the cut queues, not here.
  it('an opening (stage 2) is drawn at the next flush, not at once', () => {
    const scene = setup()
    const seen: { opening: boolean; repaints: number }[] = []
    scene.world.on('stage', (event) => {
      if (event.type === 'stage' && event.stage === 2) seen.push({ opening: !!event.opening, repaints: scene.repaints() })
    })
    scene.world.hitPart('target', 'wall_0_0', { type: 'ballistic', point: [0, 1.5, 0.1], direction: [0, 0, -1], energy: 400000, caliber: 40 })
    expect(seen).toEqual([{ opening: true, repaints: 0 }])
    expect(scene.repaints()).toBe(0)
    scene.follower.update()
    expect(scene.repaints()).toBe(1)
    scene.follower.dispose()
  })
})
