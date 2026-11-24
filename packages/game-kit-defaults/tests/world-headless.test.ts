// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { makeWorld } from './world-helpers'

const resourcesUnder = (root: THREE.Object3D): { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> } => {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const drawn = object as THREE.Mesh
    if (drawn.geometry) geometries.add(drawn.geometry)
    const material = drawn.material as THREE.Material | THREE.Material[] | undefined
    for (const each of Array.isArray(material) ? material : material ? [material] : []) materials.add(each)
  })
  return { geometries, materials }
}

describe('the world with no GPU', () => {
  it('builds, steps once, resets and disposes without leaving anything in the scene', async () => {
    const before = new Set<THREE.Object3D>()
    const scene = new THREE.Scene()
    scene.traverse((object) => before.add(object))
    const world = await makeWorld({ scene })
    expect(world.view.scene).toBe(scene)
    expect(world.sun.castShadow).toBe(true)
    expect(world.ground.at(0, 0)).toBe(world.ground.terrain.heightAt(0, 0))
    expect(world.destruction.world.has('room_ground')).toBe(true)

    const { geometries, materials } = resourcesUnder(scene)
    expect(geometries.size).toBeGreaterThan(0)
    const disposed = new Set<unknown>()
    for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed.add(geometry))
    for (const material of materials) material.addEventListener('dispose', () => disposed.add(material))

    world.frame.scheduler.advance(world.frame.tick * 2)
    world.frame.scheduler.frame(1 / 60, { render: false, exact: true })
    expect(world.frame.scheduler.stats().tick).toBeGreaterThan(0)

    world.reset()
    expect(world.destruction.world.has('room_ground')).toBe(true)
    expect(world.pieces.all.length).toBe(0)

    world.dispose()
    const leftover = new Set<THREE.Object3D>()
    scene.traverse((object) => leftover.add(object))
    expect([...leftover].filter((object) => !before.has(object))).toEqual([])
    const kept = [...geometries, ...materials].filter((resource) => !disposed.has(resource))
    expect(kept.map((resource) => `${resource.type}:${resource.name}`)).toEqual([])
  })

  it('answers the ground through the providers it was given, lazily', async () => {
    const world = await makeWorld()
    let seen: unknown = null
    world.ground.addProvider((renderer) => {
      seen = renderer
      return (x, z) => (x > 1 && x < 2 && z > 1 && z < 2 ? 0.8 : 0)
    })
    expect(seen).toBe(world.destruction.renderer)
    expect(world.ground.at(1.5, 1.5)).toBe(0.8)
    expect(world.ground.at(5, 5)).toBe(world.ground.terrain.heightAt(5, 5))
    world.dispose()
  })

  it('tells the game the pieces its renderer lets go, and forgets them itself', async () => {
    const world = await makeWorld()
    const released: string[][] = []
    world.destruction.on('released', (ids) => void released.push([...ids]))
    expect(world.pieces.all).toEqual([])
    world.pieces.forget(['nothing'])
    expect(released).toEqual([])
    world.dispose()
  })
})
