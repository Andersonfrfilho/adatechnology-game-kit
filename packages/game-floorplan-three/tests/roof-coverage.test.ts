import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

/** What stands under the tiles: seen from above through the cover, the roof has a hole in it. */
const UNDER_THE_TILES = new Set(['stage:7:roof_framing', 'attic_tank'])

const groupOf = (o: THREE.Object3D): string => {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (UNDER_THE_TILES.has(q.name)) return q.name
  return ''
}

describe('roof cover: every face is tiled to its hips and ridge, nothing under the tiles shows from above', () => {
  for (const [template, seed] of [['single_storey_a', 1], ['single_storey_a', 2], ['single_storey_a', 3], ['townhouse', 1], ['mansion', 1], ['mid_modern_single_storey', 1]] as const) {
    it(`${template} seed ${seed}, drawn by bay as the destruction world breaks it`, () => {
      const plan = planOf(template, seed)
      const house = houseOf(plan, { destruction: true } as never, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as unknown as { group: THREE.Group }
      house.group.updateMatrixWorld(true)
      const meshes: THREE.Object3D[] = []
      house.group.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return
        for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) return
        meshes.push(o)
      })
      const roof = (plan as unknown as { roof?: { aabb?: number[] } }).roof
      const [x0, z0, x1, z1] = roof?.aabb ?? [0, 0, 0, 0]
      const ray = new THREE.Raycaster()
      const holes: string[] = []
      let tiled = 0
      for (let x = x0 + 0.1; x < x1; x += 0.25) for (let z = z0 + 0.1; z < z1; z += 0.25) {
        ray.set(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0))
        const hit = ray.intersectObjects(meshes, false)[0]
        if (!hit) continue
        const under = groupOf(hit.object)
        if (under) holes.push(`${x.toFixed(2)},${z.toFixed(2)} sees ${under}`)
        else if (hit.object.parent?.name === 'roof') tiled++
      }
      expect(tiled).toBeGreaterThan(100)
      expect(holes.slice(0, 5)).toEqual([])
    }, 180000)
  }
})
