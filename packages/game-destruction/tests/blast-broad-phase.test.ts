import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, PartSpec } from '../src'

const brick = (index: number): PartSpec => ({ id: `b${index}`, material: 'concrete', shape: { kind: 'box', size: [0.5, 0.5, 0.2] }, position: [index * 0.5, 0.25, 0], thickness: 0.2 })
const wall = (count: number): DestructibleSpec => ({ parts: Array.from({ length: count }, (_, index) => brick(index)) })
const NEAR_COUNT = 12

const blastWall = (count: number) => {
  const world = createDestruction({ seed: 11 })
  const id = world.add(wall(count), { id: 'wall' })
  const results = world.explode([1, 0.3, 1], 40000, 3)
  const state = world.state(id)
  if (!state) throw new Error('wall missing')
  return { world, results, state }
}

describe('blast broad phase', () => {
  it('gives the same results as a scene without the far parts', () => {
    const near = blastWall(NEAR_COUNT)
    const full = blastWall(400)
    const summary = (results: typeof near.results) => results.map((result) => ({ object: result.object, part: result.part, point: result.point, damage: result.damage }))
    expect(summary(full.results)).toEqual(summary(near.results))
    const nearParts = near.state.parts.map((part) => [part.id, part.hp, part.status])
    const fullParts = full.state.parts.filter((part) => Number(part.id.slice(1)) < NEAR_COUNT).map((part) => [part.id, part.hp, part.status])
    expect(fullParts).toEqual(nearParts)
    expect(near.results.length).toBeGreaterThan(0)
    expect(near.results[0]!.damage).toBeGreaterThan(0)
  })

  it('leaves the far parts untouched', () => {
    const { state } = blastWall(400)
    const far = state.parts.filter((part) => Number(part.id.slice(1)) > 20)
    expect(far).toHaveLength(379)
    expect(far.every((part) => part.status === 'intact')).toBe(true)
  })

  it('tests only the parts whose bounds the blast can reach', () => {
    const { world } = blastWall(400)
    const probe = world.blastProbe()
    expect(probe.partsTested).toBe(400)
    expect(probe.partsNear).toBeLessThan(25)
    expect(probe.partsNear).toBeGreaterThan(0)
  })
})
