import { describe, expect, it } from 'vitest'

import { houseOf, planOf, TEMPLATES, THREE } from './helpers/houses'

/** Vertices per box of a `BoxBatch`: six faces of four corners. */
const BOX_VERTICES = 24
/** Widest gap allowed between a unit and the pillar face it butts, metres. */
const TOLERANCE = 0.001

/** The laid bricks and blocks of a house, one world box per unit (the mortar behind them stays a little back from the pillars on purpose). */
function unitBoxes(groups: Record<string, THREE.Object3D>): THREE.Box3[] {
  const boxes: THREE.Box3[] = []
  groups['stage:3:masonry']?.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !/^masonry:(brick|block)/.test(mesh.name)) return
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i + BOX_VERTICES <= position.count; i += BOX_VERTICES) {
      const box = new THREE.Box3()
      for (let k = i; k < i + BOX_VERTICES; k++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, k).applyMatrix4(mesh.matrixWorld))
      boxes.push(box)
    }
  })
  return boxes
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.min(a1, b1) - Math.max(a0, b0)

describe('masonry butts every pillar face: no gap, no unit inside the pillar (level 3, every plan)', () => {
  for (const template of Object.values(TEMPLATES)) {
    it(template, () => {
      const { house } = houseOf(planOf(template, 1) as unknown as Parameters<typeof houseOf>[0], {}, { quality: 'game', constructionStages: true, constructionLevel: 3 })
      house.setConstructionLevel?.(3)
      house.group.updateMatrixWorld(true)
      const groups = house.groups as Record<string, THREE.Object3D>
      const units = unitBoxes(groups)
      const pillars: { id: string; box: THREE.Box3 }[] = []
      groups['stage:2:frame']?.children.forEach((c) => {
        const id = String(c.userData.structurePartId ?? '')
        if (/column/.test(id)) pillars.push({ id, box: new THREE.Box3().setFromObject(c) })
      })
      expect(pillars.length).toBeGreaterThan(0)
      expect(units.length).toBeGreaterThan(0)
      const gaps: string[] = [], inside: string[] = []
      for (const { id, box } of pillars) {
        const core = box.clone().expandByScalar(-0.002)
        if (units.some((u) => u.intersectsBox(core))) inside.push(id)
        for (const [axis, across] of [['x', 'z'], ['z', 'x']] as const) {
          for (const side of [-1, 1]) {
            const face = side < 0 ? box.min[axis] : box.max[axis]
            // the units lying against this face: across the pillar's width (more than a centimetre of it) and at its heights, on its side within 6 cm
            const distances = units
              .filter((u) => overlap(u.min[across], u.max[across], box.min[across], box.max[across]) > 0.01 && overlap(u.min.y, u.max.y, box.min.y, box.max.y) > 0.01)
              .map((u) => (side < 0 ? face - u.max[axis] : u.min[axis] - face))
              .filter((d) => d > -TOLERANCE && d < 0.06)
            if (!distances.length) continue
            const gap = Math.min(...distances)
            if (gap > TOLERANCE) gaps.push(`${id} ${axis}${side < 0 ? '-' : '+'} ${(gap * 1000).toFixed(1)} mm`)
          }
        }
      }
      expect(gaps).toEqual([])
      expect(inside).toEqual([])
    })
  }
})

describe('no pillar of the frame comes down in a doorway (level 2, every plan)', () => {
  for (const template of [...Object.values(TEMPLATES), 'high_end_contemporary']) {
    it(template, () => {
      const { house } = houseOf(planOf(template, 1) as unknown as Parameters<typeof houseOf>[0], {}, { quality: 'game', constructionStages: true, constructionLevel: 2 })
      house.setConstructionLevel?.(2)
      house.group.updateMatrixWorld(true)
      const groups = house.groups as Record<string, THREE.Object3D>
      const structure = (house as unknown as { structure: { parts: readonly { id: string; aabb: readonly number[]; y0: number; floor?: number }[] } }).structure
      // the wall over each door, from its head up: the doorway is under it
      const headers = structure.parts.filter((p) => /^wall_\d+_over_/.test(p.id))
      const blocked: string[] = []
      groups['stage:2:frame']?.children.forEach((c) => {
        const id = String(c.userData.structurePartId ?? '')
        if (!/column|pillar/.test(id)) return
        const box = new THREE.Box3().setFromObject(c)
        for (const h of headers) {
          const overlap = overlapArea([box.min.x, box.min.z, box.max.x, box.max.z], h.aabb)
          if (overlap > 1e-4 && box.min.y < h.y0 - 0.5 && box.max.y > h.y0 - 1) blocked.push(`${id} under ${h.id}: ${(overlap * 1e4).toFixed(0)} cm² of the doorway`)
        }
      })
      expect(blocked).toEqual([])
    })
  }
})

function overlapArea(a: readonly number[], b: readonly number[]): number {
  return Math.max(0, Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)) * Math.max(0, Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!))
}
