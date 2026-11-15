import { describe, expect, it } from 'vitest'

import { fitOrientedBoxes } from '../src'

const SEGMENTS = 12

/** A cylinder drawn as a real one is: a ring of vertices at each end, the side between them, and a cap fan with vertices of its own on each ring. */
function cylinder(radius: number, length: number, base: readonly [number, number, number]): { points: number[]; triangles: number[] } {
  const points: number[] = []
  const triangles: number[] = []
  const ring = (y: number): number => {
    const first = points.length / 3
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2
      points.push(base[0] + radius * Math.cos(angle), base[1] + y, base[2] + radius * Math.sin(angle))
    }
    return first
  }
  const low = ring(0)
  const high = ring(length)
  for (let i = 0; i < SEGMENTS; i++) {
    const next = (i + 1) % SEGMENTS
    triangles.push(low + i, low + next, high + i, low + next, high + next, high + i)
  }
  for (const y of [0, length]) {
    const cap = ring(y)
    const centre = points.length / 3
    points.push(base[0], base[1] + y, base[2])
    for (let i = 0; i < SEGMENTS; i++) triangles.push(centre, cap + i, cap + ((i + 1) % SEGMENTS))
  }
  return { points, triangles }
}

const span = (boxes: ReturnType<typeof fitOrientedBoxes>): number => Math.max(...boxes.map((box) => Math.max(...box.half) * 2))

describe('fitOrientedBoxes with the triangles a part is drawn by', () => {
  it('holds a pole drawn by a ring at each end as its shaft, not as two plates', () => {
    const { points, triangles } = cylinder(0.11, 7.5, [0, 0, 0])
    expect(span(fitOrientedBoxes(points))).toBeLessThan(1)
    const boxes = fitOrientedBoxes(points, triangles)
    expect(boxes).toHaveLength(1)
    expect(span(boxes)).toBeCloseTo(7.5, 2)
  })

  it('fits each solid the triangles keep apart on its own: a shaft and a crossarm are two boxes, not one box around both', () => {
    const shaft = cylinder(0.11, 7.5, [0, 0, 0])
    const arm = cylinder(0.04, 1.6, [0, 0, 0])
    // the arm lies across the top of the shaft: (x, y, z) of the cylinder becomes (y - 0.8, 7 + x, z)
    const turned = arm.points.flatMap((_, index) => (index % 3 === 0 ? [arm.points[index + 1]! - 0.8, 7 + arm.points[index]!, arm.points[index + 2]!] : []))
    const points = [...shaft.points, ...turned]
    const triangles = [...shaft.triangles, ...arm.triangles.map((vertex) => vertex + shaft.points.length / 3)]
    const boxes = fitOrientedBoxes(points, triangles)
    expect(boxes).toHaveLength(2)
    expect(boxes.map((box) => Math.max(...box.half) * 2).sort((a, b) => a - b)[1]).toBeCloseTo(7.5, 2)
  })
})
