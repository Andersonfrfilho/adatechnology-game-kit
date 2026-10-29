import { afterEach, describe, expect, it } from 'vitest'

import { allEvents, chunksOf, generate, hashOf, INSTALLATIONS, itemIds, sdkTemplateOf, text } from './vc3-golden-support'
import { teamUtilities } from './team-utilities'

// The tests are synchronous: without a turn of the event loop between them the worker never reads vitest's replies, and after 60 s of them
// in a row the run fails with "Timeout calling onTaskUpdate" even though every test passed.
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)))

describe('installations against the Visor de casas 3D (VC3)', () => {
  const comparable = [...new Set(allEvents.map((event) => event.template))].filter((template) => sdkTemplateOf.has(template))

  for (const [template, from, to] of chunksOf(comparable)) {
    it(`${template}: gas, electricity, solar, plumbing and outbuildings of seeds ${from}-${to} (x 3 states) have the team's hash`, () => {
      const mismatches: string[] = []
      for (const event of allEvents.filter((x) => x.template === template && x.seed >= from && x.seed <= to)) {
        const key = `${event.template}#${event.seed}/${event.state}`
        const result = generate(event)
        const team = teamUtilities(result, itemIds.get(key) as string[])
        for (const name of INSTALLATIONS) if (hashOf(team[name]) !== event.utilities[name]) mismatches.push(`${key} ${name}: ${text(team[name]).slice(0, 240)}`)
      }
      expect(mismatches.slice(0, 3)).toEqual([])
    })
  }

  it('every recorded plan has its item ids', () => {
    expect(itemIds.size).toBe(allEvents.filter((event) => sdkTemplateOf.has(event.template)).length)
  })
})
