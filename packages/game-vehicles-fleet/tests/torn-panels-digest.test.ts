import { describe, expect, it } from 'vitest'
import type { Mesh, Object3D } from 'three'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

const HITS = ['side_rear_left', 'hood', 'door_front_right', 'roof', 'bumper_front', 'lid', 'fender_front_left', 'bumper_rear', 'door_rear_left']
/* digest of the geometry of the sedan after those panels were torn off and the smoothing finished, taken before the cut and the decals used the box of the panel.
   Retaken when the lamps began to break by their lens (polycarbonate headlights and acrylic taillights come apart in fewer, larger pieces, and a broken
   lens keeps its jagged edge in the bezel): the panels and the body are the same, only the lamps the tear breaks differ. Retaken again when the lamps drawn
   outside the lamp units (the running lamps of the bumper, the fog bulbs) became lamps of their own: the blasts break them too, and their lens pieces fly. Retaken
   when the heat of a blast became its fireball's: 0.48 kg of TNT (400 kJ) burns 1 m wide for 8 ms, 11.7 kJ/m2 against the 99 kJ/m2 a tyre or plastic needs, so
   the nine blasts no longer set the car's rubber and plastics alight as the old 450 °C over half the radius did. Retaken when a blast on a vehicle became the P-I work
   of its wave on each part (waveWork): 0.48 kg of TNT against a panel crushes it with the contact shock, 0.04 x 0.48 kg x 4.184 MJ/kg x a half = 40 kJ, where the old
   energy / (1 + 4 d^2) x 0.04 gave it 16 kJ: the panels the blasts tear off come apart in more pieces (827 to 875 nodes). */
const GOLDEN_DIGEST = '875:4039612788'

function digestOf(root: Object3D): string {
  let h = 2166136261
  const mix = (v: number) => {
    h = Math.imul(h ^ v, 16777619) >>> 0
  }
  let meshes = 0
  root.traverse((obj) => {
    const o = obj as Mesh
    if (!o.isMesh || !o.geometry) return
    meshes++
    mix(o.visible ? 1 : 0)
    for (const name of Object.keys(o.geometry.attributes).sort()) {
      const arr = o.geometry.attributes[name].array
      const bits = new Uint32Array(arr.buffer, arr.byteOffset, arr.length)
      for (let i = 0; i < bits.length; i++) mix(bits[i] as number)
    }
    const index = o.geometry.index
    if (index) for (let i = 0; i < index.array.length; i++) mix(index.array[i])
    for (const e of o.matrixWorld.elements) mix(Math.round(e * 1e5))
  })
  return `${meshes}:${h}`
}

describe('panels torn off the sedan', () => {
  it('end with the same geometry as before the cut and the decals used the box of the panel', () => {
    const kit = makeFleetKit('en')
    const item = buildVehicleItem(kit, 'midsize_sedan')
    const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
    for (const part of HITS) d.hit({ type: 'explosive', point: d.partWorldCenter(part), energy: 400000, radius: 3 })
    for (let frame = 0; frame < 600; frame++) d.update!(1 / 60)
    const first = digestOf(item.root)
    console.log('DIGEST', first)
    expect(first).toBe(GOLDEN_DIGEST)
  })
})
