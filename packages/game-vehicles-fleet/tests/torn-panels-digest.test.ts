import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

const HITS = ['side_rear_left', 'hood', 'door_front_right', 'roof', 'bumper_front', 'lid', 'fender_front_left', 'bumper_rear', 'door_rear_left']
/* digest of the geometry of the sedan after those panels were torn off and the smoothing finished, taken before the cut and the decals used the box of the panel */
const GOLDEN_DIGEST = '823:4253866218'

function digestOf(root: any): string {
  let h = 2166136261
  const mix = (v: number) => {
    h = Math.imul(h ^ v, 16777619) >>> 0
  }
  let meshes = 0
  root.traverse((o: any) => {
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
    const kit: any = makeFleetKit('en')
    const item = buildVehicleItem(kit, 'midsize_sedan')
    const d: any = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
    for (const part of HITS) d.hit({ type: 'explosive', point: d.partWorldCenter(part), energy: 400000, radius: 3 })
    for (let frame = 0; frame < 600; frame++) d.update(1 / 60)
    const first = digestOf(item.root)
    console.log('DIGEST', first)
    expect(first).toBe(GOLDEN_DIGEST)
  })
})
