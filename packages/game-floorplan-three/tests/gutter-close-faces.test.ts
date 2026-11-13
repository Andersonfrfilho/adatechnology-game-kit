import { describe, expect, it } from 'vitest'

import { closeFaceOverlaps } from '../src/construction-stages/close-faces'
import { THREE, houseOf, planOf } from './helpers/houses'

type Gutters = { gutters: { y: number }[]; downpipes: { x: number; z: number; y1: number }[] }
type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel(level: number, options?: { roofLayer?: boolean; lotLayer?: boolean }): number }

const isGutterPiece = (mesh: THREE.Mesh): boolean => {
  return /^(roof|f0)\/(plain|metal)$/.test(mesh.name)
}

/** Gutters, downpipes, brackets, caps and sand boxes: no two faces, inside or outside, within 2.5 mm of one plane over an area (depth precision loses them at 30 m). */
describe('gutters and downpipes', () => {
  for (const seed of [1, 2, 3, 4, 6]) {
    it(`draws no two near-coplanar faces (single_storey_a #${seed})`, () => {
      const house = houseOf(planOf('single_storey_a', seed), {}, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as StagedHouse
      house.setConstructionLevel(8, { roofLayer: true, lotLayer: false })
      const gutters = (house as unknown as { gutters: Gutters }).gutters
      expect(gutters.gutters.length).toBeGreaterThan(0)
      const ys = gutters.gutters.map((g) => g.y)
      const boxes = [new THREE.Box3(new THREE.Vector3(-3, Math.min(...ys) - 0.2, -3), new THREE.Vector3(60, Math.max(...ys) + 0.2, 60))]
      for (const d of gutters.downpipes) boxes.push(new THREE.Box3(new THREE.Vector3(d.x - 0.5, 0, d.z - 0.5), new THREE.Vector3(d.x + 0.5, d.y1 + 0.2, d.z + 0.5)))
      const found = boxes.flatMap((within) => closeFaceOverlaps(THREE, house.group, { keep: isGutterPiece, within, gap: 0.0025, maxAngle: 0.05, minArea: 1e-4 }))
      expect(found.map((o) => `${o.a.name}/${o.b.name} ${o.area.toFixed(4)} m² at ${o.at.toArray().map((v) => v.toFixed(2))}`)).toEqual([])
      house.dispose()
    })
  }
})
