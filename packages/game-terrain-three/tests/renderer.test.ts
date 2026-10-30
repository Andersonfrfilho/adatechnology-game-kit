import * as THREE from 'three'
import { createTerrain } from '@adatechnology/game-terrain'
import { describe, expect, it } from 'vitest'
import { createTerrainRenderer } from '../src'

const CAMERA = { x: 0, y: 2, z: 0 }
const make = (surface: string, budget = {}) => {
  const terrain = createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface }, budget })
  return { terrain, view: createTerrainRenderer(THREE, { terrain }) }
}

describe('the ground on the screen', () => {
  it('a floor nobody touched is one draw call', () => {
    const { view, terrain } = make('lawn')
    view.sync(CAMERA)
    expect(view.stats().chunkMeshes).toBe(0)
    expect(view.stats().pristineChunks).toBe(terrain.chunksX * terrain.chunksZ)
  })

  it('a dug chunk gets a mesh that follows the height, within the budget of the frame', () => {
    const { view, terrain } = make('dirt', { maxDirtyChunksPerFrame: 1 })
    view.sync(CAMERA)
    terrain.strike('explosive', { x: 0, z: 0, energy: 8e6 })
    view.sync(CAMERA)
    expect(view.stats().chunkMeshes).toBe(1)
    for (let i = 0; i < 30; i++) view.sync(CAMERA)
    expect(view.stats().chunkMeshes).toBeGreaterThan(1)
    const lowest = Math.min(...view.group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === '').map((mesh) => {
      mesh.geometry.computeBoundingBox()
      return mesh.geometry.boundingBox!.min.y
    }))
    expect(lowest).toBeLessThan(-0.2)
  })

  it('a far chunk draws fewer vertices', () => {
    const { view, terrain } = make('dirt', { maxDirtyChunksPerFrame: 100 })
    terrain.strike('explosive', { x: 0, z: 0, energy: 800_000 })
    const count = (): number => view.group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === '').reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count, 0)
    view.sync(CAMERA)
    const near = count()
    view.sync({ x: 200, y: 2, z: 0 })
    expect(count()).toBeLessThan(near)
  })

  it('draws marks and pieces, and rebar only past the cover', () => {
    const { view, terrain } = make('concrete_slab', { maxDirtyChunksPerFrame: 100 })
    terrain.strike('ballistic', { x: 1, z: 1, energy: 500 })
    view.sync(CAMERA)
    expect(view.stats().marksDrawn).toBe(1)
    expect(view.stats().debrisDrawn).toBeGreaterThan(0)
    const bars = (): number => view.group.children.filter((child) => child instanceof THREE.Mesh && (child.material as THREE.MeshStandardMaterial).metalness > 0).length
    expect(bars()).toBe(0)
    for (let i = 0; i < 40; i++) terrain.strike('explosive', { x: 0, z: 0, energy: 8e6 })
    view.sync(CAMERA)
    expect(bars()).toBeGreaterThan(0)
  })

  it('laying a new floor goes back to one flat geometry', () => {
    const { view, terrain } = make('dirt', { maxDirtyChunksPerFrame: 1000 })
    terrain.strike('explosive', { x: 0, z: 0, energy: 8e6 })
    view.sync(CAMERA)
    expect(view.stats().chunkMeshes).toBeGreaterThan(0)
    terrain.setLayout({ surface: 'road' })
    view.sync(CAMERA)
    expect(view.stats().chunkMeshes).toBe(0)
  })
})
