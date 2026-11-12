import { describe, expect, it } from 'vitest'

import { houseOf, planOf, THREE } from './helpers/houses'

interface Outbuilding { readonly id: string; readonly aabb: readonly number[]; readonly thickness?: number; readonly ceiling?: number }

/** The plan box covered from above by faces looking up at a height between `from` and `to`, gathered per height, from every mesh shown. */
function upFaces(root: THREE.Object3D, box: readonly number[], from: number, to: number): { readonly y: number; readonly rect: readonly number[] }[] {
  const out: { y: number; rect: number[] }[] = []
  const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !shown(mesh)) return
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex(), count = index ? index.count : position.count
    for (let k = 0; k < count; k += 3) {
      for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(position, index ? index.getX(k + j) : k + j).applyMatrix4(mesh.matrixWorld)
      if (v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize().y < 0.99 || v[0]!.y < from || v[0]!.y > to) continue
      const rect = [Math.min(...v.map((p) => p.x)), Math.min(...v.map((p) => p.z)), Math.max(...v.map((p) => p.x)), Math.max(...v.map((p) => p.z))]
      if (rect[2]! < box[0]! || rect[0]! > box[2]! || rect[3]! < box[1]! || rect[1]! > box[3]!) continue
      out.push({ y: v[0]!.y, rect })
    }
  })
  return out
}

describe('the outbuilding\'s roof slab reaches the outer faces of its walls: no wall stands round or above it', () => {
  it('single_storey_a, from the finishes to the fittings (levels 5 to 7)', () => {
    const plan = planOf('single_storey_a', 1) as unknown as { outbuildings: Outbuilding[] }
    const e = plan.outbuildings[0]!
    const half = (e.thickness ?? 0.15) / 2
    const outer = [e.aabb[0]! - half, e.aabb[1]! - half, e.aabb[2]! + half, e.aabb[3]! + half]
    const top = (e.ceiling ?? 2.6) + 0.2
    const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 5 })
    for (const level of [5, 6, 7]) {
      house.setConstructionLevel?.(level)
      house.group.updateMatrixWorld(true)
      const faces = upFaces(house.group, outer, 1.5, top + 0.01)
      // the slab's top covers the whole outer box (sampled every 5 cm along each edge and across)
      const atTop = faces.filter((f) => Math.abs(f.y - top) < 0.003)
      const missing: string[] = []
      for (let x = outer[0]! + 0.01; x < outer[2]!; x += 0.05) for (let z = outer[1]! + 0.01; z < outer[3]!; z += 0.05) {
        if (!atTop.some((f) => x >= f.rect[0]! - 1e-4 && x <= f.rect[2]! + 1e-4 && z >= f.rect[1]! - 1e-4 && z <= f.rect[3]! + 1e-4)) missing.push(`${x.toFixed(2)},${z.toFixed(2)}`)
      }
      expect(missing.length, `level ${level}: uncovered points of the slab, e.g. ${missing.slice(0, 3).join(' ')}`).toBe(0)
      // nothing of the walls stands over the slab's edge or out of it at the wall tops' height
      const proud = faces.filter((f) => f.y > top + 0.003 && (f.rect[0]! < outer[0]! + 0.2 || f.rect[2]! > outer[2]! - 0.2 || f.rect[1]! < outer[1]! + 0.2 || f.rect[3]! > outer[3]! - 0.2))
      expect(proud.map((f) => f.y.toFixed(3)), `level ${level}`).toEqual([])
    }
  })
})

describe('the outbuilding has no attic: its runs go across inside its roof slab, its ceiling box in the slab', () => {
  it('single_storey_a', () => {
    const plan = planOf('single_storey_a', 1) as unknown as { outbuildings: (Outbuilding & { interior: number[][] })[] }
    const e = plan.outbuildings[0]!
    const ceiling = e.ceiling ?? 2.6, top = ceiling + 0.2, inside = e.interior[0]!
    const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 4 })
    house.setConstructionLevel?.(4)
    house.group.updateMatrixWorld(true)
    const inAir: string[] = []
    house.group.traverse((o) => {
      if (o.userData.part !== 'wall_conduit' || !Array.isArray(o.userData.points)) return
      const points = o.userData.points as number[][]
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i]!, b = points[i + 1]!
        const across = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) > 1e-3 && Math.abs(a[2]! - b[2]!) < 1e-3
        const over = [a, b].some((p) => p[0]! > inside[0]! + 0.05 && p[0]! < inside[2]! - 0.05 && p[1]! > inside[1]! + 0.05 && p[1]! < inside[3]! - 0.05)
        if (across && over && (a[2]! < ceiling + 0.02 || a[2]! > top - 0.02)) inAir.push(`${a.map((v) => v.toFixed(2))} → ${b.map((v) => v.toFixed(2))}`)
      }
    })
    expect(inAir).toEqual([])
    // the ceiling box: within the slab
    let box: THREE.Box3 | undefined
    house.group.traverse((o) => { if (o.userData.part === 'electrical_box') box = new THREE.Box3().setFromObject(o) })
    const over: number[] = []
    house.group.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (o.userData.part !== 'electrical_box' || !mesh.isMesh) return
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        if (p.x > inside[0]! && p.x < inside[2]! && p.z > inside[1]! && p.z < inside[3]! && p.y > top - 0.005) over.push(p.y)
      }
    })
    expect(box).toBeDefined()
    expect(over).toEqual([])
  })
})
