import { describe, expect, it } from 'vitest'
import { createTerrain, createTerrainImpl } from '../src'

const BOUNDS = [-10, -10, 10, 10] as const
const GRENADE = 800_000

const cratered = (surface: string): ReturnType<typeof createTerrain> => {
  const terrain = createTerrain({ bounds: BOUNDS, layout: { surface } })
  terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
  for (let t = 0; t < 6; t += 1 / 60) terrain.update(1 / 60)
  return terrain
}

const down = (from: readonly [number, number, number], to: readonly [number, number, number]): [number, number, number] => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const size = Math.hypot(d[0]!, d[1]!, d[2]!)
  return [d[0]! / size, d[1]! / size, d[2]! / size]
}

describe('the ground answers rays with its surface as it is now, not the flat box that says where to look', () => {
  for (const surface of ['dirt', 'sand', 'mud', 'lawn', 'snow']) {
    it(`a ray into a crater in ${surface} meets its floor, under the old flat level`, () => {
      const terrain = cratered(surface)
      const impl = createTerrainImpl(terrain, { id: 'ground' })
      const bottom = terrain.heightAt(0, 0)
      expect(bottom).toBeLessThan(-0.1)
      const origin = [0.4, 2, 3] as const
      const hit = impl.surfaceRay?.({ origin: [...origin], direction: down(origin, [0, bottom, 0]), maxDistance: 20 })
      expect(hit).not.toBeNull()
      expect(hit!.point[1]).toBeCloseTo(terrain.heightAt(hit!.point[0], hit!.point[2]), 2)
      expect(hit!.point[1]).toBeLessThan(-0.05)
      expect(Math.hypot(hit!.point[0], hit!.point[2])).toBeLessThan(0.6)
    })
  }

  it('a ray that starts inside the box (below the flat level, over the crater) still meets the floor', () => {
    const terrain = cratered('dirt')
    const impl = createTerrainImpl(terrain, { id: 'ground' })
    const hit = impl.surfaceRay?.({ origin: [0, -0.05, 0], direction: [0, -1, 0], maxDistance: 5 })
    expect(hit?.point[1]).toBeCloseTo(terrain.heightAt(0, 0), 2)
  })

  it('flat ground answers at its level, a ray that never comes down answers nothing, and an ignored ground is passed through', () => {
    const terrain = createTerrain({ bounds: BOUNDS, layout: { surface: 'concrete_slab' } })
    const impl = createTerrainImpl(terrain, { id: 'ground' })
    expect(impl.surfaceRay?.({ origin: [0, 1, 0], direction: [0, -1, 0], maxDistance: 5 })?.point[1]).toBeCloseTo(0, 2)
    expect(impl.surfaceRay?.({ origin: [0, 5, 0], direction: [1, 0, 0], maxDistance: 50 })).toBeNull()
    expect(impl.surfaceRay?.({ origin: [0, 1, 0], direction: [0, -1, 0], maxDistance: 5, ignored: () => true })).toBeNull()
  })
})
