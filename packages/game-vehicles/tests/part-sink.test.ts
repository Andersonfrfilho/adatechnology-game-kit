import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildVehicleItem, createVehicleDestructible } from '../src'
import type { VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

const JOINT = 'door_front_left~underbody'

const unbolt = (d: VehicleDestructible): void => {
  for (let i = 0; i < 200 && d.disassemble!(JOINT, 'wrench', 0.2) < 1; i++) d.update!(0.2)
  d.update!(0.1)
}

const setup = (taken: boolean): { d: VehicleDestructible; holders: THREE.Object3D[]; root: THREE.Object3D; scene: THREE.Group; kit: ReturnType<typeof makeKit>; item: ReturnType<typeof buildVehicleItem> } => {
  const kit = makeKit()
  const item = buildVehicleItem(kit, 'proto')
  const scene = new THREE.Group()
  scene.add(item.root)
  const d = createVehicleDestructible(kit, item.vehicle, { id: 'sink', frame: item.root })
  const holders: THREE.Object3D[] = []
  d.setPartSink((_part, holder) => {
    holders.push(holder)
    return taken
  })
  return { d, holders, root: item.root, scene, kit, item }
}

describe('a part that came off with a sink on the vehicle', () => {
  it('is left to the sink when the sink takes it: the vehicle does not fling it', () => {
    const { d, holders } = setup(true)
    unbolt(d)
    const holder = holders[0]!
    const at = holder.position.clone()
    for (let i = 0; i < 20; i++) d.update!(0.1)
    expect(holder.position.distanceTo(at)).toBe(0)
  })

  it('falls back to the vehicle\'s own fling when the sink does not take it (no chassis body to carry it)', () => {
    const { d, holders } = setup(false)
    unbolt(d)
    const holder = holders[0]!
    const at = holder.position.clone()
    for (let i = 0; i < 20; i++) d.update!(0.1)
    expect(holder.position.distanceTo(at)).toBeGreaterThan(0)
  })

  it('goes with the vehicle on reset(): the holder leaves the scene and the part\'s geometry is released', () => {
    const { d, holders, scene } = setup(true)
    unbolt(d)
    const holder = holders[0]!
    const geometries: THREE.BufferGeometry[] = []
    holder.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (mesh.isMesh) geometries.push(mesh.geometry)
    })
    expect(geometries.length).toBeGreaterThan(0)
    let released = 0
    for (const geometry of geometries) geometry.addEventListener('dispose', () => released++)
    d.reset!()
    let node: THREE.Object3D | null = holder
    while (node && node !== scene) node = node.parent
    expect(node).toBeNull()
    expect(released).toBe(geometries.length)
  })

  it('goes with the vehicle on kit.dispose(): the part\'s geometry is released', () => {
    const { d, holders, kit, item } = setup(true)
    unbolt(d)
    const geometries: THREE.BufferGeometry[] = []
    holders[0]!.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (mesh.isMesh) geometries.push(mesh.geometry)
    })
    let released = 0
    for (const geometry of geometries) geometry.addEventListener('dispose', () => released++)
    d.dispose()
    kit.dispose(item.vehicle)
    expect(released).toBe(geometries.length)
  })
})
