import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createCreaseQueue, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

const setup = (attach: boolean) => {
  const kit: any = makeFleetKit('en')
  const creaseQueue = createCreaseQueue()
  const item = buildVehicleItem(kit, 'midsize_sedan')
  const d: any = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root, creaseQueue })
  const queue = creaseQueue.deferredQueue()
  if (attach) queue.attach?.()
  d.hit({ type: 'explosive', point: d.partWorldCenter('side_rear_left'), energy: 400000, radius: 3 })
  const meshes: any[] = []
  item.root.traverse((o: any) => {
    if (o.isMesh && o.geometry.userData.crease && o.geometry.attributes.position.count > 50000) meshes.push(o)
  })
  return { d, queue, meshes }
}

const normalsOf = (meshes: any[]): number[][] => meshes.map((m) => Array.from(m.geometry.attributes.normal.array as Float32Array))

describe('vehicle crease through the shared queue', () => {
  it('keeps smoothing in the vehicle update until a budget attaches the queue, and asking for it changes nothing', () => {
    const { d, meshes, queue } = setup(false)
    const flat = normalsOf(meshes)
    for (let frame = 0; frame < 400; frame++) d.update(1 / 60)
    expect(normalsOf(meshes)).not.toEqual(flat)
    expect(queue.pending(1)).toBe(0)
  })

  it('does not run in the frame of the cut, does not smooth in the vehicle update, and the queue ends with the exact normals of the update path', () => {
    const reference = setup(false)
    for (let frame = 0; frame < 400; frame++) reference.d.update(1 / 60)

    const { d, meshes, queue } = setup(true)
    const flat = normalsOf(meshes)
    d.update(1 / 60)
    expect(queue.pending(1)).toBe(0)
    for (let frame = 2; frame < 60; frame++) d.update(1 / 60)
    expect(normalsOf(meshes)).toEqual(flat)
    expect(queue.pending(2)).toBeGreaterThan(0)
    let guard = 0
    while (queue.pending(2) > 0 && guard++ < 10000) queue.run(Infinity, () => 0)
    expect(queue.pending(2)).toBe(0)
    expect(normalsOf(meshes)).toEqual(normalsOf(reference.meshes))
    expect(normalsOf(meshes)).not.toEqual(flat)
  })

  it('goes back to the vehicle update on detach', () => {
    const { d, meshes, queue } = setup(true)
    const flat = normalsOf(meshes)
    queue.detach?.()
    for (let frame = 0; frame < 400; frame++) d.update(1 / 60)
    expect(normalsOf(meshes)).not.toEqual(flat)
  })
})
