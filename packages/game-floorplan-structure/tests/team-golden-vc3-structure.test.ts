import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import goldenFile from './fixtures/team-golden/vc3-structure.json'
import detailFile from './fixtures/team-golden/vc3-structure-detail.json'
import { engine } from './support'
import { hashOf, hashRows, sdkStateOf, sdkTemplateOf, teamConstruction, teamLists, teamRoof, teamTank, text } from './team-vocabulary'
import type { TeamStructureLists } from './team-vocabulary'

/** Structure of the plans recorded from the Visor de casas 3D: 17 templates x seeds 1-25 x 3 states, one hash per list. */
type StructureEvent = {
  readonly template: string
  readonly seed: number
  readonly state: string
  readonly counts: { readonly [list: string]: number }
  readonly hashes: { readonly [list: string]: string }
  readonly utilities: { readonly [name: string]: string }
  readonly rows?: { readonly [name: string]: string[] }
}

const eventsOf = (file: unknown): StructureEvent[] => (file as GoldenRecord).events.map((event) => event.data as unknown as StructureEvent)
const allEvents = eventsOf(goldenFile)
const LISTS = ['pieces', 'supports', 'coarseParts', 'coarseJoints', 'enclosureParts', 'enclosureJoints'] as const
const SINGLES = ['levels', 'construction', 'roof', 'waterTank'] as const

function generate(event: StructureEvent) {
  return engine.generate(sdkTemplateOf.get(event.template) as string, { seed: event.seed, state: sdkStateOf.get(event.state), wallDetail: 'coarse' })
}

function singlesOf(result: any): Record<(typeof SINGLES)[number], unknown> {
  return {
    levels: [result.structure.levels, result.structure.elevation],
    construction: teamConstruction(result.construction),
    roof: teamRoof(result.roof),
    waterTank: teamTank(result.waterTank),
  }
}

function explain(event: StructureEvent, list: string, lists: TeamStructureLists): string {
  const detail = eventsOf(detailFile).find((x) => x.template === event.template && x.seed === event.seed && x.state === event.state)
  const got = (lists[list as keyof TeamStructureLists] as unknown[]).map(text)
  const want = detail?.rows?.[list] ?? []
  return `${list} (${got.length} vs ${event.counts[list]})\n  only team ${want.filter((line) => !got.includes(line)).slice(0, 3).join('\n            ')}\n  only sdk  ${got.filter((line) => !want.includes(line)).slice(0, 3).join('\n            ')}`
}

describe('structure against the Visor de casas 3D (VC3), coarse detail', () => {
  const comparable = [...new Set(allEvents.map((event) => event.template))].filter((template) => sdkTemplateOf.has(template))

  for (const template of comparable) {
    it(`${template}: pieces, supports and the coarse spec of 75 plans have the team's hash`, () => {
      const mismatches: string[] = []
      for (const event of allEvents.filter((x) => x.template === template)) {
        const result = generate(event)
        const lists = teamLists(result.structure)
        for (const list of LISTS) {
          if (hashRows(lists[list]) !== event.hashes[list]) mismatches.push(`${template}#${event.seed}/${event.state} ${explain(event, list, lists)}`)
        }
        const singles = singlesOf(result)
        for (const name of SINGLES) if (hashOf(singles[name]) !== event.utilities[name]) mismatches.push(`${template}#${event.seed}/${event.state} ${name}: ${text(singles[name]).slice(0, 300)}`)
      }
      expect(mismatches.slice(0, 3)).toEqual([])
    })
  }

  it('the templates only the team page has are exactly the rural ones', () => {
    const missing = [...new Set(allEvents.map((event) => event.template))].filter((template) => !sdkTemplateOf.has(template)).sort()
    expect(missing).toEqual(['barraca_camping', 'barraco', 'cabana_tronco', 'casa_madeira_americana', 'chale_madeira'])
  })
})
