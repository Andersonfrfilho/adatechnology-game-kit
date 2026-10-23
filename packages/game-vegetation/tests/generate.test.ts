import { describe, expect, it, vi } from 'vitest'
import { archetypes, generate, validateSpec, type Condition, type MeshData, type PlantMesh, type Season } from '../src'
import { SAMPLES, budgetFor } from './samples'

const keys = Object.keys(SAMPLES)

function checkMesh(m: MeshData, label: string): void {
  const n = m.positions.length / 3
  expect(m.normals.length, label).toBe(m.positions.length)
  expect(m.colors.length, label).toBe(m.positions.length)
  expect(m.sway.length, label).toBe(n)
  expect(m.indices.length, label).toBe(m.triangleCount * 3)
  for (let i = 0; i < m.positions.length; i++) {
    if (!Number.isFinite(m.positions[i]) || !Number.isFinite(m.normals[i]) || !Number.isFinite(m.colors[i])) throw new Error(`${label}: NaN at ${i}`)
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2])
    if (Math.abs(l - 1) > 1e-3) throw new Error(`${label}: normal ${i} length ${l}`)
    if (m.sway[i] < 0 || m.sway[i] > 1) throw new Error(`${label}: sway out of range`)
    if (m.positions[i * 3 + 1] < -0.05) throw new Error(`${label}: vertex below ground ${m.positions[i * 3 + 1]}`)
  }
  for (let i = 0; i < m.indices.length; i++) if (m.indices[i] >= n) throw new Error(`${label}: index out of range`)
}

function same(a: PlantMesh, b: PlantMesh): boolean {
  const ka = Object.keys(a.parts)
  if (ka.join() !== Object.keys(b.parts).join()) return false
  for (const k of ka as (keyof PlantMesh['parts'])[]) {
    const pa = a.parts[k]!
    const pb = b.parts[k]!
    if (pa.positions.length !== pb.positions.length) return false
    for (let i = 0; i < pa.positions.length; i++) if (pa.positions[i] !== pb.positions[i]) return false
    for (let i = 0; i < pa.colors.length; i++) if (pa.colors[i] !== pb.colors[i]) return false
    for (let i = 0; i < pa.indices.length; i++) if (pa.indices[i] !== pb.indices[i]) return false
  }
  return true
}

describe('archetype coverage', () => {
  it('has a sample for every archetype', () => {
    const covered = new Set(Object.values(SAMPLES).map((s) => s.archetype))
    for (const a of archetypes()) expect(covered.has(a as never), a).toBe(true)
    expect(archetypes().length).toBe(15)
  })
})

describe('determinism', () => {
  it.each(keys)('%s is identical for the same seed and differs for another', (k) => {
    for (const lod of [0, 1, 2] as const) {
      const a = generate(SAMPLES[k], { seed: 'abc', lod })
      const b = generate(SAMPLES[k], { seed: 'abc', lod })
      expect(same(a, b), `${k} lod${lod}`).toBe(true)
    }
    const c = generate(SAMPLES[k], { seed: 'abc' })
    const d = generate(SAMPLES[k], { seed: 'xyz' })
    // grass_tuft / rosette ring layouts can coincide in counts, but never in every vertex
    expect(same(c, d)).toBe(false)
  })

  it('never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used')
    })
    try {
      for (const k of keys) for (const lod of [0, 1, 2] as const) generate(SAMPLES[k], { seed: 7, lod })
    } finally {
      spy.mockRestore()
    }
  })
})

describe('valid meshes', () => {
  const conditions: Condition[] = ['healthy', 'dry', 'dead', 'overgrown']
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
  it.each(keys)('%s: indices, normals, NaN, sway and ground', (k) => {
    for (const lod of [0, 1, 2] as const) {
      for (const condition of conditions) {
        const season = seasons[(lod + conditions.indexOf(condition)) % 4]
        const m = generate(SAMPLES[k], { seed: 3, lod, condition, season })
        expect(m.triangleCount).toBeGreaterThan(0)
        for (const [pk, part] of Object.entries(m.parts)) checkMesh(part, `${k}/${pk}/lod${lod}/${condition}`)
        expect(m.bounds.height).toBeGreaterThan(0)
      }
    }
  })
  it('scales the mesh and the collider together', () => {
    const a = generate(SAMPLES.broadleaf_round, { seed: 1 })
    const b = generate(SAMPLES.broadleaf_round, { seed: 1, scale: 2 })
    expect(b.bounds.height).toBeCloseTo(a.bounds.height * 2, 3)
    expect(b.collider!.radius).toBeCloseTo(a.collider!.radius * 2, 5)
  })
})

describe('triangle budgets and LODs', () => {
  it.each(keys)('%s: budget at lod0, shrinking lods', (k) => {
    let worst = 0
    for (const seed of [1, 2, 3, 4]) {
      const l0 = generate(SAMPLES[k], { seed, lod: 0 }).triangleCount
      const l1 = generate(SAMPLES[k], { seed, lod: 1 }).triangleCount
      const l2 = generate(SAMPLES[k], { seed, lod: 2 }).triangleCount
      worst = Math.max(worst, l0)
      expect(l1, `${k} lod1 < lod0`).toBeLessThan(l0)
      expect(l2, `${k} lod2 < lod1`).toBeLessThan(l1)
      expect(l1 / l0, `${k} lod1 ratio`).toBeLessThanOrEqual(0.7)
      expect(l2 / l0, `${k} lod2 ratio`).toBeLessThanOrEqual(0.35)
    }
    expect(worst, `${k} lod0 budget`).toBeLessThanOrEqual(budgetFor(k))
  })
})

