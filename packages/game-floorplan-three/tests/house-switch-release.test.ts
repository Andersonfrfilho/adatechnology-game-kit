import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it, vi } from 'vitest'

import { fakeRoom } from './helpers/area-room'
import { THREE, houseOf, planOf } from './helpers/houses'

const DT = 1 / 30
const C4 = { energy: 345600, radius: 18 }
const BYSTANDER = 'bystander'
const BYSTANDER_SPEC: DestructibleSpec = { parts: [{ id: 'body', material: 'wood_hard', shape: { kind: 'box', size: [0.6, 0.6, 0.6] }, position: [0, 0.3, 0] }] }

type Disposable = { dispose(): void }

/** A house blown up and set on fire, next to a burning crate that is not the house's: what the switch of the bench must free, and what it must leave. */
function burntHouse() {
  const world = createDestruction({ seed: 1 })
  const scene = new THREE.Scene()
  const released: string[][] = []
  const renderer = createDestructionRenderer(THREE, { scene, world, onReleased: (ids) => released.push([...ids]) })
  const step = (seconds: number): void => {
    for (let t = 0; t < seconds; t += DT) {
      world.update(DT)
      renderer.update(DT)
    }
  }
  const { house, renderer: houses } = houseOf(planOf('casaA', 1), { destruction: world, destructionRenderer: renderer }, { quality: 'game' })
  scene.add(house.group)
  house.destruction.activate()
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial())
  crate.position.set(40, 0.3, 0)
  scene.add(crate)
  world.add(BYSTANDER_SPEC, { id: BYSTANDER, position: [40, 0, 0] })
  renderer.bind(BYSTANDER, crate)
  // what the house drew before it was hit: its own materials (the renderer's palette, shared with the next house) are not the switch's to free
  const houseMaterials = new Set<unknown>()
  house.group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) for (const m of [mesh.material].flat()) houseMaterials.add(m)
  })
  const centre = new THREE.Box3().setFromObject(house.group).getCenter(new THREE.Vector3())
  world.explode([centre.x, 1, centre.z], C4.energy, C4.radius)
  step(1)
  for (const id of world.ids()) world.hit(id, { type: 'fire', point: [centre.x, 0.3, centre.z], temperature: 900, radius: 4, duration: 3 })
  world.hit(BYSTANDER, { type: 'fire', point: [40, 0.3, 0], temperature: 900, radius: 1, duration: 3 })
  step(2)
  return { world, scene, renderer, houses, house, crate, houseMaterials, released, step }
}

/** Every geometry and material the old house and its pieces drew that are their own (not the palette, not marked shared), each with a spy on `dispose`. */
function spyOwnResources(scene: THREE.Scene, houseRoot: THREE.Object3D, shared: Set<unknown>) {
  const spies = new Map<Disposable, ReturnType<typeof vi.spyOn>>()
  const own = (o: THREE.Object3D): void => {
    o.traverse((child) => {
      const mesh = child as THREE.Mesh
      // the bare bars are instances of the renderer's one bar shape and steel, freed with the renderer (the cage itself goes with `removeObject`)
      if (!mesh.isMesh || mesh.name === 'rebar-cage') return
      if (mesh.geometry && !mesh.geometry.userData.shared && !spies.has(mesh.geometry)) spies.set(mesh.geometry, vi.spyOn(mesh.geometry, 'dispose'))
      for (const m of [mesh.material].flat()) if (m && !shared.has(m) && !spies.has(m)) spies.set(m, vi.spyOn(m, 'dispose'))
    })
  }
  own(houseRoot)
  for (const child of scene.children) if (child.name.startsWith('destruction-piece-')) own(child)
  return spies
}

describe('a house replaced on the floorplan bench', () => {
  it('takes its pieces out of the world and frees their bodies, fires, particles, fragments and marks; the crate beside it burns on', () => {
    const { world, scene, renderer, house, houseMaterials, released, step } = burntHouse()
    const houseId = house.destruction.id as string
    const before = renderer.stats()
    expect(before.pieces).toBeGreaterThan(0)
    expect(before.particles).toBeGreaterThan(0)
    expect(before.fragments).toBeGreaterThan(0)
    const pieces = world.ids().filter((id) => id !== houseId && id !== BYSTANDER)
    expect(pieces.length).toBeGreaterThan(0)
    expect(scene.children.some((child) => child.name.startsWith('destruction-piece-'))).toBe(true)
    const spies = spyOwnResources(scene, house.group, houseMaterials)
    expect(spies.size).toBeGreaterThan(0)

    house.dispose()

    expect(world.ids()).toEqual([BYSTANDER])
    expect(released.flat().sort()).toEqual([...pieces].sort())
    expect(scene.children.some((child) => child.name.startsWith('destruction-piece-'))).toBe(false)
    for (const [resource, spy] of spies) expect(spy, `${(resource as { type?: string; name?: string }).type} ${(resource as { name?: string }).name ?? ''} disposed`).toHaveBeenCalled()
    const after = renderer.stats()
    expect(after.pieces).toBe(0)
    expect(after.fragments).toBe(0)
    expect(after.decals).toBe(0)
    // only the crate gives off anything now, and it goes on burning
    expect(world.part(BYSTANDER, 'body')?.burning).toBe(true)
    step(1)
    expect(renderer.stats().particles).toBeGreaterThan(0)
    expect(world.ids()).toEqual([BYSTANDER])
    expect(renderer.stats().pieces).toBe(0)
  })

  it('builds the next house whole, in a world with nothing of the old one left', () => {
    const { world, renderer, houses, house, step } = burntHouse()
    house.dispose()
    const next = houses.build(planOf('sobrado', 2), { quality: 'game' })
    next.destruction.activate()
    const id = next.destruction.id as string
    expect(world.ids().sort()).toEqual([BYSTANDER, id].sort())
    step(1)
    const state = world.state(id)
    expect(state?.parts.length).toBeGreaterThan(0)
    expect(state?.parts.every((part) => part.status === 'intact' && !part.burning)).toBe(true)
    expect(renderer.stats().pieces).toBe(0)
    expect(renderer.stats().fragments).toBe(0)
  })

  it('reset puts the house back with no piece of it left in the world', () => {
    const { world, house, renderer } = burntHouse()
    const houseId = house.destruction.id as string
    house.destruction.reset()
    expect(world.ids().sort()).toEqual([BYSTANDER, houseId].sort())
    expect(renderer.stats().pieces).toBe(0)
    expect(renderer.stats().fragments).toBe(0)
  })

  it('the bench switching templates leaves only the new house in the world', () => {
    const room = fakeRoom()
    room.set('template', 'single_storey_a')
    room.act('build')
    const first = room.module.houses[0]!.house
    const centre = new THREE.Box3().setFromObject(first.group).getCenter(new THREE.Vector3())
    room.world.explode([centre.x, 1, centre.z], C4.energy, C4.radius)
    room.step(1)
    expect(room.world.ids().length).toBeGreaterThan(1)
    expect(room.renderer.stats().pieces).toBeGreaterThan(0)

    room.set('template', 'townhouse')
    room.act('build')

    const next = room.module.houses[0]!.house
    expect(next).not.toBe(first)
    expect(room.world.ids()).toEqual([next.destruction.id])
    expect(room.renderer.stats()).toMatchObject({ pieces: 0, fragments: 0, particles: 0 })
    room.detach?.()
  })
})
