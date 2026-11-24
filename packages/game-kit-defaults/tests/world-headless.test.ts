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

const track = (resources: { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> }, disposed: Set<unknown>): void => {
  for (const geometry of resources.geometries) geometry.addEventListener('dispose', () => disposed.add(geometry))
  for (const material of resources.materials) material.addEventListener('dispose', () => disposed.add(material))
}

describe('the world with no GPU', () => {
  it('builds, steps, resets and disposes without leaving anything in the scene or undisposed, what the steps made included', async () => {
    const scene = new THREE.Scene()
    const before = new Set<THREE.Object3D>()
    scene.traverse((object) => before.add(object))
    const world = await makeWorld({ scene })
    expect(world.view.scene).toBe(scene)
    expect(world.sun.castShadow).toBe(true)
    expect(world.ground.at(0, 0)).toBe(world.ground.terrain.heightAt(0, 0))
    expect(world.destruction.world.has('room_ground')).toBe(true)

    const disposed = new Set<unknown>()
    const known = resourcesUnder(scene)
    expect(known.geometries.size).toBeGreaterThan(0)
    track(known, disposed)
    const everything = { geometries: new Set(known.geometries), materials: new Set(known.materials) }

    const renderer = world.destruction.renderer
    for (let frame = 0; frame < 6; frame++) {
      renderer.emit('dust', [1, 0.5, 1], [0, 1, 0], 40, 2)
      renderer.emit('chips', [-1, 0.5, 1], [0, 1, 0], 30, 3)
      renderer.emit('fire', [0, 0.1, -1], [0, 1, 0], 6, 1.5)
      world.frame.scheduler.advance(world.frame.tick * 2)
      world.frame.scheduler.frame(1 / 60, { render: false, exact: true })
      // what a step made is tracked the moment it is in the scene
      const made = resourcesUnder(scene)
      const fresh = { geometries: new Set([...made.geometries].filter((each) => !everything.geometries.has(each))), materials: new Set([...made.materials].filter((each) => !everything.materials.has(each))) }
      track(fresh, disposed)
      for (const each of fresh.geometries) everything.geometries.add(each)
      for (const each of fresh.materials) everything.materials.add(each)
    }
    expect(world.frame.scheduler.stats().tick).toBeGreaterThan(0)

    world.reset()
    expect(world.destruction.world.has('room_ground')).toBe(true)
    expect(world.pieces.all.length).toBe(0)

    world.dispose()
    const leftover = new Set<THREE.Object3D>()
    scene.traverse((object) => leftover.add(object))
    expect([...leftover].filter((object) => !before.has(object))).toEqual([])
    const kept = [...everything.geometries, ...everything.materials].filter((resource) => !disposed.has(resource))
    expect(kept.map((resource) => `${resource.type}:${resource.name}`)).toEqual([])
  })

  it('after reset() is the same as a fresh host: the worlds, the ground and the random stream', async () => {
    const used = await makeWorld()
    const fresh = await makeWorld()
    try {
      const renderer = used.destruction.renderer
      renderer.emit('dust', [1, 0.5, 1], [0, 1, 0], 40, 2)
      used.frame.scheduler.advance(0.5)
      for (let draw = 0; draw < 5; draw++) used.random()
      used.reset()
      expect(used.destruction.world.serialize()).toEqual(fresh.destruction.world.serialize())
      expect(used.liquids.fluids.serialize()).toEqual(fresh.liquids.fluids.serialize())
      expect(used.ground.terrain.layout()).toEqual(fresh.ground.terrain.layout())
      expect([used.random(), used.random(), used.random()]).toEqual([fresh.random(), fresh.random(), fresh.random()])
      // and it steps on to the same place
      used.frame.scheduler.advance(0.25)
      fresh.frame.scheduler.advance(0.25)
      expect(used.destruction.world.serialize()).toEqual(fresh.destruction.world.serialize())
    } finally {
      used.dispose()
      fresh.dispose()
    }
  })

  it('leaves the random stream of the game alone on reset', async () => {
    let draws = 0
    const own = (): number => ++draws
    const world = await makeWorld({ random: own })
    try {
      expect(world.random).toBe(own)
      world.reset()
      expect(draws).toBe(0)
    } finally {
      world.dispose()
    }
  })

  it('answers the ground through the providers it was given, lazily', async () => {
    const world = await makeWorld()
    try {
      let seen: unknown = null
      world.ground.addProvider((renderer) => {
        seen = renderer
        return (x, z) => (x > 1 && x < 2 && z > 1 && z < 2 ? 0.8 : 0)
      })
      expect(seen).toBe(world.destruction.renderer)
      expect(world.ground.at(1.5, 1.5)).toBe(0.8)
      expect(world.ground.at(5, 5)).toBe(world.ground.terrain.heightAt(5, 5))
    } finally {
      world.dispose()
    }
  })

  it('tells the game the pieces its renderer lets go, and forgets them itself', async () => {
    const world = await makeWorld()
    try {
      const released: string[][] = []
      world.destruction.on('released', (ids) => void released.push([...ids]))
      expect(world.pieces.all).toEqual([])
      world.pieces.forget(['nothing'])
      expect(released).toEqual([])
    } finally {
      world.dispose()
    }
  })
})