describe('colliders', () => {
  it('trees, palms, cacti and pots collide; grass, flowers and shrubs do not', () => {
    for (const k of ['broadleaf_round', 'dead_tree', 'palm_coconut', 'palm_royal', 'conifer_cone', 'cactus_columnar', 'cactus_paddle', 'cactus_globe', 'potted', 'banana']) {
      const m = generate(SAMPLES[k], { seed: 1 })
      expect(m.collider, k).not.toBeNull()
      expect(m.collider!.kind).toBe('cylinder')
      expect(m.collider!.radius).toBeGreaterThan(0)
    }
    for (const k of ['grass', 'grass_seeds', 'flower_daisy', 'flower_rose', 'shrub_round', 'shrub_hedge', 'fern', 'rosette_agave', 'vine_wall']) {
      expect(generate(SAMPLES[k], { seed: 1 }).collider, k).toBeNull()
    }
  })
  it('flags thorns on cacti and bendability on foliage', () => {
    expect(generate(SAMPLES.cactus_columnar).thorny).toBe(true)
    expect(generate(SAMPLES.broadleaf_round).thorny).toBe(false)
    expect(generate(SAMPLES.grass).bendable).toBe(true)
    expect(generate(SAMPLES.broadleaf_round).bendable).toBe(false)
  })
  it('tags cactus bodies with the cactus damage material', () => {
    expect(generate(SAMPLES.cactus_columnar).parts.foliage!.material).toBe('cactus')
    expect(generate(SAMPLES.broadleaf_round).parts.wood!.material).toBe('wood')
    expect(generate(SAMPLES.broadleaf_round).parts.foliage!.material).toBe('foliage')
  })
})

describe('conditions and seasons', () => {
  it('dead trees are bare, dry trees thinner, overgrown denser', () => {
    const tri = (c: Condition): number => generate(SAMPLES.broadleaf_round, { seed: 5, condition: c }).parts.foliage?.triangleCount ?? 0
    expect(tri('dead')).toBe(0)
    expect(tri('dry')).toBeLessThan(tri('healthy'))
    expect(tri('overgrown')).toBeGreaterThan(tri('healthy'))
  })
  it('deciduous trees lose leaves in winter', () => {
    const w = generate(SAMPLES.broadleaf_weeping, { seed: 5, season: 'winter' }).triangleCount
    const s = generate(SAMPLES.broadleaf_weeping, { seed: 5, season: 'summer' }).triangleCount
    expect(w).toBeLessThan(s)
  })
  it('bloom replaces leaves only in its seasons', () => {
    const inBloom = generate(SAMPLES.broadleaf_bloom, { seed: 2, season: 'summer' })
    const out = generate(SAMPLES.broadleaf_bloom, { seed: 2, season: 'winter' })
    expect(inBloom.parts.flowers).toBeDefined()
    expect(out.parts.flowers).toBeUndefined()
  })
  it('dead cactus is paler than a healthy one', () => {
    const avg = (m: PlantMesh): number => {
      const c = m.parts.foliage!.colors
      let s = 0
      for (let i = 0; i < c.length; i += 3) s += c[i] + c[i + 1] + c[i + 2]
      return s / c.length
    }
    expect(avg(generate(SAMPLES.cactus_columnar, { seed: 2, condition: 'dead' }))).toBeGreaterThan(avg(generate(SAMPLES.cactus_columnar, { seed: 2 })))
  })
})

describe('potted', () => {
  it('wraps another spec in a pot with soil and lifts the plant above the pot', () => {
    const potted = generate(SAMPLES.potted, { seed: 1 })
    const bare = generate({ archetype: 'fern' }, { seed: 1 })
    expect(potted.triangleCount).toBeGreaterThan(bare.triangleCount)
    expect(potted.bounds.height).toBeGreaterThan(bare.bounds.height)
    expect(potted.parts.wood).toBeDefined()
    expect(potted.collider!.height).toBeCloseTo(0.32, 2)
  })
})

describe('vine hosts', () => {
  it('stays inside the wall rectangle and near the path', () => {
    const m = generate({ archetype: 'vine', host: { wall: { width: 2, height: 2 } } }, { seed: 4 })
    const p = m.parts.foliage!.positions
    for (let i = 0; i < p.length; i += 3) {
      expect(Math.abs(p[i])).toBeLessThan(1.35)
      expect(p[i + 1]).toBeLessThan(2.4)
    }
    const m2 = generate(SAMPLES.vine_path, { seed: 4 })
    expect(m2.triangleCount).toBeGreaterThan(50)
  })
})

describe('validateSpec', () => {
  it('accepts samples and rejects bad specs', () => {
    for (const k of keys) expect(validateSpec(SAMPLES[k]), k).toEqual([])
    expect(validateSpec({ archetype: 'nope' }).length).toBe(1)
    expect(validateSpec({ archetype: 'palm', height: -1 }).length).toBe(1)
    expect(validateSpec({ archetype: 'palm', variant: 'x' }).length).toBe(1)
    expect(validateSpec({ archetype: 'shrub', leafColor: ['#fff'] }).length).toBeGreaterThan(0)
    expect(validateSpec({ archetype: 'potted', plant: { archetype: 'zzz' } }).length).toBe(1)
  })
})
