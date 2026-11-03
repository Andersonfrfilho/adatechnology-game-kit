import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGeometryPool, createMaterialPool } from '@adatechnology/game-render-three'
import { buildWeaponModelById } from '../src'
import { flameJet } from '../src/fx/heavy'
import type { HeavyContext } from '../src/fx/heavy'
import { createParticles } from '../src/fx/particles'
import { modelKit } from '../src/models/kit'

function setup(withPools: boolean) {
  const scene = new THREE.Scene()
  const model = buildWeaponModelById(THREE, 'm2_flamethrower') ?? buildWeaponModelById(THREE, 'rpg_7')!
  scene.add(model.root)
  const particles = createParticles(THREE, scene, () => 0)
  const pools = { geometries: createGeometryPool(), materials: createMaterialPool() }
  const tasks: Array<{ seconds: number; step: (progress: number, dt: number) => void; done?: () => void }> = []
  const noop = (): void => undefined
  const context: HeavyContext = {
    kit: modelKit(THREE),
    scene,
    particles,
    effects: { backblast: noop, smoke: noop, flameJet: noop, muzzleFlash: noop } as unknown as HeavyContext['effects'],
    random: () => 0,
    parts: { ...model.parts, muzzle: model.root } as HeavyContext['parts'],
    forward: () => new THREE.Vector3(1, 0, 0),
    positionOf: () => new THREE.Vector3(0, 0.4, 0),
    orientation: () => new THREE.Quaternion(),
    every: (seconds, step, done) => void tasks.push({ seconds, step, ...(done ? { done } : {}) }),
    groundAt: () => 0,
    ...(withPools ? { pools } : {}),
  }
  return { context, particles, pools, tasks, scene }
}

describe('the flamethrower droplets and ground flames through the host pools', () => {
  it('share one geometry and one material per kind, and give them back when they go', () => {
    const { context, particles, pools, tasks } = setup(true)
    for (let shot = 0; shot < 6; shot++) flameJet(context, 0.016, 1)
    expect(particles.count('other')).toBe(6)
    expect(pools.geometries.stats().entries).toBe(1)
    expect(pools.materials.stats().entries).toBe(1)
    expect(pools.geometries.stats().inUse).toBe(1)
    for (let frame = 0; frame < 90; frame++) particles.update(0.016)
    // every droplet reached the floor and lit three flames each: the flames share too
    expect(tasks.length).toBe(6)
    expect(pools.geometries.stats().entries).toBe(2)
    expect(pools.materials.stats().entries).toBe(3)
    for (const task of tasks) task.done?.()
    expect(pools.geometries.stats().inUse).toBe(0)
    expect(pools.materials.stats().inUse).toBe(0)
    expect(pools.geometries.trim()).toBe(2)
  })

  it('without pools each droplet and flame makes its own, as before', () => {
    const { context, particles, pools, tasks, scene } = setup(false)
    flameJet(context, 0.016, 1)
    const droplet = scene.children.find((child) => (child as THREE.Mesh).geometry?.type === 'SphereGeometry') as THREE.Mesh
    expect(droplet).toBeDefined()
    for (let frame = 0; frame < 90; frame++) particles.update(0.016)
    expect(pools.geometries.stats().entries).toBe(0)
    expect(tasks.length).toBe(1)
    tasks[0]!.done?.()
  })
})
