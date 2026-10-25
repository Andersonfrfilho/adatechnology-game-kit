import { describe, expect, it } from 'vitest'

import { TOWER_TEMPLATES, engine } from './support'
import type { Structure } from '../src'

const WET = ['kitchen_cabinet', 'washbasin', 'shower', 'toilet', 'laundry_tub', 'washing_machine']

/** Follows what every part rests on until the ground. */
function ungrounded(structure: Structure): string[] {
  const resting = new Map<string, string[]>()
  for (const support of structure.supports) resting.set(support.part, [...(resting.get(support.part) ?? []), support.on])
  const reaches = (id: string, seen: Set<string>): boolean => {
    if (id === 'ground') return true
    if (seen.has(id)) return false
    seen.add(id)
    return (resting.get(id) ?? []).some((on) => reaches(on, seen))
  }
  return structure.parts.filter((part) => !reaches(part.id, new Set())).map((part) => part.id)
}

/** The plans of the skyscraper templates go through the structure and the installations like any other plan (the loops over every template leave them out: see support.ts). */
describe('skyscraper plans', () => {
  for (const template of TOWER_TEMPLATES) {
    it(`${template}: 20 storeys have a structure on the ground, a roof, one level a storey, installations and a plan the validator accepts`, () => {
      const plan: any = engine.generate(template, { seed: 3, floors: 20, state: 'normal' })
      expect(plan.floors).toHaveLength(20)
      expect(plan.structure.parts.length).toBeGreaterThan(200)
      expect(plan.structure.levels).toHaveLength(20)
      expect(plan.structure.framed).toBe(true)
      expect(plan.roof.panes.length).toBeGreaterThan(0)
      expect(ungrounded(plan.structure)).toEqual([])
      const fixtures = plan.items.filter((m: any) => WET.includes(m.category) && !m.decor).length
      expect(fixtures).toBeGreaterThan(0)
      expect(plan.utilities.plumbing.points.length).toBe(fixtures)
      expect(engine.validate(plan)).toEqual([])
    }, 300000)
  }
})
