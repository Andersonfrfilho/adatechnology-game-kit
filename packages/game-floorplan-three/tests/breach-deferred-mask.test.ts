import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

type MaskTexture = { readonly image: { readonly data: Uint8Array } }
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
  return { d, house, world, houseRenderer, paintQueue: d.breach.deferredQueue(), cutQueue: houseRenderer.renderer.cutQueue!() }
}

const centreOf = (scene: Scene, id: string): [number, number, number] => {
  const p = scene.house.structure.byId.get(id)!
  return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2]
}

/** One wall hit by a burst of rifle rounds along its length: cuts, chips and spalls, as the breach tests do. */
const burstOn = (scene: Scene, id: string, rounds: number): void => {
  const p = scene.house.structure.byId.get(id)!
  const along = p.aabb[2] - p.aabb[0] > p.aabb[3] - p.aabb[1]
  for (let k = 0; k < rounds; k++) {
    const x = along ? p.aabb[0] + 0.6 + k * 0.25 : (p.aabb[0] + p.aabb[2]) / 2
    const z = along ? (p.aabb[1] + p.aabb[3]) / 2 : p.aabb[1] + 0.6 + k * 0.25
    scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: [x, (p.y0 + p.y1) / 2, z], direction: along ? [0, 0, -1] : [-1, 0, 0], energy: 3500, caliber: 7.62 })
  }
}

const firstStrike = (scene: Scene): void => {
  for (const id of ['wall_0_0', 'wall_0_1', 'wall_0_2']) scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: centreOf(scene, id), direction: [0, 0, -1], energy: 500, caliber: 9 })
  burstOn(scene, 'wall_0_1', 6)
}

const secondStrike = (scene: Scene): void => {
  burstOn(scene, 'wall_0_2', 4)
  scene.world.hitPart(scene.d.id!, 'wall_0_0', { type: 'ballistic', point: centreOf(scene, 'wall_0_0'), direction: [0, 0, -1], energy: 4000, caliber: 12.7 })
}

/** Every wall mask of the house (the plaster mask of each shell, in scene order, once each): its texels as text. */
const masksOf = (scene: Scene): string[] => {
  const found: MaskTexture[] = []
  scene.house.group.traverse((object) => {
    const mask = (object.userData as { breachMask?: { texture: MaskTexture } }).breachMask
    if (mask && !found.includes(mask.texture)) found.push(mask.texture)
  })
  return found.map((texture) => Array.from(texture.image.data).join(','))
}

/** The painting the way a frame budget does it: both queues attached, one unit per call (a deadline already past), until nothing waits. */
const drainInUnits = (scene: Scene): void => {
  for (let guard = 0; guard < 10_000 && (scene.cutQueue.pending() > 0 || scene.paintQueue.pending() > 0); guard++) {
    scene.cutQueue.run(0, () => 1)
    scene.paintQueue.run(0, () => 1)
  }
}

const attach = (scene: Scene): void => {
  scene.cutQueue.attach?.()
  scene.paintQueue.attach?.()
}

describe('the painting of a wall put off to the frame queues gives the same mask as the painting at the strike (spec 017, design-tiques 3)', () => {
  it('one strike: the mask after the units drained one by one equals the synchronous flush', () => {
    const immediate = setup()
    firstStrike(immediate)
    immediate.d.breach.flush(Infinity)
    const expected = masksOf(immediate)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.some((mask) => mask.includes('255'))).toBe(true)

    const deferred = setup()
    attach(deferred)
    firstStrike(deferred)
    expect(deferred.cutQueue.pending() + deferred.paintQueue.pending()).toBeGreaterThan(1)
    drainInUnits(deferred)
    expect(masksOf(deferred)).toEqual(expected)
    deferred.cutQueue.detach?.()
    deferred.paintQueue.detach?.()
  })

  it('a second strike on walls whose painting is still waiting: the same mask as the two strikes painted at once', () => {
    const immediate = setup()
    firstStrike(immediate)
    secondStrike(immediate)
    immediate.d.breach.flush(Infinity)
    const expected = masksOf(immediate)

    const deferred = setup()
    attach(deferred)
    firstStrike(deferred)
    deferred.cutQueue.run(0, () => 1)
    secondStrike(deferred)
    drainInUnits(deferred)
    expect(masksOf(deferred)).toEqual(expected)
    deferred.cutQueue.detach?.()
    deferred.paintQueue.detach?.()
  })

  it('a wall that only takes spalls and chips, never cut before, is cut with its paint and gives the same mask', () => {
    const lightStrike = (scene: Scene): void => {
      for (const id of ['wall_0_0', 'wall_0_1', 'wall_0_2']) scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: centreOf(scene, id), direction: [0, 0, -1], energy: 500, caliber: 9 })
    }
    const immediate = setup()
    lightStrike(immediate)
    immediate.d.breach.flush(Infinity)
    const expected = masksOf(immediate)
    expect(expected.length).toBeGreaterThan(0)

    const deferred = setup()
    attach(deferred)
    lightStrike(deferred)
    expect(masksOf(deferred)).toEqual([])
    expect(deferred.paintQueue.pending()).toBeGreaterThan(0)
    drainInUnits(deferred)
    expect(masksOf(deferred)).toEqual(expected)
    deferred.cutQueue.detach?.()
    deferred.paintQueue.detach?.()
  })
})
