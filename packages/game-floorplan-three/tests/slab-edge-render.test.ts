import { describe, expect, it } from 'vitest'

import { houseOf, planOf, THREE } from './helpers/houses'

type Rect = readonly [number, number, number, number]
type PlanRoom = { readonly floor: number; readonly type: string; readonly outbuilding?: unknown; readonly parts: readonly Rect[] }
type Plan = { readonly floors: readonly { readonly ceiling: number }[]; readonly rooms: readonly PlanRoom[] }

const SLAB_CONCRETE = '8f8e8a'
/** The render's depth is 1.5 cm: bare concrete is sunk at least that far inside the wall's outer face (0.075 m), under the band of render. */
const RENDERED_EDGE = 0.075 - 0.015 + 0.005
const OPEN_ROOMS = new Set(['terrace', 'balcony', 'porch', 'yard'])

/** The bare concrete of the slab's edge that faces out of the house: a side face of the finishes' concrete that stands out past the render's depth of the rooms' edges. */
function bareEdgeFaces(plan: Plan, group: THREE.Object3D): string[] {
  const ceiling = plan.floors[0]!.ceiling
  const rooms = plan.rooms.filter((r) => r.floor === 0 && !r.outbuilding && !OPEN_ROOMS.has(r.type)).flatMap((r) => r.parts)
  const inside = (x: number, z: number): boolean => rooms.some((r) => x >= r[0] - RENDERED_EDGE && x <= r[2] + RENDERED_EDGE && z >= r[1] - RENDERED_EDGE && z <= r[3] + RENDERED_EDGE)
  const found: string[] = []
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !/^t0\/plain/.test(mesh.name || mesh.parent?.name || '')) return
    for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (!p.visible) return
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), color = geometry.getAttribute('color'), index = geometry.getIndex()
    for (let k = 0; k < (index ? index.count : position.count); k += 3) {
      for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(position, index ? index.getX(k + j) : k + j).applyMatrix4(mesh.matrixWorld)
      const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
      const centre = v[0]!.clone().add(v[1]!).add(v[2]!).divideScalar(3)
      if (Math.abs(normal.y) > 0.1 || centre.y < ceiling + 0.03 || centre.y > ceiling + 0.18) continue
      const first = index ? index.getX(k) : k
      const hex = new THREE.Color(color.getX(first), color.getY(first), color.getZ(first)).getHexString()
      if (hex === SLAB_CONCRETE && !inside(centre.x, centre.z)) found.push(`${centre.x.toFixed(2)},${centre.z.toFixed(2)} n ${normal.x.toFixed(0)},${normal.z.toFixed(0)}`)
    }
  })
  return found
}

describe('the house slab edge is rendered like the walls at the plaster stage', () => {
  for (const seed of [1, 2, 5]) {
    it(`single_storey_a #${seed}: no bare concrete faces the outside above the wall tops (levels 5 and 7)`, () => {
      const plan = planOf('single_storey_a', seed) as unknown as Plan
      const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 5 })
      for (const level of [5, 7]) {
        house.setConstructionLevel?.(level)
        house.group.updateMatrixWorld(true)
        expect(bareEdgeFaces(plan, house.group), `level ${level}`).toEqual([])
      }
    })
  }
})
