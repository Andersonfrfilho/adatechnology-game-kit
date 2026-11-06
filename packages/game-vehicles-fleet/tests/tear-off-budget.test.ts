import { describe, expect, it } from 'vitest'
import type { Mesh } from 'three'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { referenceCrease } from '../../game-vehicles/tests/helpers/crease-reference'
import { makeFleetKit } from './helpers/kit'

describe('a panel torn off by a blast', () => {
  it('does not smooth every vertex in the frame of the blast, and is smoothed over the next frames and ends with the exact normals of the one-shot smoothing', () => {
    const kit = makeFleetKit('en')
    const item = buildVehicleItem(kit, 'midsize_sedan')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
    d.hit({ type: 'explosive', point: d.partWorldCenter('side_rear_left'), energy: 400000, radius: 3 })
    const meshes: Mesh[] = []
    item.root.traverse((obj) => {
      const o = obj as Mesh
      if (o.isMesh && o.geometry.userData.crease && o.geometry.attributes.position.count > 50000) meshes.push(o)
    })
    expect(meshes.length).toBeGreaterThan(0)
    const flat = meshes.map((m) => Array.from(m.geometry.attributes.normal.array as Float32Array))
    for (let frame = 0; frame < 400; frame++) d.update!(1 / 60)
    meshes.forEach((m, k) => {
      const expected = referenceCrease(kit.THREE, m.geometry.clone().deleteAttribute('normal'), 42)
      expect(Array.from(m.geometry.attributes.normal.array)).toEqual(Array.from(expected.attributes.normal.array))
      expect(Array.from(m.geometry.attributes.normal.array)).not.toEqual(flat[k])
    })
  })
})
