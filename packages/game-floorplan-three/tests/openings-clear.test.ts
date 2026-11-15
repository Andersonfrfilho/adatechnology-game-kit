import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

interface Opening { id: string; floor: number; axis: 'u' | 'v'; pos: number; at: number; width: number; y0: number; y1: number }

/** What closes a wall: its masonry, its render and its baseboard (a leaf, a frame or a pane in the opening is what belongs there). */
const WALL_FINISH = /plaster|roughcast|block|brick|baseboard/

describe('openings: no masonry, render or baseboard crosses a door or a window, outbuildings included', () => {
  for (const [template, seed] of [['single_storey_a', 1], ['single_storey_a', 2], ['townhouse', 1], ['mid_modern_single_storey', 1]] as const) {
    it(`${template} seed ${seed}`, () => {
      const plan = planOf(template, seed) as unknown as { doors: Opening[]; windows: Opening[]; floors: { y0: number }[]; outbuildings?: { doors: Opening[]; windows: Opening[] }[] }
      const house = houseOf(plan as never, {}, { quality: 'game' }).house as unknown as { group: THREE.Group }
      house.group.updateMatrixWorld(true)
      const meshes: THREE.Object3D[] = []
      house.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o) })
      const doors = [...plan.doors, ...(plan.outbuildings ?? []).flatMap((b) => b.doors.map((d) => ({ ...d, floor: 0 })))].map((d) => ({ ...d, y0: 0.2, y1: 1.2 }))
      const windows = [...plan.windows, ...(plan.outbuildings ?? []).flatMap((b) => b.windows.map((w) => ({ ...w, floor: 0, y0: w.y0 ?? 1, y1: w.y1 ?? 2 })))]
      const ray = new THREE.Raycaster()
      const blocked: string[] = []
      let crossed = 0
      for (const o of [...doors.map((d) => ({ ...d, heights: [0.2, 1.2] })), ...windows.map((w) => ({ ...w, heights: [(w.y0 + w.y1) / 2] }))]) {
        for (const h of o.heights) {
          const y = (plan.floors[o.floor]?.y0 ?? 0) + h
          const [x, z] = o.axis === 'u' ? [o.at, o.pos] : [o.pos, o.at]
          const dir = o.axis === 'u' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
          ray.set(new THREE.Vector3(x, y, z).addScaledVector(dir, -0.3), dir)
          ray.far = 0.6
          const hit = ray.intersectObjects(meshes, false)[0]
          crossed++
          if (hit && WALL_FINISH.test(hit.object.name)) blocked.push(`${o.id} at ${h} m: ${hit.object.name}`)
        }
      }
      expect(crossed).toBeGreaterThan(8)
      expect(blocked).toEqual([])
    }, 120000)
  }
})
