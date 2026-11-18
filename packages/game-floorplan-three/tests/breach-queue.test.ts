import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { checkDeferredQueue } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

function setup() {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const houseRenderer = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  const { house } = houseRenderer
  scene.add(house.group)
  const d = house.destruction
  d.activate()
  const centre = (id: string): [number, number, number] => { const p = house.structure.byId.get(id); return [(p!.aabb[0] + p!.aabb[2]) / 2, (p!.y0 + p!.y1) / 2, (p!.aabb[1] + p!.aabb[3]) / 2] }
  const shoot = (): void => {
    for (const id of ['wall_0_0', 'wall_0_1', 'wall_0_2']) world.hitPart(d.id!, id, { type: 'ballistic', point: centre(id), direction: [0, 0, -1], energy: 500, caliber: 9 })
  }
  return { d, house, world, shoot, queue: d.breach.deferredQueue(), houseRenderer }
}

describe('breach paint as a deferred queue', () => {
  it('keeps the DeferredQueue contract', () => {
    const { queue, shoot } = setup()
    expect(checkDeferredQueue(queue, shoot)).toEqual({ ok: true, problems: [] })
  })

  it('paints from the frame callback until a budget attaches the queue, and asking for it changes nothing', () => {
    const { d, shoot, queue } = setup()
    shoot()
    expect(queue.pending()).toBeGreaterThan(1)
    d.breach.flush()
    expect(queue.pending()).toBe(0)
  })

  it('stops painting from flush() once attached, still paints an explicit budget, and run() gives the same result as the synchronous flush', () => {
    const synchronous = setup()
    synchronous.shoot()
    synchronous.d.breach.flush(Infinity)
    const expected = synchronous.d.breach.statistics()

    const attached = setup()
    attached.queue.attach?.()
    attached.shoot()
    const waiting = attached.queue.pending()
    attached.d.breach.flush()
    expect(attached.queue.pending()).toBe(waiting)
    attached.queue.run(Infinity, () => 0)
    expect(attached.queue.pending()).toBe(0)
    expect(attached.d.breach.statistics()).toEqual(expected)
  })

  it('paints one wall per call with a deadline already past, in order', () => {
    const { shoot, queue } = setup()
    queue.attach?.()
    shoot()
    const waiting = queue.pending()
    expect(queue.run(0, () => 1)).toBe(1)
    expect(queue.pending()).toBe(waiting - 1)
  })

  it('goes back to painting from flush() on detach, and the renderer queue covers every house', () => {
    const { d, shoot, queue, houseRenderer } = setup()
    expect(houseRenderer.renderer.deferredQueue!().pending()).toBe(0)
    queue.attach?.()
    queue.detach?.()
    shoot()
    expect(houseRenderer.renderer.deferredQueue!().pending()).toBe(queue.pending())
    d.breach.flush()
    expect(queue.pending()).toBe(0)
  })

  it('a wall a burst of rifle rounds cuts many times in one frame is painted once, by the first run of the queue, even with the deadline past', () => {
    const { d, house, world, queue } = setup()
    queue.attach?.()
    const id = 'wall_0_1'
    const p = house.structure.byId.get(id)!
    const along = p.aabb[2] - p.aabb[0] > p.aabb[3] - p.aabb[1]
    const masks = (): Array<{ version: number }> => {
      const found: Array<{ version: number }> = []
      house.group.traverse((object) => {
        const mask = (object.userData as { breachMask?: { texture: { version: number } } }).breachMask
        if (object.name === 'breach-shell' && mask && !found.includes(mask.texture)) found.push(mask.texture)
      })
      return found
    }
    // the first round makes the wall's view; the next ones cut it again in the same frame
    const shot = (k: number) => {
      const x = along ? p.aabb[0] + 0.6 + k * 0.25 : (p.aabb[0] + p.aabb[2]) / 2
      const z = along ? (p.aabb[1] + p.aabb[3]) / 2 : p.aabb[1] + 0.6 + k * 0.25
      world.hitPart(d.id!, id, { type: 'ballistic', point: [x, (p.y0 + p.y1) / 2, z], direction: along ? [0, 0, -1] : [-1, 0, 0], energy: 3500, caliber: 7.62 })
    }
    shot(0)
    queue.run(0, () => 1)
    const before = masks().map((mask) => mask.version)
    expect(before.length).toBeGreaterThan(0)
    for (let k = 1; k <= 5; k++) shot(k)
    expect(masks().map((mask) => mask.version)).toEqual(before)
    expect(queue.pending()).toBeGreaterThan(0)
    queue.run(0, () => 1)
    const after = masks().map((mask) => mask.version)
    expect(after.every((version, k) => version === before[k]! + 1)).toBe(true)
  })
})
