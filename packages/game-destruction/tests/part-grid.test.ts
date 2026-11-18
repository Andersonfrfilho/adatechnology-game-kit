import { describe, expect, it } from 'vitest'

import { buildPartGrid } from '../src/part-grid'
import type { PartSphere } from '../src/part-grid'

type Vec3 = [number, number, number]

/** The sphere test the ray runs on every part (world.ts `partSphereMiss`): true when the segment [0, maxDistance] misses it. */
const sphereMiss = (o: Vec3, d: Vec3, p: PartSphere, maxDistance: number, slack: number): boolean => {
  const x = o[0] - p.pos[0], y = o[1] - p.pos[1], z = o[2] - p.pos[2]
  const r = p.bound + slack
  const b = x * d[0] + y * d[1] + z * d[2]
  const cc = x * x + y * y + z * z - r * r
  if (cc > 0 && b > 0) return true
  const disc = b * b - cc
  if (disc < 0) return true
  return -b - Math.sqrt(disc) > maxDistance
}

const random = (seed: number): (() => number) => {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

describe('the grid over the part spheres of a big object', () => {
  it('gives every part a ray can meet, in ascending order, for a thousand random rays over a wall of bricks', () => {
    const next = random(7)
    const parts: PartSphere[] = []
    for (let i = 0; i < 40; i++) for (let j = 0; j < 20; j++) parts.push({ pos: [i * 0.2, j * 0.06, (next() - 0.5) * 0.02], bound: 0.11 })
    for (let k = 0; k < 30; k++) parts.push({ pos: [next() * 8, next() * 3, next() * 4 - 2], bound: 0.05 + next() * 1.5 })
    const grid = buildPartGrid(parts, 1e-6)
    const out: number[] = []
    for (let ray = 0; ray < 1000; ray++) {
      const origin: Vec3 = [next() * 12 - 2, next() * 5 - 1, next() * 8 - 4]
      const raw: Vec3 = [next() - 0.5, next() - 0.5, next() - 0.5]
      const length = Math.hypot(...raw)
      const direction: Vec3 = [raw[0] / length, raw[1] / length, raw[2] / length]
      const maxDistance = ray % 3 === 0 ? Infinity : next() * 10
      grid.candidates(origin, direction, maxDistance, out)
      const met = parts.flatMap((part, index) => (sphereMiss(origin, direction, part, maxDistance, 1e-6) ? [] : [index]))
      expect(met.every((index) => out.includes(index))).toBe(true)
      expect([...out].sort((a, b) => a - b)).toEqual(out)
    }
  })

  it('walks only the cells near the ray: a ray along one course of a long wall is offered a small share of its bricks', () => {
    const parts: PartSphere[] = []
    for (let i = 0; i < 100; i++) for (let j = 0; j < 30; j++) parts.push({ pos: [i * 0.2, j * 0.06, 0], bound: 0.11 })
    const out: number[] = []
    buildPartGrid(parts, 1e-6).candidates([5, 0.9, -3], [0, 0, 1], 6, out)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(parts.length / 10)
  })
})

describe('the grid in the world', () => {
  it('a ray of NaN answers nothing on a big object, as the plain scan did, instead of throwing', async () => {
    const { createDestruction } = await import('../src')
    const world = createDestruction({ seed: 1 })
    const parts = Array.from({ length: 80 }, (_, k) => ({ id: `b${k}`, material: 'brick', shape: { kind: 'box' as const, size: [0.2, 0.06, 0.1] as [number, number, number] }, position: [(k % 20) * 0.2, Math.floor(k / 20) * 0.06, 0] as [number, number, number] }))
    world.add({ name: 'wall', parts, joints: [] }, { id: 'wall' })
    expect(world.raycast([2, 0.1, -2], [0, 0, 1])?.object).toBe('wall')
    expect(world.raycast([Number.NaN, 0.1, -2], [0, 0, 1])).toBeNull()
  })

  it('a part posed at NaN keeps every part a candidate, in order, instead of throwing', () => {
    const parts: PartSphere[] = Array.from({ length: 70 }, (_, k) => ({ pos: [k * 0.2, 0, 0] as Vec3, bound: 0.1 }))
    parts[5] = { pos: [Number.NaN, 0, 0], bound: 0.1 }
    const out: number[] = []
    buildPartGrid(parts, 1e-6).candidates([1, 0, -1], [0, 0, 1], 5, out)
    expect(out).toEqual(parts.map((_, index) => index))
  })
})
