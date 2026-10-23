import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildLot, extractPlant, generate, hideLotPlant, type PartKind, type Placement } from '../src'
import { createLotObject, createPlantObject, createVegetationMaterials, separatePlantFromLot } from '../src/three'
import { SAMPLES } from './samples'

const PARTS: PartKind[] = ['wood', 'foliage', 'flowers', 'fruit', 'spines']

describe('separable pieces', () => {
  for (const [key, spec] of Object.entries(SAMPLES)) {
    it(`${key}: pieces cover every triangle of every part exactly once`, () => {
      for (const lod of [0, 1, 2] as const) {
        for (const condition of ['healthy', 'dry', 'dead'] as const) {
          const plant = generate(spec, { seed: 3, lod, condition })
          const ids = new Set<string>()
          for (const pc of plant.pieces) {
            expect(ids.has(pc.id)).toBe(false)
            ids.add(pc.id)
          }
          for (const pc of plant.pieces) {
            if (pc.parent !== undefined) expect(ids.has(pc.parent)).toBe(true)
            expect(pc.indexStart % 3).toBe(0)
            expect(pc.indexCount % 3).toBe(0)
            expect(pc.indexCount).toBeGreaterThan(0)
            expect(pc.pivot.every(Number.isFinite)).toBe(true)
            for (let a = 0; a < 3; a++) expect(pc.bounds.min[a]).toBeLessThanOrEqual(pc.bounds.max[a])
          }
          for (const part of PARTS) {
            const mesh = plant.parts[part]
            const ranges = plant.pieces.filter((p) => p.part === part).sort((a, b) => a.indexStart - b.indexStart)
            if (!mesh) {
              expect(ranges.length).toBe(0)
              continue
            }
            let cursor = 0
            for (const r of ranges) {
              expect(r.indexStart).toBe(cursor)
              cursor += r.indexCount
            }
            expect(cursor).toBe(mesh.indices.length)
          }
        }
      }
    })
  }

  it('is deterministic', () => {
    for (const key of ['broadleaf_spreading_fruit', 'cactus_paddle', 'potted']) {
      const a = generate(SAMPLES[key], { seed: 9 })
      const b = generate(SAMPLES[key], { seed: 9 })
      expect(b.pieces).toEqual(a.pieces)
      expect(b.parts.foliage!.indices).toEqual(a.parts.foliage!.indices)
    }
  })

  it('splits trees into trunk, up to 6 branches with their crowns and fruit', () => {
    const p = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 5 })
    const kinds = (k: string) => p.pieces.filter((x) => x.kind === k)
    expect(kinds('trunk').length).toBeGreaterThan(0)
    const branches = kinds('branch')
    expect(branches.length).toBeGreaterThan(1)
    expect(branches.length).toBeLessThanOrEqual(6)
    const crowns = kinds('crown')
    expect(crowns.length).toBeGreaterThan(1)
    for (const c of crowns) expect(c.parent).toBeDefined()
    expect(kinds('fruit').length).toBeGreaterThan(0)
    expect(p.pieces.find((x) => x.kind === 'branch')!.parent).toBe('trunk')
    const dead = generate(SAMPLES.dead_tree, { seed: 5 })
    expect(dead.pieces.some((x) => x.kind === 'branch')).toBe(true)
  })

  it('makes every fruit its own small piece hung on a non-fruit piece', () => {
    const size = (pc: { bounds: { min: number[]; max: number[] } }) => Math.max(...[0, 1, 2].map((a) => pc.bounds.max[a] - pc.bounds.min[a]))
    for (const key of ['broadleaf_spreading_fruit', 'broadleaf_trunk_fruit', 'palm_coconut', 'cactus_paddle']) {
      const p = generate(SAMPLES[key], { seed: 4 })
      const byId = new Map(p.pieces.map((x) => [x.id, x]))
      const fruit = p.pieces.filter((x) => x.kind === 'fruit')
      expect(fruit.length, key).toBeGreaterThan(1)
      expect(fruit.filter((x) => x.part === 'fruit').length, key).toBeLessThanOrEqual(24)
      for (const f of fruit) {
        expect(f.id).toMatch(/^fruit\d+(:\w+)?$/)
        expect(size(f), `${key} ${f.id}`).toBeLessThan(key === 'broadleaf_trunk_fruit' ? 1 : 0.5)
        const parent = byId.get(f.parent ?? '')
        expect(parent, `${key} ${f.id} parent`).toBeDefined()
        expect(parent!.kind).not.toBe('fruit')
        // the pivot is the attach point (a stalk top may sit just above the fruit mesh)
        for (let a = 0; a < 3; a++) {
          expect(f.pivot[a]).toBeGreaterThanOrEqual(f.bounds.min[a] - 0.6)
          expect(f.pivot[a]).toBeLessThanOrEqual(f.bounds.max[a] + 0.6)
        }
      }
    }
    const mango = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4 })
    expect(mango.pieces.filter((x) => x.id.startsWith('fruit') && x.part === 'wood').length).toBeGreaterThan(0)
  })

  it('separates pot and soil from the plant, cactus arms and pads', () => {
    const pot = generate(SAMPLES.potted, { seed: 1 })
    expect(pot.pieces.find((x) => x.kind === 'pot')!.material).toBe('pot')
    expect(pot.pieces.find((x) => x.kind === 'soil')).toBeDefined()
    expect(pot.pieces.some((x) => x.kind === 'stem' || x.kind === 'trunk')).toBe(true)
    expect(generate(SAMPLES.cactus_saguaro, { seed: 1 }).pieces.filter((x) => x.kind === 'arm').length).toBeGreaterThan(0)
    const pads = generate(SAMPLES.cactus_paddle, { seed: 1 }).pieces.filter((x) => x.kind === 'pad')
    expect(pads.length).toBeGreaterThan(2)
    expect(pads.some((x) => x.parent !== undefined)).toBe(true)
  })

  it('uses dry wood material keys for dry / dead plants', () => {
    expect(generate(SAMPLES.broadleaf_round, { seed: 1 }).pieces.find((x) => x.kind === 'trunk')!.material).toBe('wood')
    expect(generate(SAMPLES.broadleaf_round, { seed: 1, condition: 'dry' }).pieces.find((x) => x.kind === 'trunk')!.material).toBe('woodDry')
  })

  it('three: separable object has one child per piece, positioned at the pivot, with destruction userData', () => {
    const mats = createVegetationMaterials(THREE)
    const plant = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 2, condition: 'dry' })
    const obj = createPlantObject(THREE, plant, mats, { separable: true })
    expect(obj.children.length).toBe(plant.pieces.length)
    let tris = 0
    plant.pieces.forEach((pc, i) => {
      const c = obj.children[i] as THREE.Mesh
      expect(c.position.toArray()).toEqual(pc.pivot)
      const part = c.userData.destructionPart as { id: string; kind: string; parent?: string; material: string }
      expect(part.id).toBe(pc.id)
      expect(part.kind).toBe(pc.kind)
      expect(part.parent).toBe(pc.parent)
      expect(c.userData.destructionMaterial).toBe(part.material)
      tris += c.geometry.index!.count / 3
    })
    expect(tris).toBe(plant.triangleCount)
    expect((obj.getObjectByName('trunk')!.userData.destructionMaterial)).toBe('wood_soft')
    const healthy = createPlantObject(THREE, generate(SAMPLES.broadleaf_spreading_fruit, { seed: 2 }), mats, { separable: true })
    expect(healthy.getObjectByName('fruit0')!.userData.destructionMaterial).toBe('flesh_fruit')
    expect(healthy.getObjectByName('trunk')!.userData.destructionMaterial).toBe('green_wood')
    const potted = createPlantObject(THREE, generate(SAMPLES.potted, { seed: 1 }), mats, { separable: true })
    expect(potted.getObjectByName('pot')!.userData.destructionMaterial).toBe('ceramic')
    const plain = createPlantObject(THREE, plant, mats)
    expect(plain.children.length).toBe(Object.keys(plant.parts).length)
  })
})

