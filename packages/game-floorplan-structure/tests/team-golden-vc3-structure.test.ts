import { afterEach, describe, expect, it } from 'vitest'

import { allEvents, chunksOf, explain, generate, hashOf, hashRows, LISTS, SINGLES, sdkTemplateOf, singlesOf, teamLists, text } from './vc3-golden-support'

// The tests are synchronous: without a turn of the event loop between them the worker never reads vitest's replies, and after 60 s of them
// in a row the run fails with "Timeout calling onTaskUpdate" even though every test passed.
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)))

describe('structure against the Visor de casas 3D (VC3), coarse detail', () => {
  const comparable = [...new Set(allEvents.map((event) => event.template))].filter((template) => sdkTemplateOf.has(template))

  for (const [template, from, to] of chunksOf(comparable)) {
    it(`${template}: pieces, supports and the coarse spec of seeds ${from}-${to} (x 3 states) have the team's hash`, () => {
      const mismatches: string[] = []
      for (const event of allEvents.filter((x) => x.template === template && x.seed >= from && x.seed <= to)) {
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
