import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildLot, generate, type PlantSpec } from '../src'
import { MAX_ACTORS, createInstancedPlants, createLotObject, createPlantObject, createVegetationMaterials, lodObject, toBufferGeometry } from '../src/three'
import { SAMPLES } from './samples'

describe('three adapter', () => {
  it('builds a BufferGeometry with position, normal, color and sway', () => {
    const plant = generate(SAMPLES.broadleaf_round, { seed: 1 })
    const g = toBufferGeometry(THREE, plant.parts.foliage!)
    expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position', 'sway'])
    expect(g.index!.count).toBe(plant.parts.foliage!.triangleCount * 3)
    expect(g.boundingSphere!.radius).toBeGreaterThan(1)
  })

  it('creates one mesh per part with collider, bendable and damage tags', () => {
    const mats = createVegetationMaterials(THREE)
    const cactus = createPlantObject(THREE, generate(SAMPLES.cactus_columnar, { seed: 1 }), mats)
    expect(cactus.userData.collider).not.toBeNull()
    expect(cactus.userData.thorny).toBe(true)
    const kinds = cactus.children.map((c) => c.name)
    expect(kinds).toContain('foliage')
    expect(kinds).toContain('spines')
    for (const c of cactus.children) expect((c.userData.damageable as { material: string }).material).toMatch(/^(wood|foliage|cactus)$/)
    expect((cactus.getObjectByName('foliage')!.userData.damageable as { material: string }).material).toBe('cactus')
    const tree = createPlantObject(THREE, generate(SAMPLES.broadleaf_round, { seed: 1 }), mats)
    expect((tree.getObjectByName('wood')!.userData.damageable as { material: string }).material).toBe('wood')
    const grass = createPlantObject(THREE, generate(SAMPLES.grass, { seed: 1 }), mats)
    expect(grass.userData.bendable).toBe(true)
    expect(grass.userData.collider).toBeNull()
  })

  it('materials: vertex colors, flat shaded double sided foliage, patched shader', () => {
    const mats = createVegetationMaterials(THREE)
    expect(mats.foliage.vertexColors).toBe(true)
    expect(mats.foliage.flatShading).toBe(true)
    expect(mats.foliage.side).toBe(THREE.DoubleSide)
    expect(mats.wood.side).toBe(THREE.FrontSide)
    expect(mats.foliage.roughness).toBeCloseTo(0.85, 2)
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <project_vertex>' }
    mats.foliage.onBeforeCompile(shader as never, null as never)
    expect(shader.vertexShader).toContain('attribute float sway')
    expect(shader.vertexShader).toContain(`uActors[${MAX_ACTORS}]`)
    expect(shader.vertexShader).toContain('instanceMatrix')
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(['uVegTime', 'uWindDir', 'uWindStrength', 'uWindGust', 'uActors']))
  })

  it('update / setWind / setActors reuse their objects (no per-frame allocation) and cap at 4 actors', () => {
    const mats = createVegetationMaterials(THREE)
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <common>\n#include <project_vertex>' }
    mats.foliage.onBeforeCompile(shader as never, null as never)
    const actors = shader.uniforms.uActors.value as THREE.Vector4[]
    const before = actors.slice()
    expect(actors.length).toBe(MAX_ACTORS)
    const many = Array.from({ length: 7 }, (_, i) => ({ x: i, y: 0, z: -i, radius: 1.5 }))
    mats.setActors(many)
    mats.update(12.5)
    mats.setWind({ direction: [3, 4], strength: 0.8, gust: 0.4 })
    const after = shader.uniforms.uActors.value as THREE.Vector4[]
    expect(after.length).toBe(4)
    after.forEach((v, i) => expect(v).toBe(before[i]))
    expect(after[3].x).toBe(3)
    expect(after[3].w).toBe(1.5)
    mats.setActors([])
    expect(after[0].w).toBe(0)
    expect(shader.uniforms.uVegTime.value).toBe(12.5)
    const dir = shader.uniforms.uWindDir.value as THREE.Vector2
    expect(dir.x).toBeCloseTo(0.6, 5)
    expect(dir.y).toBeCloseTo(0.8, 5)
    expect(shader.uniforms.uWindStrength.value).toBe(0.8)
  })

  it('creates a lot object with at most 3 meshes', () => {
    const specs: Record<string, PlantSpec> = { a: SAMPLES.broadleaf_round, b: SAMPLES.flower_rose, c: SAMPLES.cactus_globe }
    const lot = buildLot(
      [
        { species: 'a', x: 0, z: 0, ry: 0, scale: 1, seed: 1 },
        { species: 'b', x: 3, z: 1, ry: 1, scale: 1, seed: 2 },
        { species: 'c', x: -3, z: 1, ry: 2, scale: 1, seed: 3 },
      ],
      (id) => specs[id],
      { seed: 1, quality: 'game' },
    )
    const obj = createLotObject(THREE, lot)
    expect(obj.children.length).toBeLessThanOrEqual(3)
    expect(obj.children.length).toBeGreaterThan(0)
    expect((obj.userData.colliders as unknown[]).length).toBe(lot.colliders.length)
    for (const c of obj.children) expect((c.userData.damageable as { material: string }).material).toBeDefined()
  })

  it('creates instanced plants with one instance matrix per placement', () => {
    const plant = generate(SAMPLES.grass, { seed: 1, lod: 1 })
    const placements = Array.from({ length: 25 }, (_, i) => ({ species: 'grass', x: i, z: -i, ry: i * 0.3, scale: 1 + i * 0.01, seed: i }))
    const g = createInstancedPlants(THREE, plant, placements)
    const im = g.children[0] as THREE.InstancedMesh
    expect(im.isInstancedMesh).toBe(true)
    expect(im.count).toBe(25)
    const m = new THREE.Matrix4()
    im.getMatrixAt(7, m)
    const p = new THREE.Vector3().setFromMatrixPosition(m)
    expect(p.x).toBeCloseTo(7)
    expect(p.z).toBeCloseTo(-7)
  })

  it('builds a THREE.LOD with three levels and distances', () => {
    const lod = lodObject(THREE, SAMPLES.broadleaf_round, { seed: 4, distances: [0, 30, 90] })
    expect(lod.levels.length).toBe(3)
    expect(lod.levels.map((l) => l.distance)).toEqual([0, 30, 90])
    const tris = lod.levels.map((l) => l.object.children.reduce((a, c) => a + ((c as THREE.Mesh).geometry.index!.count / 3), 0))
    expect(tris[0]).toBeGreaterThan(tris[1])
    expect(tris[1]).toBeGreaterThan(tris[2])
  })

  it('writes destructionMaterial ids (green_wood, wood_soft for dry, foliage, cactus) and honours materialIds', () => {
    const mats = createVegetationMaterials(THREE)
    const tree = createPlantObject(THREE, generate(SAMPLES.broadleaf_spreading_fruit, { seed: 1 }), mats)
    expect(tree.getObjectByName('wood')!.userData.destructionMaterial).toBe('green_wood')
    expect(tree.getObjectByName('foliage')!.userData.destructionMaterial).toBe('foliage')
    expect(tree.getObjectByName('fruit')!.userData.destructionMaterial).toBe('flesh_fruit')
    expect(tree.getObjectByName('wood')!.userData.damageable).toEqual({ material: 'wood' })
    const dry = createPlantObject(THREE, generate(SAMPLES.broadleaf_round, { seed: 1, condition: 'dry' }), mats)
    expect(dry.getObjectByName('wood')!.userData.destructionMaterial).toBe('wood_soft')
    const cactus = createPlantObject(THREE, generate(SAMPLES.cactus_columnar, { seed: 1 }), mats)
    expect(cactus.getObjectByName('foliage')!.userData.destructionMaterial).toBe('cactus')
    const custom = createPlantObject(THREE, generate(SAMPLES.broadleaf_round, { seed: 1 }), mats, { materialIds: { wood: 'oak' } })
    expect(custom.getObjectByName('wood')!.userData.destructionMaterial).toBe('oak')
    const viaMats = createVegetationMaterials(THREE, { materialIds: { foliage: 'leaf' } })
    const t2 = createPlantObject(THREE, generate(SAMPLES.broadleaf_round, { seed: 1 }), viaMats)
    expect(t2.getObjectByName('foliage')!.userData.destructionMaterial).toBe('leaf')
    const lot = buildLot([{ species: 'a', x: 0, z: 0, ry: 0, scale: 1, seed: 1 }], () => SAMPLES.broadleaf_round, { quality: 'high' })
    expect(createLotObject(THREE, lot, mats, { materialIds: { wood: 'x' } }).getObjectByName('wood')!.userData.destructionMaterial).toBe('x')
  })
})
