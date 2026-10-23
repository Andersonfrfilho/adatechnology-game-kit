import { describe, expect, it } from 'vitest'
import { buildLot, generate, pointInPolygon, scatter, type PlantSpec, type Placement } from '../src'
import { SAMPLES } from './samples'

const square = { polygon: [[0, 0], [10, 0], [10, 8], [0, 8]] as [number, number][] }
const lshape = { polygon: [[0, 0], [12, 0], [12, 4], [5, 4], [5, 10], [0, 10]] as [number, number][] }

describe('scatter', () => {
  const rules = [
    { species: 'tree', density: 0.03, minDistance: 3 },
    { species: ['shrub', 'flower'], density: 0.3, minDistance: 0.8, prefer: 'edge' as const },
  ]
  it('is deterministic and varies with the seed', () => {
    const a = scatter(square, rules, { seed: 5 })
    const b = scatter(square, rules, { seed: 5 })
    const c = scatter(square, rules, { seed: 6 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a.length).toBeGreaterThan(5)
  })
  it('stays inside the polygon (including concave ones)', () => {
    for (const area of [square, lshape]) {
      for (const p of scatter(area, rules, { seed: 'yard' })) expect(pointInPolygon(p.x, p.z, area.polygon)).toBe(true)
    }
  })
  it('works with rectangles (x, z is the minimum corner)', () => {
    const out = scatter({ rect: { x: 10, z: 20, w: 5, d: 4 } }, [{ species: 'a', density: 0.5, minDistance: 0.6 }], { seed: 1 })
    expect(out.length).toBeGreaterThan(3)
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(10)
      expect(p.x).toBeLessThanOrEqual(15)
      expect(p.z).toBeGreaterThanOrEqual(20)
      expect(p.z).toBeLessThanOrEqual(24)
    }
  })
  it('respects exclusions (per rule and global)', () => {
    const house = { rect: { x: 2, z: 2, w: 4, d: 3 } }
    const path = { polygon: [[7, 0], [8, 0], [8, 8], [7, 8]] as [number, number][] }
    const r = [{ species: 'a', density: 0.4, minDistance: 0.5, exclude: [house] }]
    const out = scatter(square, r, { seed: 3, exclude: [path] })
    expect(out.length).toBeGreaterThan(5)
    for (const p of out) {
      const inHouse = p.x >= 2 && p.x <= 6 && p.z >= 2 && p.z <= 5
      const inPath = p.x >= 7 && p.x <= 8
      expect(inHouse || inPath).toBe(false)
    }
  })
  it('keeps the minimum distance', () => {
    const out = scatter(square, [{ species: 'a', density: 1, minDistance: 1.2 }], { seed: 9 })
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(Math.hypot(out[i].x - out[j].x, out[i].z - out[j].z)).toBeGreaterThanOrEqual(1.2 - 1e-9)
  })
  it('prefers the edge or the center', () => {
    const edgeDist = (p: Placement): number => Math.min(p.x, 10 - p.x, p.z, 8 - p.z)
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    const e = scatter(square, [{ species: 'a', density: 0.25, minDistance: 0.6, prefer: 'edge' }], { seed: 2 })
    const c = scatter(square, [{ species: 'a', density: 0.25, minDistance: 0.6, prefer: 'center' }], { seed: 2 })
    const a = scatter(square, [{ species: 'a', density: 0.25, minDistance: 0.6, prefer: 'any' }], { seed: 2 })
    expect(mean(e.map(edgeDist))).toBeLessThan(mean(a.map(edgeDist)))
    expect(mean(c.map(edgeDist))).toBeGreaterThan(mean(a.map(edgeDist)))
  })
  it('applies scale and rotation ranges and weights', () => {
    const out = scatter(square, [{ species: [{ id: 'common', weight: 9 }, { id: 'rare', weight: 1 }], density: 0.5, minDistance: 0.5, scale: [0.8, 1.3], rotate: [0, 1] }], { seed: 4 })
    for (const p of out) {
      expect(p.scale).toBeGreaterThanOrEqual(0.8)
      expect(p.scale).toBeLessThanOrEqual(1.3)
      expect(p.ry).toBeLessThanOrEqual(1)
    }
    expect(out.filter((p) => p.species === 'common').length).toBeGreaterThan(out.filter((p) => p.species === 'rare').length)
  })
})

