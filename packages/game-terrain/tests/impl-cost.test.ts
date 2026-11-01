import { checkDestructible } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createTerrain, createTerrainImpl } from '../src'

const GRENADE = 800_000
const make = (surface = 'dirt') => {
  const terrain = createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface } })
  return { terrain, impl: createTerrainImpl(terrain, { id: 'ground' }) }
}
const materialOf = (impl: ReturnType<typeof make>['impl']) => impl.describe().parts[0]?.material

describe('the terrain as a DestructibleImpl', () => {
  it('describe() and state() hold the cost contract', () => {
    const { impl } = make()
    const report = checkDestructible(impl, { cost: true })
    expect(report.problems.filter((problem) => problem.includes('cost contract'))).toEqual([])
  })

  it('update keeps the identity of describe() and state()', () => {
    const { impl } = make()
    const first = impl.describe()
    const state = impl.state()
    impl.update?.(1 / 60)
    expect(impl.describe()).toBe(first)
    expect(impl.state()).toBe(state)
  })

  it('digging the center with hits, strike, burn and applyHit keeps a consistent description', () => {
    const { terrain, impl } = make()
    const first = impl.describe()
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    terrain.burn({ x: 0, z: 0, radius: 2, temperature: 800, seconds: 1 })
    terrain.applyHit({ type: 'explosive', point: [1, 0, 1], energy: GRENADE, radius: 2 })
    impl.hit({ type: 'ballistic', point: [0, 1, 0], direction: [0, -1, 0], energy: 500, mass: 7.5, caliber: 9 })
    expect(impl.describe()).toEqual({ ...first, parts: [{ ...first.parts[0], material: materialOf(impl) }] })
    expect(materialOf(impl)).toBe(terrain.vertexMaterial(100, 100).id)
  })

  it('setLayout, load and reset follow the material of the center', () => {
    const { terrain, impl } = make('dirt')
    const dirt = materialOf(impl)
    terrain.setLayout({ surface: 'concrete_slab' })
    const slab = materialOf(impl)
    expect(slab).toBe(terrain.vertexMaterial(100, 100).id)
    expect(slab).toBe(terrain.columnAt(0, 0).material)
    expect(slab).not.toBe(dirt)
    const saved = JSON.parse(JSON.stringify(impl.serialize?.()))
    impl.reset?.()
    expect(materialOf(impl)).toBe(terrain.vertexMaterial(100, 100).id)
    impl.load?.(saved)
    expect(materialOf(impl)).toBe(terrain.vertexMaterial(100, 100).id)
  })

  it('a deform listener that reads describe() mid-blow gets a valid description', () => {
    const { terrain, impl } = make()
    const seen: unknown[] = []
    terrain.onDeform(() => seen.push(impl.describe()))
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((spec) => spec === impl.describe())).toBe(true)
  })

  it('state() lists the same part ids as describe()', () => {
    const { impl } = make()
    expect(impl.state().parts.map((part) => part.id)).toEqual(impl.describe().parts.map((part) => part.id))
    expect(impl.state().parts[0]?.material).toBe(impl.describe().parts[0]?.material)
    expect(impl.state()).toBe(impl.state())
  })
})
