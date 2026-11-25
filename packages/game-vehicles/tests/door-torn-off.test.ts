import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible, type VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

const unbolt = (d: VehicleDestructible, joint: string): DestructionEvent[] => {
  let events: DestructionEvent[] = []
  for (let i = 0; i < 200 && d.disassemble!(joint, 'wrench', 0.2) < 1; i++) events = events.concat(d.update!(0.2))
  return events.concat(d.update!(0.1))
}

const luminance = (material: THREE.Material): number => {
  const color = (material as THREE.MeshStandardMaterial).color
  return color ? (color.r + color.g + color.b) / 3 : 1
}

/** Visible flat slabs (thinner than 2 cm, more than 0.25 m² of face) drawn near black: what reads as a black plate stuck on the body. */
function blackSlabsOn(vehicle: THREE.Object3D): string[] {
  const found: string[] = []
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  vehicle.updateWorldMatrix(true, true)
  vehicle.traverseVisible((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!materials.some((material) => luminance(material) < 0.02)) return
    box.setFromObject(mesh).getSize(size)
    const [thin, a, b] = [size.x, size.y, size.z].sort((p, q) => p - q) as [number, number, number]
    if (thin < 0.02 && a * b > 0.25) found.push(`${mesh.uuid} ${size.toArray().map((v) => v.toFixed(2)).join('x')}`)
  })
  return found
}

describe('a door torn off the car', () => {
  it('flies with its own skin and leaves an empty opening, with no black plate standing in its place', () => {
    const kit = makeKit()
    const item = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'proto_door', frame: item.root })
    const piv = item.root.getObjectByName('door_front_left')!
    // the half discs inside the wheel arches are drawn dark on purpose; what the torn door may not do is add a slab of its own
    const before = new Set(blackSlabsOn(d.vehicle.vehicle))
    const events = unbolt(d, 'door_front_left~underbody')
    expect(events.some((e) => e.type === 'detach' && JSON.stringify(e).includes('door_front_left'))).toBe(true)
    // the door that flies is the door the model draws: its skin went with the hinge, not a flat plate over an untouched body
    expect(piv.parent).not.toBe(d.vehicle.vehicle)
    expect(piv.children.length).toBeGreaterThan(1)
    expect(blackSlabsOn(d.vehicle.vehicle).filter((slab) => !before.has(slab))).toEqual([])
  })

  it('every mesh left on the body has a material', () => {
    const kit = makeKit()
    const item = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'proto_door_2', frame: item.root })
    unbolt(d, 'door_front_left~underbody')
    unbolt(d, 'door_front_right~underbody')
    const bare: string[] = []
    d.vehicle.vehicle.traverseVisible((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh && (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0))) bare.push(mesh.name || mesh.uuid)
    })
    expect(bare).toEqual([])
  })
})