const YARD: Record<string, PlantSpec> = {
  tree: { archetype: 'broadleaf_tree', height: 6, crownRadius: 2.4 },
  palm: SAMPLES.palm_royal,
  shrub: SAMPLES.shrub_round,
  hedge: SAMPLES.shrub_hedge,
  rose: SAMPLES.flower_rose,
  daisy: SAMPLES.flower_daisy,
  tulip: SAMPLES.flower_tulip,
  grass: SAMPLES.grass,
  cactus: SAMPLES.cactus_columnar,
  fern: SAMPLES.fern,
}
const resolve = (id: string): PlantSpec => YARD[id]

function sampleYard(): Placement[] {
  const out: Placement[] = []
  const ids = ['tree', 'tree', 'palm', 'shrub', 'shrub', 'shrub', 'shrub', 'hedge', 'hedge', 'rose', 'rose', 'daisy', 'daisy', 'tulip', 'tulip', 'grass', 'grass', 'grass', 'cactus', 'fern']
  ids.forEach((id, i) => out.push({ species: id, x: (i % 5) * 3 - 6, z: Math.floor(i / 5) * 3 - 4, ry: i * 0.7, scale: 1, seed: i + 1 }))
  return out
}

describe('buildLot', () => {
  it('merges a typical yard into at most 3 meshes under 15k triangles in game quality', () => {
    const lot = buildLot(sampleYard(), resolve, { seed: 'yard', quality: 'game' })
    expect(Object.keys(lot.meshes).length).toBeLessThanOrEqual(3)
    expect(lot.plantCount).toBe(20)
    expect(lot.triangleCount).toBeLessThan(15000)
    expect(lot.triangleCount).toBe((lot.meshes.wood?.triangleCount ?? 0) + (lot.meshes.foliage?.triangleCount ?? 0) + (lot.meshes.flowers?.triangleCount ?? 0))
  })
  it('uses lod1 in game quality and lod0 in high quality', () => {
    const p = sampleYard()
    const game = buildLot(p, resolve, { seed: 1, quality: 'game', lod: 0 })
    const high = buildLot(p, resolve, { seed: 1, quality: 'high' })
    expect(high.triangleCount).toBeGreaterThan(game.triangleCount)
  })
  it('transforms vertices by the placement', () => {
    const one: Placement[] = [{ species: 'tree', x: 20, z: -5, ry: 1.2, scale: 1.5, seed: 3 }]
    const lot = buildLot(one, resolve, { seed: 1, quality: 'high' })
    const ref = generate(YARD.tree, { seed: 0, lod: 0 })
    expect(ref.bounds.height).toBeGreaterThan(0)
    const pos = lot.meshes.foliage!.positions
    let cx = 0
    let cz = 0
    for (let i = 0; i < pos.length; i += 3) {
      cx += pos[i]
      cz += pos[i + 2]
    }
    cx /= pos.length / 3
    cz /= pos.length / 3
    expect(Math.hypot(cx - 20, cz + 5)).toBeLessThan(3)
    expect(lot.meshes.wood!.normals.length).toBe(lot.meshes.wood!.positions.length)
  })
  it('emits trunk colliders only, with thorns on cacti', () => {
    const lot = buildLot(sampleYard(), resolve, { seed: 1, quality: 'game' })
    // tree x2, palm, cactus (everything else never collides)
    expect(lot.colliders.length).toBe(4)
    expect(lot.colliders.filter((c) => c.damage === 'thorns').length).toBe(1)
    for (const c of lot.colliders) {
      expect(c.r).toBeGreaterThan(0)
      expect(c.h).toBeGreaterThan(0)
    }
    const cactus = lot.colliders.find((c) => c.damage === 'thorns')!
    expect(cactus.r).toBeLessThan(0.6)
  })
  it('is deterministic and never uses Math.random', () => {
    const orig = Math.random
    Math.random = () => {
      throw new Error('Math.random')
    }
    try {
      const a = buildLot(sampleYard(), resolve, { seed: 2, quality: 'game' })
      const b = buildLot(sampleYard(), resolve, { seed: 2, quality: 'game' })
      expect(a.meshes.foliage!.positions).toEqual(b.meshes.foliage!.positions)
    } finally {
      Math.random = orig
    }
  })
})
