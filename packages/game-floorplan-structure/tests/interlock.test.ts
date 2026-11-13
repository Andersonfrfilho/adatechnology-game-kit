import { describe, expect, it } from 'vitest'

import { toDestructibleSpec } from '../src'
import type { StructuredResult } from '../src'
import { engine } from './support'

/** The units of a house in `units` detail whose box covers the plan point (u, v), by course (world y of their centre). */
function unitsAt(template: string, point: readonly [number, number]): Map<number, string[]> {
  const result = engine.generate(template, { seed: 1, state: 'normal' }) as StructuredResult
  const spec = toDestructibleSpec(result.structure, { wallDetail: 'units', slabPanels: false })
  const out = new Map<number, string[]>()
  for (const part of spec.parts.filter((p) => /_u\d+_\d+$/.test(p.id) && p.shape.kind === 'box')) {
    const size = (part.shape as { size: readonly number[] }).size
    const [x, y, z] = part.position
    if (Math.abs(point[0] - x) >= size[0]! / 2 || Math.abs(point[1] - z) >= size[2]! / 2) continue
    const course = Math.round(y * 100) / 100
    out.set(course, [...(out.get(course) ?? []), part.id.replace(/_pier_\d+/, '').replace(/_u\d+_\d+$/, '')])
  }
  return out
}

describe('the courses of two walls interlock where they meet (amarração direta)', () => {
  for (const template of ['single_storey_structural', 'single_storey_a']) {
    it(`${template}: one unit per course in the front-left corner, the front and the left wall taking turns`, () => {
      const courses = [...unitsAt(template, [0, 0]).entries()].sort((a, b) => a[0] - b[0])
      expect(courses.length).toBeGreaterThan(8)
      for (const [, walls] of courses) expect(walls.length).toBe(1)
      // the wall along u (the front) on the even courses, the wall along v (the left) on the odd ones
      courses.forEach(([y, walls], k) => expect(walls[0], `course ${k} at ${y} m`).toBe(k % 2 === 0 ? 'wall_0_0' : 'wall_0_7'))
    })
  }
})
