import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** A lamp shot to pieces goes dark: nothing the fleet drew inside its box still glows (the extra bulbs, strips and reversing lamps of a cluster, not only the lamp's own list). */
const AK = { type: 'ballistic', energy: 2100, caliber: 7.62 } as const
const MODELS = ['compact_hatch', 'midsize_suv', 'fastback_sedan', 'box_truck', 'city_bus', 'ambulance', 'light_4x4', 'monster_truck', 'tractor', 'cruiser', 'scooter', 'armored_car_6x6']
const BOX_MARGIN = 0.03
const GLOW_MIN = 0.05
const ROUNDS_TO_BREAK = 12

function glowingIn(vehicle: THREE.Object3D, box: { center: readonly number[]; size: readonly number[] }): string[] {
  const found: string[] = []
  vehicle.updateMatrixWorld(true)
  vehicle.traverse((o) => {
    const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    if (!mesh.isMesh || mesh.userData.glass || Array.isArray(mesh.material)) return
    for (let up: THREE.Object3D | null = mesh; up; up = up.parent) if (!up.visible) return
    const { emissive, emissiveIntensity } = mesh.material
    if (!emissive || !(emissiveIntensity > 0) || emissive.r + emissive.g + emissive.b < GLOW_MIN) return
    mesh.geometry.computeBoundingBox()
    const mid = vehicle.worldToLocal(mesh.localToWorld(mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())))
    const inside = [mid.x, mid.y, mid.z].every((v, i) => Math.abs(v - box.center[i]!) <= box.size[i]! / 2 + BOX_MARGIN)
    if (inside) found.push(`${emissive.getHexString()}@${mid.x.toFixed(2)},${mid.y.toFixed(2)},${mid.z.toFixed(2)}`)
  })
  return found
}

describe('a lamp that is shot out', () => {
  for (const key of MODELS) {
    it(`${key}: no glow is left inside the box of a broken head or tail lamp`, () => {
      const kit = makeFleetKit('en')
      const item = buildVehicleItem(kit, key)
      const d = createVehicleDestructible(kit, item.vehicle, { id: key, frame: item.root })
      const vehicle = item.vehicle.vehicle as THREE.Object3D
      const lamps = d.describe().parts.filter((p) => /light|lamp/.test(p.id))
      expect(lamps.length).toBeGreaterThan(0)
      const centres = new Map(lamps.map((p) => [p.id, vehicle.worldToLocal(new THREE.Vector3(...d.partWorldCenter(p.id)))]))
      for (const lamp of lamps) {
        for (let round = 0; round < ROUNDS_TO_BREAK && d.state().parts.find((p) => p.id === lamp.id)?.status !== 'broken'; round++) {
          d.hit({ ...AK, point: d.partWorldCenter(lamp.id), part: lamp.id, direction: [0, 0, 1] })
        }
        expect(d.state().parts.find((p) => p.id === lamp.id)?.status).toBe('broken')
        const at = centres.get(lamp.id)!
        if (lamp.shape.kind !== 'box') throw new Error(`${lamp.id} is not a box`)
        expect(glowingIn(vehicle, { center: [at.x, at.y, at.z], size: lamp.shape.size }), `${key} ${lamp.id}`).toEqual([])
      }
    })
  }
})
