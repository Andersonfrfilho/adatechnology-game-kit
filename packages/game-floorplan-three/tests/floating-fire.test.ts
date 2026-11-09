import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { fakeRoom } from './helpers/area-room'

/** What the test reads of the renderer: the fire it keeps per burning part and the effects world's live fires (not part of the public API). */
type FireView = {
  readonly fires: ReadonlyMap<string, { readonly object: string; readonly part: string; readonly handle?: number }>
  readonly vfx: { fires(): ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number; readonly handle: number }> }
}

/** Distance from a point to the nearest drawn box of a part (Infinity when nothing of it is drawn). */
function distanceToDrawn(boxes: ReadonlyArray<readonly [number, number, number, number, number, number]>, point: THREE.Vector3): number {
  let best = Infinity
  const box = new THREE.Box3()
  for (const b of boxes) best = Math.min(best, box.set(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])).distanceToPoint(point))
  return best
}

describe('fire in the mansion is always on something drawn', () => {
  it('a fire over the roof lights the rafters, which have no mesh, and no flame hangs in the air', () => {
    const r = fakeRoom()
    r.set('template', 'mansion')
    r.act('build')
    r.frame(0.3)
    const houseId = r.module.houses[0]!.house.destruction.id!
    const rafters = r.world.state(houseId)!.groups.flat().filter((part) => part.startsWith('rafter') || part.startsWith('ridge'))
    // the roof frame is in the structure but not drawn: its parts exist with nothing of them on screen
    expect(rafters.length).toBeGreaterThan(0)
    expect(rafters.every((part) => r.renderer.shownBoxes(houseId, part).length === 0)).toBe(true)

    const ignited: string[] = []
    r.world.on('ignite', (event) => { if (event.type === 'ignite' && event.object === houseId && rafters.includes(event.part)) ignited.push(event.part) })
    const house = new THREE.Box3()
    for (const b of r.renderer.shownBoxes(houseId)) house.union(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])))
    const centre = house.getCenter(new THREE.Vector3())
    for (let i = 0; i < 6; i++) {
      r.world.hit(houseId, { type: 'fire', point: [centre.x, house.max.y - 1, centre.z], temperature: 900, radius: 14, duration: 0.5, source: 'fire' })
      r.frame(0.5)
    }
    expect(ignited.length).toBeGreaterThan(0)

    const view = r.renderer as unknown as FireView
    const owner = new Map<number, { object: string; part: string }>()
    for (const f of view.fires.values()) if (f.handle !== undefined) owner.set(f.handle, f)
    const floating: string[] = []
    for (const fire of view.vfx.fires()) {
      const of = owner.get(fire.handle)
      if (!of) continue
      const gap = distanceToDrawn(r.renderer.shownBoxes(of.object, of.part), new THREE.Vector3(fire.x, fire.y, fire.z))
      if (gap > 0.3) floating.push(`${of.object}|${of.part} ${gap.toFixed(2)} m`)
    }
    expect(floating).toEqual([])
  }, 120000)

  it('the fires of a house that is taken away go out with it', () => {
    const r = fakeRoom()
    r.set('template', 'mansion')
    r.act('build')
    r.frame(0.3)
    const houseId = r.module.houses[0]!.house.destruction.id!
    const house = new THREE.Box3()
    for (const b of r.renderer.shownBoxes(houseId)) house.union(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])))
    const centre = house.getCenter(new THREE.Vector3())
    for (let i = 0; i < 4; i++) {
      r.world.hit(houseId, { type: 'fire', point: [centre.x, 1, centre.z], temperature: 900, radius: 14, duration: 0.5, source: 'fire' })
      r.frame(0.5)
    }
    const view = r.renderer as unknown as FireView
    expect(view.vfx.fires().length).toBeGreaterThan(0)

    r.act('clear')
    r.frame(0.2)
    expect(view.fires.size).toBe(0)
    expect(view.vfx.fires()).toEqual([])
  }, 120000)
})
