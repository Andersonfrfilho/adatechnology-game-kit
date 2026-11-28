/**
 * Deterministic damage. `fixtures/golden.json` holds digests (object count, a hash of every transform, vertex array and material, and
 * the particle/part counts) produced by the original, pre-port SDK for the same vehicles, zones, bands and interactions. Matching them
 * proves the port reproduces the original geometry and damage formulas.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { digest, type Digest } from './helpers/digest'
import { OPERATIONS, registerCaseScenario } from './helpers/cases'
import { makeKit } from './helpers/kit'
import { SAMPLE_KEYS } from './helpers/sample-fleet'
import golden from './fixtures/golden.json'
import { legacyZoneId } from '../src'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const kit = makeKit()
registerCaseScenario(kit)
const G = golden as unknown as Record<string, { health?: Record<string, number>; flags?: Record<string, boolean>; sc?: string }>

/* The vehicles whose flush parts moved 1 to 3 mm apart (CLAUDE.md §13: the hood bay, the battery label, the grille, the lamp bezels, the emblem and the
   door trims no longer share a plane): they keep the team's object and particle counts, only the vertex hash differs. `exact-golden.test.ts` still
   holds every bit of them. */
const Z_FIGHTING_FIXES: ReadonlySet<string> = new Set(['proto', 'truck'])
function expectTeam(actual: Digest, name: string, key: string): void {
  const want = G[name] as unknown as Digest
  if (Z_FIGHTING_FIXES.has(key)) expect({ objects: actual.objects, counts: actual.counts }, name).toEqual({ objects: want.objects, counts: want.counts })
  else expect(actual, name).toEqual(want)
}

describe('the same zone and band always give the same vertices', () => {
  it('builds identical vehicles twice (same key, state and zone state)', () => {
    const state = { health: { bumper_front: 13, hood: 38, windshield: 0 }, flags: {} }
    const a = digest(kit.build('proto', 'intact', state))
    const b = digest(kit.build('proto', 'intact', state))
    expect(b).toEqual(a)
  })

  it('does not depend on the order of other kits or builds', () => {
    const first = digest(kit.build('proto', 'intact', { health: { door_front_left: 13 }, flags: {} }))
    makeKit().build('truck', 'damaged')
    const second = digest(makeKit().build('proto', 'intact', { health: { door_front_left: 13 }, flags: {} }))
    expect(second).toEqual(first)
  })

  it('changes the output when the band changes, and only when it changes', () => {
    const at = (health: number) => digest(kit.build('proto', 'intact', { health: { hood: health }, flags: {} })).hash
    expect(at(100)).not.toBe(at(38))
    expect(at(95)).not.toBe(at(100)) // fine scratches below full health
    expect(at(38)).toBe(at(26))
    expect(at(51)).toBe(at(75))
    expect(at(38)).not.toBe(at(13))
  })
})

describe('golden: states', () => {
  const cases = Object.keys(G).filter((k) => / (intact|damaged|modified)$/.test(k))
  it.each(cases)('%s', (name) => {
    const [key, state] = name.split(' ')
    expectTeam(digest(kit.build(key, state as 'intact')), name, key)
  })
})

describe('golden: one zone in one band', () => {
  for (const key of SAMPLE_KEYS) {
    const cases = Object.keys(G).filter((k) => k.startsWith(key + ' ') && k.includes('@'))
    it.each(cases)('%s', (name) => {
      const [zone, health] = name.slice(key.length + 1).split('@')
      expectTeam(digest(kit.build(key, 'intact', { health: { [zone]: Number(health) }, flags: {} })), name, key)
    })
  }
})

describe('golden: interactions', () => {
  it.each(Object.keys(OPERATIONS))('%s', (name) => {
    const c = kit.build('proto', 'intact')
    OPERATIONS[name](kit, c)
    expectTeam(digest(c), 'op ' + name, 'proto')
  })
})

describe('golden: scenario', () => {
  it.each(['proto', 'plane'])('scenario sc1 on %s', (key) => {
    const c = kit.build(key, 'intact')
    const result = kit.zoneScenario(c, 'sc1')
    kit.applyZones(c, result)
    expectTeam(digest(c), 'scenario sc1 ' + key, key)
    const legacy: Record<string, number> = {}
    for (const z of c.zones) if (z.id in result.health) legacy[legacyZoneId(z)] = result.health[z.id]
    expect(Object.fromEntries(Object.entries(legacy).sort())).toEqual(G['__scenario sc1 ' + key].health)
    expect(result.flags).toEqual(G['__scenario sc1 ' + key].flags)
    expect(result.scenario).toBe(G['__scenario sc1 ' + key].sc)
  })
})