describe('lot pieceTable', () => {
  const placements: Placement[] = [
    { species: 'tree', x: 4, z: 1, ry: 0.7, scale: 1.2, seed: 11 },
    { species: 'cactus', x: -3, z: 2, ry: 2, scale: 1, seed: 12 },
    { species: 'pot', x: 0, z: -4, ry: 0, scale: 1, seed: 13 },
  ]
  const resolve = (id: string) => (id === 'tree' ? SAMPLES.broadleaf_spreading_fruit : id === 'cactus' ? SAMPLES.cactus_paddle : SAMPLES.potted)
  const lot = buildLot(placements, resolve, { seed: 1, quality: 'high' })

  it('has one entry per plant and ranges that point at that plant triangles', () => {
    expect(lot.pieceTable.map((t) => t.plantIndex)).toEqual([0, 1, 2])
    const covered: Record<string, number[]> = { wood: [], foliage: [], flowers: [] }
    for (const t of lot.pieceTable) {
      const p = placements[t.plantIndex]
      expect([t.x, t.z, t.species]).toEqual([p.x, p.z, p.species])
      const plant = extractPlant(lot, t.plantIndex).plant
      expect(t.pieces.length).toBe(plant.pieces.length)
      for (const r of t.pieces) {
        const mesh = lot.meshes[r.mesh]!
        expect(r.indexStart + r.indexCount).toBeLessThanOrEqual(mesh.indices.length)
        covered[r.mesh].push(r.indexCount)
        // the first vertex of the range sits where the plant's own piece vertex lands after the placement transform
        const src = plant.pieces.find((q) => q.id === r.id)!
        const sm = plant.parts[src.part]!
        const v = sm.indices[src.indexStart] * 3
        const x = sm.positions[v] * p.scale
        const z = sm.positions[v + 2] * p.scale
        const c = Math.cos(p.ry)
        const s = Math.sin(p.ry)
        const w = mesh.indices[r.indexStart] * 3
        expect(mesh.positions[w]).toBeCloseTo(x * c + z * s + p.x, 4)
        expect(mesh.positions[w + 1]).toBeCloseTo(sm.positions[v + 1] * p.scale, 4)
        expect(mesh.positions[w + 2]).toBeCloseTo(-x * s + z * c + p.z, 4)
      }
    }
    for (const k of ['wood', 'foliage', 'flowers'] as const) {
      const total = covered[k].reduce((a, b) => a + b, 0)
      expect(total).toBe(lot.meshes[k]?.indices.length ?? 0)
    }
  })

  it('hideLotPlant zeroes only that plant and separatePlantFromLot returns a placed separable group', () => {
    const l2 = buildLot(placements, resolve, { seed: 1, quality: 'high' })
    const mats = createVegetationMaterials(THREE)
    const obj = createLotObject(THREE, l2, mats)
    const before = Array.from(l2.meshes.wood!.indices)
    const grp = separatePlantFromLot(THREE, l2, obj, 1, mats)
    expect(grp.position.x).toBe(-3)
    expect(grp.rotation.y).toBe(2)
    expect(grp.children.length).toBe(l2.pieceTable[1].pieces.length)
    const mine = l2.pieceTable[1].pieces.filter((r) => r.mesh === 'wood')
    const inMine = (i: number) => mine.some((r) => i >= r.indexStart && i < r.indexStart + r.indexCount)
    l2.meshes.wood!.indices.forEach((v, i) => (inMine(i) ? expect(v).toBe(0) : expect(v).toBe(before[i])))
    expect(hideLotPlant(l2, 1).length).toBe(mine.length + l2.pieceTable[1].pieces.filter((r) => r.mesh !== 'wood').length)
  })
})
