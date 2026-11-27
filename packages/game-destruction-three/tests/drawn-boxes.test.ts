import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { hollowBoxesOf } from '../src/drawn-boxes'

/** The vertices (x y z) of boxes as three.js draws them, each put (and turned) where it stands in the mesh. */
const pointsOf = (boxes: ReadonlyArray<{ size: [number, number, number]; at: [number, number, number]; turn?: [number, number, number] }>): number[] => {
  const out: number[] = []
  for (const box of boxes) {
    const geometry = new THREE.BoxGeometry(...box.size)
    if (box.turn) geometry.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...box.turn)))
    geometry.translate(...box.at)
    out.push(...(geometry.getAttribute('position').array as Float32Array))
  }
  return out
}

/** Whether the point is inside one of the boxes. */
const holds = (boxes: NonNullable<ReturnType<typeof hollowBoxesOf>>, point: [number, number, number]): boolean =>
  boxes.some((box) => {
    const local = new THREE.Vector3(point[0] - box.center[0]!, point[1] - box.center[1]!, point[2] - box.center[2]!)
    if (box.rotation) local.applyQuaternion(new THREE.Quaternion(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3]).invert())
    return Math.abs(local.x) <= box.half[0]! + 1e-4 && Math.abs(local.y) <= box.half[1]! + 1e-4 && Math.abs(local.z) <= box.half[2]! + 1e-4
  })

describe('the boxes a part is drawn with (hollowBoxesOf)', () => {
  it('boards round the air (a kennel: floor, top, back, two sides, a front with a doorway) are held one by one: the air inside and the doorway are in none', () => {
    const boxes = hollowBoxesOf(pointsOf([
      { size: [0.7, 0.03, 0.7], at: [0, 0.015, 0] },
      { size: [0.7, 0.03, 0.7], at: [0, 0.585, 0] },
      { size: [0.7, 0.54, 0.03], at: [0, 0.3, -0.335] },
      { size: [0.03, 0.54, 0.64], at: [-0.335, 0.3, 0] },
      { size: [0.03, 0.54, 0.64], at: [0.335, 0.3, 0] },
      { size: [0.17, 0.54, 0.03], at: [-0.265, 0.3, 0.335] },
      { size: [0.17, 0.54, 0.03], at: [0.265, 0.3, 0.335] },
      { size: [0.36, 0.14, 0.03], at: [0, 0.5, 0.335] },
    ]))
    expect(boxes).toHaveLength(8)
    expect(holds(boxes!, [0, 0.3, 0])).toBe(false)
    expect(holds(boxes!, [0, 0.2, 0.335])).toBe(false)
    expect(holds(boxes!, [0.335, 0.3, 0])).toBe(true)
  })

  it('a board with a doorway cut in it (two jambs and a lintel, about half of the box around them) is its three boxes: the doorway is not closed', () => {
    const boxes = hollowBoxesOf(pointsOf([
      { size: [0.125, 0.57, 0.004], at: [-0.2425, 0.285, 0] },
      { size: [0.125, 0.57, 0.004], at: [0.2425, 0.285, 0] },
      { size: [0.36, 0.11, 0.004], at: [0, 0.515, 0] },
    ]))
    expect(boxes).toHaveLength(3)
    expect(holds(boxes!, [0, 0.2, 0])).toBe(false)
  })

  it('the two slabs of a roof, turned in the mesh, are two turned boxes: the air under the ridge is in neither', () => {
    const boxes = hollowBoxesOf(pointsOf([
      { size: [0.5, 0.03, 0.84], at: [-0.2, 0.1, 0], turn: [0, 0, 0.5] },
      { size: [0.5, 0.03, 0.84], at: [0.2, 0.1, 0], turn: [0, 0, -0.5] },
    ]))
    expect(boxes).toHaveLength(2)
    expect(boxes!.every((box) => box.rotation !== undefined)).toBe(true)
    expect(boxes!.map((box) => [...box.half].sort((a, b) => a - b).map((h) => +h.toFixed(3)))).toEqual([[0.015, 0.25, 0.42], [0.015, 0.25, 0.42]])
    expect(holds(boxes!, [0, 0.02, 0])).toBe(false)
    expect(holds(boxes!, [-0.2, 0.1, 0])).toBe(true)
    expect(holds(boxes!, [0.2, 0.1, 0.4])).toBe(true)
  })

  it('one slab alone turned in its mesh is the slab, not the box around it', () => {
    const boxes = hollowBoxesOf(pointsOf([{ size: [0.5, 0.03, 0.84], at: [0, 0, 0], turn: [0, 0, 0.5] }]))
    expect(boxes).toHaveLength(1)
    expect(holds(boxes!, [0.2, -0.1, 0])).toBe(false)
    // its far ends, along the way it is turned
    const end = new THREE.Vector3(0.24, 0, 0.4).applyEuler(new THREE.Euler(0, 0, 0.5))
    expect(holds(boxes!, [end.x, end.y, end.z])).toBe(true)
    expect(holds(boxes!, [-end.x, -end.y, -end.z])).toBe(true)
    for (const turn of [[0.3, 0.7, -0.4], [1.2, 0, 0], [0, 2.1, 0.2], [-0.9, 0.4, 1.3]] as Array<[number, number, number]>) {
      const turned = hollowBoxesOf(pointsOf([{ size: [0.5, 0.03, 0.84], at: [0.1, 0.2, 0.3], turn }]))
      expect(turned).toHaveLength(1)
      for (const corner of [[0.24, 0.014, 0.41], [-0.24, -0.014, 0.41], [0.24, -0.014, -0.41]]) {
        const p = new THREE.Vector3(...(corner as [number, number, number])).applyEuler(new THREE.Euler(...turn))
        expect(holds(turned!, [p.x + 0.1, p.y + 0.2, p.z + 0.3]), `turned ${turn}`).toBe(true)
        const out = new THREE.Vector3(corner[0]! * 1.2, corner[1]! * 3, corner[2]! * 1.2).applyEuler(new THREE.Euler(...turn))
        expect(holds(turned!, [out.x + 0.1, out.y + 0.2, out.z + 0.3]), `outside, turned ${turn}`).toBe(false)
      }
    }
  })

  it('what fills its box stays one box: a box alone, and the planks of a top with the gaps between them', () => {
    expect(hollowBoxesOf(pointsOf([{ size: [1, 0.04, 0.6], at: [0, 0, 0] }]))).toBeNull()
    expect(hollowBoxesOf(pointsOf([-0.42, -0.21, 0, 0.21, 0.42].map((z) => ({ size: [1, 0.04, 0.19] as [number, number, number], at: [0, 0, z] as [number, number, number] }))))).toBeNull()
  })

  it('what is not drawn as boxes is not held this way (a cylinder)', () => {
    expect(hollowBoxesOf([...(new THREE.CylinderGeometry(0.1, 0.1, 1, 12).getAttribute('position').array as Float32Array)])).toBeNull()
  })
})
