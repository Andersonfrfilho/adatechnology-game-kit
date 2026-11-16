import { describe, expect, it } from 'vitest'
import { addTriangle, colliderOf, soupOf } from '../src/collider-fit'

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const CUBE_FACES = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]] as const

/** An axis-aligned box (lo, hi) as 12 triangles. */
const boxTriangles = (lo: readonly number[], hi: readonly number[]): { positions: number[]; corners: [number, number, number][] } => {
  const positions: number[] = []
  for (let c = 0; c < 8; c++) positions.push(c & 1 ? hi[0]! : lo[0]!, c & 2 ? hi[1]! : lo[1]!, c & 4 ? hi[2]! : lo[2]!)
  const corners: [number, number, number][] = []
  for (const [a, b, c, d] of CUBE_FACES) corners.push([a, b, c], [a, c, d])
  return { positions, corners }
}

const soupOfBoxes = (boxes: readonly (readonly [readonly number[], readonly number[]])[]) => {
  const soup = soupOf()
  for (const [lo, hi] of boxes) {
    const { positions, corners } = boxTriangles(lo, hi)
    const source = {}
    for (const triangle of corners) addTriangle(soup, source, positions, triangle, IDENTITY)
  }
  return soup
}

describe('colliderOf: a box is kept only where the SDK fit holds the drawing in one box', () => {
  it('a solid block is a box', () => {
    const collider = colliderOf('block', 'k', soupOfBoxes([[[0, 0, 0], [1, 0.5, 2]]]))
    expect(collider?.mesh).toBeUndefined()
  })

  it('two bars at opposite corners touch all eight corners of their box but are mostly air: held by triangles', () => {
    const soup = soupOfBoxes([[[0, 0, 0], [0.05, 0.05, 0.05]], [[1.95, 1.95, 1.95], [2, 2, 2]], [[1.95, 0, 0], [2, 0.05, 0.05]], [[0, 1.95, 0], [0.05, 2, 0.05]], [[0, 0, 1.95], [0.05, 0.05, 2]], [[1.95, 1.95, 0], [2, 2, 0.05]], [[1.95, 0, 1.95], [2, 0.05, 2]], [[0, 1.95, 1.95], [0.05, 2, 2]]])
    expect(colliderOf('cage', 'k', soup)?.mesh).toBeDefined()
  })
})
