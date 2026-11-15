import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

interface PlanWall { floor: number; axis: 'u' | 'v'; u0: number; v0: number; u1: number; v1: number; thickness: number; type: string }

/** The L junctions of a plan: two perpendicular walls ending at one point, and the way out of the corner (diagonally away from both walls). */
function lCorners(walls: readonly PlanWall[]): { u: number; v: number; floor: number; th: number; away: [number, number] }[] {
  const ends = new Map<string, { u: number; v: number; floor: number; th: number; axes: Set<string>; n: number; away: [number, number] }>()
  for (const w of walls.filter((x) => x.type === 'wall')) {
    const alongU = w.axis === 'u', line = alongU ? w.v0 : w.u0, s0 = Math.min(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1), s1 = Math.max(alongU ? w.u0 : w.v0, alongU ? w.u1 : w.v1)
    for (const [s, dir] of [[s0, 1], [s1, -1]] as const) {
      const [u, v] = alongU ? [s, line] : [line, s]
      const key = `${w.floor}:${u.toFixed(2)}:${v.toFixed(2)}`
      const e = ends.get(key) ?? { u, v, floor: w.floor, th: w.thickness, axes: new Set<string>(), n: 0, away: [0, 0] as [number, number] }
      e.n++
      e.axes.add(w.axis)
      if (alongU) e.away[0] = -dir
      else e.away[1] = -dir
      ends.set(key, e)
    }
  }
  return [...ends.values()].filter((e) => e.n === 2 && e.axes.size === 2)
}

describe('wall corners: an L of two walls is closed, never notched (the walls stop at each other\'s axis)', () => {
  for (const [template, seed] of [['single_storey_a', 1], ['single_storey_a', 2], ['townhouse', 1], ['mansion', 1]] as const) {
    it(`${template} seed ${seed}: every L corner is solid to its outer vertex`, () => {
      const plan = planOf(template, seed)
      const house = houseOf(plan, {}, { quality: 'game' }).house as unknown as { group: THREE.Group }
      house.group.updateMatrixWorld(true)
      const meshes: THREE.Object3D[] = []
      house.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && /^f\d+$/.test(o.parent?.name ?? '')) meshes.push(o) })
      const ray = new THREE.Raycaster()
      const floors = (plan as unknown as { floors: { y0: number }[] }).floors
      const notched: string[] = []
      let checked = 0
      for (const c of lCorners((plan as unknown as { walls: PlanWall[] }).walls)) {
        const y = (floors[c.floor]?.y0 ?? 0) + 1
        const from = new THREE.Vector3(c.u + c.away[0] * 0.6, y, c.v + c.away[1] * 0.6)
        ray.set(from, new THREE.Vector3(c.u, y, c.v).sub(from).normalize())
        const hit = ray.intersectObjects(meshes, false)[0]
        if (!hit) continue
        checked++
        // the outer vertex of the corner's square, half a wall off the meeting point on both axes
        const vertex = new THREE.Vector3(c.u + (c.away[0] * c.th) / 2, y, c.v + (c.away[1] * c.th) / 2)
        if (hit.point.distanceTo(vertex) > 0.03) notched.push(`${c.u.toFixed(2)},${c.v.toFixed(2)} f${c.floor}: hit ${hit.point.distanceTo(vertex).toFixed(3)} m off the vertex`)
      }
      expect(checked).toBeGreaterThan(0)
      expect(notched).toEqual([])
    }, 120000)
  }
})
