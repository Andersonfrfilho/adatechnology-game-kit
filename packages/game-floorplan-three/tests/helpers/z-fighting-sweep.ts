import { writeFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { describeConflict, houseConflicts, houseTemplates, pairKey, selectedTemplates } from './z-fighting-houses'
import type { HouseConflict } from './z-fighting-houses'

const PER_PAIR_CAP = 3

/** The sweep of `z-fighting-houses.test.ts` for the given seeds; `ZFIGHT_SEEDS` overrides them. Each file of the sweep is one seed so the files run in parallel workers. */
export function describeHouseSweep(defaultSeeds: readonly number[], options: { readonly hasFramelessCheck: boolean }): void {
  const seeds = process.env.ZFIGHT_SEEDS ? process.env.ZFIGHT_SEEDS.split(',').map(Number) : [...defaultSeeds]
  const templates = selectedTemplates(process.env.ZFIGHT_TEMPLATES)
  const found: HouseConflict[] = []

  describe(`z-fighting of the houses, seeds ${seeds.join(', ')}: no two drawn faces closer than the depth buffer tells apart, at any construction level`, () => {
    it('walks every template the engine lists (towers excepted, as in the plan tests)', () => {
      expect(houseTemplates().length).toBeGreaterThan(10)
      expect(templates.every((template) => houseTemplates().includes(template)), templates.join(', ')).toBe(true)
    })

    for (const template of templates) {
      it(`${template} is built at every level`, () => {
        for (const seed of seeds) {
          const result = houseConflicts(template, seed, PER_PAIR_CAP)
          expect(result.skipped, `${template} #${seed} could not be built with construction stages`).toBeUndefined()
          found.push(...result.conflicts)
        }
      }, 1_800_000)
    }

    // The frameless (blindex) window draws a thicker pane across the whole opening and no frame: checked at the levels that show windows.
    if (options.hasFramelessCheck) {
      it('the frameless windows draw no conflict either (seed 1, levels 6 and 8)', () => {
        for (const template of templates) found.push(...houseConflicts(template, 1, PER_PAIR_CAP, { windowFrame: 'frameless', levels: [6, 8] }).conflicts)
      }, 1_800_000)
    }

    it('finds no conflict', () => {
      const groups = new Map<string, { hits: number; first: HouseConflict }>()
      for (const conflict of found) {
        const id = `${conflict.template} | ${pairKey(conflict.hit)}`
        const group = groups.get(id) ?? { hits: 0, first: conflict }
        group.hits++
        groups.set(id, group)
      }
      const cases = [...groups].map(([id, g]) => ({ id, hits: g.hits, detail: `  ${describeConflict(g.first)}` })).sort((a, b) => a.id.localeCompare(b.id))
      if (process.env.ZFIGHT_DUMP) {
        writeFileSync(process.env.ZFIGHT_DUMP, found.map(describeConflict).join('\n'))
        writeFileSync(`${process.env.ZFIGHT_DUMP}.json`, `${JSON.stringify(Object.fromEntries(cases.map((c) => [c.id, c.hits])), null, 2)}\n`)
      }
      const problems = cases.map((c) => `${c.id}: ${c.hits}\n${c.detail}`)
      expect(problems, problems.join('\n')).toEqual([])
    })
  })
}
