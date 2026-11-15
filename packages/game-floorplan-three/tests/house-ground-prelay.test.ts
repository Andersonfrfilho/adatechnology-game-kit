import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { IS_JOLT, physicsOption } from './setup-physics'

type Bounds = { minX: number; minZ: number; maxX: number; maxZ: number }

/** A house activated on a renderer whose `prelayGround` is watched: the boxes it was asked to lay, and what the renderer made of them. */
function activated(prelayGround?: boolean) {
  const world = createDestruction({ seed: 1 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, ...(prelayGround === undefined ? {} : { prelayGround }) })
  const asked: Bounds[] = []
  const laid: number[] = []
  const prelay = renderer.prelayGround.bind(renderer)
  renderer.prelayGround = (bounds) => {
    asked.push(bounds)
    const count = prelay(bounds)
    laid.push(count)
    return count
  }
  const { house } = houseOf(planOf('casaA', 1), { destruction: world, destructionRenderer: renderer }, { quality: 'game' })
  scene.add(house.group)
  house.destruction.activate()
  return { asked, laid }
}

describe('the ground under a house is laid when the house is activated', () => {
  it('asks the renderer once, for the footprint of the house', () => {
    const { asked } = activated()
    expect(asked).toHaveLength(1)
    const [bounds] = asked as [Bounds]
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(5)
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThan(5)
    expect(Number.isFinite(bounds.minX + bounds.maxX + bounds.minZ + bounds.maxZ)).toBe(true)
  })

  it.skipIf(!IS_JOLT)('lays tiles on the engine, and none with the renderer option turned off', () => {
    expect(activated().laid[0]).toBeGreaterThan(0)
    expect(activated(false).laid[0]).toBe(0)
  })
})
