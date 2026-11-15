import { describe, expect, it } from 'vitest'

import { houseOf, planOf, THREE } from './helpers/houses'

interface Opening { readonly floor: number; readonly axis: 'u' | 'v'; readonly pos: number; readonly at: number; readonly width: number }
type Rect = readonly [number, number, number, number]

/** How near a plane a face counts as on it, metres, and how much two faces may share before they fight for the same pixels, square metres. */
const ON_PLANE = 0.0015
const SHARED_AREA = 1e-4

/**
 * The faces lying on a plane x = `at` (or z = `at`) facing `sign`, near the opening: each as its rectangle in the plane (a box's face is two triangles with one
 * rectangle), from every mesh shown, batched or not.
 */
function facesOn(root: THREE.Object3D, axis: 'x' | 'z', at: number, sign: number, near: Rect): Map<string, Rect> {
  const faces = new Map<string, Rect>()
  const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !shown(mesh)) return
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex(), count = index ? index.count : position.count
    for (let k = 0; k < count; k += 3) {
      for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(position, index ? index.getX(k + j) : k + j).applyMatrix4(mesh.matrixWorld)
      const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
      if (normal[axis] * sign < 0.999 || v.some((p) => Math.abs(p[axis] - at) > ON_PLANE)) continue
      const other = axis === 'x' ? 'z' : 'x'
      const rect: Rect = [Math.min(...v.map((p) => p[other])), Math.min(...v.map((p) => p.y)), Math.max(...v.map((p) => p[other])), Math.max(...v.map((p) => p.y))]
      if (rect[2] < near[0] || rect[0] > near[2] || rect[3] < near[1] || rect[1] > near[3]) continue
      faces.set(`${mesh.uuid}:${rect.map((x) => x.toFixed(4)).join(',')}`, rect)
    }
  })
  return faces
}

const overlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))

describe('no two faces fight on the jambs of a door or a window, at any construction level', () => {
  for (const template of ['single_storey_a', 'townhouse', 'mid_modern_single_storey']) {
    it(template, () => {
      const plan = planOf(template, 1) as unknown as { doors: Opening[]; windows: Opening[]; floors: { y0: number }[] }
      const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
      const fights: string[] = []
      for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
        house.setConstructionLevel?.(level)
        house.group.updateMatrixWorld(true)
        for (const o of [...plan.doors, ...plan.windows]) {
          const y0 = plan.floors[o.floor]?.y0 ?? 0
          // the jamb planes face into the opening; the opening's plan axis is the wall's
          for (const [edge, sign] of [[o.at - o.width / 2, 1], [o.at + o.width / 2, -1]] as const) {
            const axis = o.axis === 'u' ? 'x' : 'z'
            const faces = [...facesOn(house.group, axis, edge, sign, [o.pos - 0.3, y0 - 0.1, o.pos + 0.3, y0 + 3])]
            for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
              const area = overlap(faces[i]![1], faces[j]![1])
              if (area > SHARED_AREA) fights.push(`level ${level}: jamb at ${edge.toFixed(2)} of the opening at ${o.at.toFixed(2)},${o.pos.toFixed(2)}: ${area.toFixed(4)} m²`)
            }
          }
        }
      }
      expect([...new Set(fights)]).toEqual([])
    })
  }
})
