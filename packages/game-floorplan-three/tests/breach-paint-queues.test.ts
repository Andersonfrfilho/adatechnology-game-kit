import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

type WallMaskLike = { readonly data: Uint8Array }
type Scene = ReturnType<typeof setup>

function setup() {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const houseRenderer = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  const { house } = houseRenderer
  scene.add(house.group)
  const d = house.destruction
  d.activate()
  return { d, house, world, paintQueue: d.breach.deferredQueue(), cutQueue: houseRenderer.renderer.cutQueue!() }
}

const attach = (scene: Scene): void => {
  scene.cutQueue.attach?.()
  scene.paintQueue.attach?.()
}

const detach = (scene: Scene): void => {
  scene.cutQueue.detach?.()
  scene.paintQueue.detach?.()
}

/** Rifle rounds along the length of a wall: chips and spalls, no opening. */
const burstOn = (scene: Scene, id: string, rounds: number, energy = 3500): void => {
  const p = scene.house.structure.byId.get(id)!
  const along = p.aabb[2] - p.aabb[0] > p.aabb[3] - p.aabb[1]
  for (let k = 0; k < rounds; k++) {
    const x = along ? p.aabb[0] + 0.6 + k * 0.25 : (p.aabb[0] + p.aabb[2]) / 2
    const z = along ? (p.aabb[1] + p.aabb[3]) / 2 : p.aabb[1] + 0.6 + k * 0.25
    scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: [x, (p.y0 + p.y1) / 2, z], direction: along ? [0, 0, -1] : [-1, 0, 0], energy, caliber: 7.62 })
  }
}

/** A blow that opens the wall (stage 2 with an opening, read when the event reaches the listeners after the breach's own). */
const openingOn = (scene: Scene, id: string): { cutPending: number; painted: string[] } => {
  const p = scene.house.structure.byId.get(id)!
  const seen = { cutPending: -1, painted: [] as string[] }
  scene.world.on('stage', (raw: DestructionEvent) => {
    const event = raw as Extract<DestructionEvent, { type: 'stage' }>
    if (event.part !== id || event.stage !== 2 || !event.opening) return
    seen.cutPending = scene.cutQueue.pending()
    seen.painted = paintedWalls(scene)
  })
  scene.world.hitPart(scene.d.id!, id, { type: 'blunt', point: [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2], energy: 3e4, radius: 0.35, source: 'test' })
  for (let t = 0; t < 0.5; t += 0.05) scene.world.update(0.05)
  return seen
}

/** Every wall mask of the house, keyed by where its shell stands: the ones that carry paint. */
const masksOf = (scene: Scene): Map<string, string> => {
  const found = new Map<string, string>()
  scene.house.group.traverse((object) => {
    const mask = (object.userData as { breachMask?: { texture: { image: WallMaskLike } } }).breachMask
    if (!mask) return
    const box = new THREE.Box3().setFromObject(object)
    const centre = box.getCenter(new THREE.Vector3())
    found.set(`${centre.x.toFixed(3)},${centre.y.toFixed(3)},${centre.z.toFixed(3)}`, Array.from(mask.texture.image.data).join(','))
  })
  return found
}

const paintedWalls = (scene: Scene): string[] => [...masksOf(scene)].filter(([, texels]) => texels.includes('255')).map(([key]) => key)

/** The walls in the order the paint queue paints them: one unit per call (a deadline already past). */
const paintOrder = (scene: Scene): string[] => {
  const order: string[] = []
  const seen = new Set(paintedWalls(scene))
  for (let guard = 0; guard < 1000 && scene.paintQueue.pending() > 0; guard++) {
    expect(scene.paintQueue.run(0, () => 1)).toBe(1)
    for (const key of paintedWalls(scene)) if (!seen.has(key)) { seen.add(key); order.push(key) }
  }
  return order
}

const chipsOnly = (scene: Scene): void => {
  burstOn(scene, 'wall_0_0', 3, 800)
  burstOn(scene, 'wall_0_1', 3, 800)
  burstOn(scene, 'wall_0_2', 3, 800)
}

