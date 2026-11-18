import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import type { Mesh, Object3D } from 'three'
import { HOUSE_SHADOW_REBATCH_AFTER_MS, createHouseShadowBatches } from '../src/house/shadow-batches'
import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

/** The meshes that draw a shadow of their own (shown up to the root, casting), and the triangles of them. */
function casters(root: Object3D): { meshes: Mesh[]; triangles: number } {
  const meshes: Mesh[] = []
  root.traverseVisible((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh && mesh.castShadow) meshes.push(mesh)
  })
  const trianglesOf = (mesh: Mesh): number => (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position!.count) / 3
  return { meshes, triangles: meshes.reduce((sum, mesh) => sum + trianglesOf(mesh), 0) }
}

/** The triangles a shadow batch still draws (a released mesh's are collapsed to one vertex). */
function liveTriangles(batch: Mesh): number {
  const index = batch.geometry.index!.array
  let live = 0
  for (let at = 0; at < index.length; at += 3) if (index[at] !== index[at + 1] || index[at] !== index[at + 2]) live++
  return live
}

function setup() {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const { house } = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  scene.add(house.group)
  house.destruction.activate()
  const settle = (): void => {
    // merged over the frames, a few ms each
    for (let frame = 0; frame < 400; frame++) house.update(1 / 60)
  }
  return { house, settle }
}

describe('house shadow batches', () => {
  it('casts the shadow of the same triangles from a few batches, the meshes still drawn on their own', () => {
    const { house, settle } = setup()
    const before = casters(house.group)
    settle()
    const batches = house.group.getObjectByName('house-shadow-batches')!.children as Mesh[]
    const after = casters(house.group)
    const own = after.meshes.filter((mesh) => !batches.includes(mesh))
    expect(before.meshes.length).toBeGreaterThan(150)
    expect(batches.length).toBeGreaterThan(0)
    expect(after.meshes.length, `${before.meshes.length} shadow draws before`).toBeLessThan(before.meshes.length / 3)
    // the depth pass draws what it drew before, triangle for triangle
    const ownTriangles = own.reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position!.count) / 3, 0)
    expect(ownTriangles + batches.reduce((sum, batch) => sum + liveTriangles(batch), 0)).toBe(before.triangles)
  })

  it('gives a piece that breaks its own shadow back, of its new shape', () => {
    const { house, settle } = setup()
    settle()
    const wall = house.structure.parts.find((part) => part.role === 'wall' && house.structure.meshesOf(part.id).some((item) => 'mesh' in item && item.mesh))!
    const mesh = house.structure.meshesOf(wall.id).map((item) => ('mesh' in item ? item.mesh : null)).find(Boolean) as Mesh
    expect(mesh.castShadow, 'batched: cast by the batch').toBe(false)
    house.destruction.hide(wall.id)
    house.update(1 / 60)
    expect(mesh.castShadow, 'its positions were written: it casts its own shadow, without the hidden piece').toBe(true)
    house.dispose()
    expect(house.group.getObjectByName('house-shadow-batches')).toBeUndefined()
  })

  it('is off with `shadowBatches: false`', () => {
    const { house } = houseOf(planOf('sobrado', 3), { shadowBatches: false })
    const before = casters(house.group).meshes.length
    for (let frame = 0; frame < 50; frame++) house.update(1 / 60)
    expect(house.group.getObjectByName('house-shadow-batches')).toBeUndefined()
    expect(casters(house.group).meshes.length).toBe(before)
  })

  it('batches again from what stands once a quarter of the meshes cast on their own and the house is quiet', () => {
    let clock = 0
    const root = new THREE.Group()
    const material = new THREE.MeshLambertMaterial()
    const walls = Array.from({ length: 8 }, (_, at) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
      mesh.position.set(at * 2, 0, 0)
      mesh.castShadow = true
      root.add(mesh)
      return mesh
    })
    const batches = createHouseShadowBatches(THREE, root, { now: () => clock })
    batches.update()
    batches.update()
    expect(walls.every((wall) => !wall.castShadow)).toBe(true)
    // a blast knocks three walls off their spot (and they stay there)
    for (const wall of walls.slice(0, 3)) wall.position.y += 0.3
    root.updateMatrixWorld(true)
    batches.update()
    expect(batches.batcher!.stats()).toMatchObject({ batched: 5, released: 3 })
    clock += HOUSE_SHADOW_REBATCH_AFTER_MS - 1
    batches.update()
    expect(batches.batcher!.stats().released, 'not quiet long enough').toBe(3)
    clock += 1
    batches.update()
    batches.update()
    expect(batches.batcher!.stats()).toMatchObject({ batched: 8, released: 0 })
    expect(walls.every((wall) => !wall.castShadow)).toBe(true)
    batches.dispose()
    expect(walls.every((wall) => wall.castShadow)).toBe(true)
  })
})
