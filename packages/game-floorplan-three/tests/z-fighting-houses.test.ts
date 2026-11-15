import { writeFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ZFIGHT_SEEDS, describeConflict, houseConflicts, houseTemplates, pairKey, selectedTemplates } from './helpers/z-fighting-houses'
import type { HouseConflict } from './helpers/z-fighting-houses'

/**
 * Every template the engine lists, at every construction level 0 to 8 and the seeds of the plan tests, drawn whole (structure, roof, gutters, downpipes,
 * installations, interactables, terrain, spoil mounds, trenches, pits and wall chases) and walked through the near-coplanar detector of `game-shapes`
 * (depth-buffer precision of the game camera at 30 m, about 1.07 mm). Every conflict is listed, by template and pair of parts, with where it is.
 * The houses draw none: any conflict fails, whatever pair it is.
 *   ZFIGHT_TEMPLATES=a,b   only these templates (the pre-commit's run, `tools/z-fighting/houses.mjs`)
 *   ZFIGHT_SEEDS=1         only these seeds (the same)
 *   ZFIGHT_DUMP=<file>     writes every conflict found, one line each, and the count of each pair (`<file>.json`)
 */
const PER_PAIR_CAP = 3
const seeds = process.env.ZFIGHT_SEEDS ? process.env.ZFIGHT_SEEDS.split(',').map(Number) : [...ZFIGHT_SEEDS]
const templates = selectedTemplates(process.env.ZFIGHT_TEMPLATES)
const found: HouseConflict[] = []

describe('z-fighting of the houses: no two drawn faces closer than the depth buffer tells apart, at any construction level', () => {
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