describe('the cut queue gets the impact and the paint queue the rest, one wall a unit (spec 017, T3.1)', () => {
  it('walls with only chips and spalls wait in the paint queue: the cut queue has nothing and paints none of them', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    expect(s.cutQueue.pending()).toBe(0)
    expect(s.paintQueue.pending()).toBeGreaterThan(1)
    expect(paintedWalls(s)).toEqual([])
    detach(s)
  })

  it('a wall that got an opening is painted by the cut queue, at the strike, and does not wait in the paint queue', () => {
    const s = setup()
    attach(s)
    const seen = openingOn(s, 'wall_0_0')
    expect(seen.cutPending).toBe(1)
    expect(seen.painted).toEqual([])
    expect(s.paintQueue.pending()).toBe(0)
    detach(s)
  })

  it('a wall that fell is painted at the strike and leaves the paint queue', () => {
    const s = setup()
    attach(s)
    burstOn(s, 'wall_0_1', 3, 800)
    const waiting = s.paintQueue.pending()
    expect(waiting).toBeGreaterThan(0)
    s.d.breach.drop('wall_0_1')
    expect(s.paintQueue.pending()).toBe(waiting - 1)
    expect(s.cutQueue.pending()).toBe(0)
    detach(s)
  })

  it('one paint unit paints one wall', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    const waiting = s.paintQueue.pending()
    expect(s.paintQueue.run(0, () => 1)).toBe(1)
    expect(s.paintQueue.pending()).toBe(waiting - 1)
    expect(paintedWalls(s)).toHaveLength(1)
    detach(s)
  })

  it('the paint queue paints the wall nearest to the last strike first, and the order is the same in every run', () => {
    const run = (): string[] => {
      const s = setup()
      attach(s)
      burstOn(s, 'wall_0_0', 3, 800)
      burstOn(s, 'wall_0_1', 3, 800)
      burstOn(s, 'wall_0_2', 3, 800)
      const order = paintOrder(s)
      detach(s)
      return order
    }
    const first = run()
    expect(first.length).toBeGreaterThan(1)
    expect(run()).toEqual(first)

    const lastOnly = setup()
    attach(lastOnly)
    burstOn(lastOnly, 'wall_0_2', 3, 800)
    lastOnly.paintQueue.run(0, () => 1)
    expect(paintedWalls(lastOnly)).toContain(first[0])
    detach(lastOnly)
  })

  it('the paint queue asks the budget to run it at least every 3 frames', () => {
    expect(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT].minEveryFrames).toBe(3)
    expect(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT]).not.toHaveProperty('mustDrain')
  })

  it('a strike on a wall whose paint waits from an earlier frame moves it to the cut queue', () => {
    const s = setup()
    attach(s)
    burstOn(s, 'wall_0_1', 3, 800)
    expect(s.paintQueue.pending()).toBeGreaterThan(0)
    expect(s.cutQueue.pending()).toBe(0)
    // a later frame: the budget polls the cut queue with the next frame number
    s.cutQueue.pending(1)
    s.cutQueue.pending(2)
    burstOn(s, 'wall_0_1', 6, 800)
    expect(s.cutQueue.pending()).toBe(1)
    s.cutQueue.run(0, () => 1)
    expect(paintedWalls(s).length).toBeGreaterThan(0)
    detach(s)
  })

  it('a second strike in the same frame does not move a waiting wall to the cut queue', () => {
    const s = setup()
    attach(s)
    burstOn(s, 'wall_0_1', 3, 800)
    burstOn(s, 'wall_0_1', 2, 800)
    expect(s.cutQueue.pending()).toBe(0)
    detach(s)
  })

  it('the paint queue keeps the deferred-queue contract', () => {
    const s = setup()
    const report = checkDeferredQueue(s.paintQueue, () => chipsOnly(s))
    expect(report.problems).toEqual([])
  })

  it('without a host the walls are painted at the strike, as before', () => {
    const s = setup()
    burstOn(s, 'wall_0_1', 3, 800)
    expect(s.cutQueue.pending()).toBe(0)
    s.d.breach.flush(Infinity)
    expect(paintedWalls(s).length).toBeGreaterThan(0)
    expect(s.paintQueue.pending()).toBe(0)
  })
})
