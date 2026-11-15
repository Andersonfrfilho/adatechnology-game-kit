import { readFileSync } from 'node:fs'

import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { fakeRoom } from './helpers/area-room'

// The six scenarios of the team's house area (sala-de-testes/area-casas), run on the team's page (headless Chrome, its destruction world, its DADOS specs) and recorded by
// tools/golden/captures/house-area.js: per scenario, how many checks it has and whether each held, then every event the world emitted. Here the same ids run on the specimens of
// this area, in the destruction world of the kit. The world is not the team's, so the golden binds what the scenarios mean, not the count of damage ticks: same ids, same number of
// checks, every check holds, and the events that carry the meaning (fracture, collapse, hole, leak, explode) appear wherever they appeared on the page.
const golden = JSON.parse(readFileSync(new URL('./fixtures/team-golden/vc3-house-area.json', import.meta.url), 'utf8')) as GoldenRecord
const MEANING = ['fracture', 'collapse', 'hole', 'leak', 'explode']
/**
 * Events the page saw that its world made up. The P13 of the kitchen goes off with 120 kJ (0.144 kg of TNT at the arsenal's 0.24 kg / 200 kJ), and on the page it brought the whole
 * house down: both roofs (54 t each), the ceiling slab and every wall. The whole energy of the burst lifts one roof 120 000 / (53 969 x 9.81) = 23 cm, and a wall takes only the
 * impulse the wave gives it: 254 Pa s reflected at 0.5 m and 134 at 1 m (Kinney and Graham), which moves 13 cm of brick (247 kg/m2) at 1.0 and 0.5 m/s, 130 and 36 J per m2, a
 * crack and not a fall. The kit's world (P-I, `waveWork`) damages the walls near it and brings nothing down, so the page's collapses are not asked for.
 */
const NOT_PHYSICAL: Readonly<Record<string, readonly string[]>> = { house_gas_explodes: ['collapse'] }

type Recorded = { id: string; passed: number; failed: number; checks: boolean[]; events: number }
const recorded = golden.events.filter((event) => event.type === 'scenario').map((event) => event.data as unknown as Recorded)
const meaningOf = (id: string): string[] => [...new Set(golden.events.filter((event) => event.type === 'world' && (event.data as { scenario?: string }).scenario === id).map((event) => (event.data as { event: { type: string } }).event.type))].filter((type) => MEANING.includes(type)).sort()

describe('team golden: the house area scenarios', () => {
  it('has the six scenarios of the page', () => {
    expect(recorded.map((entry) => entry.id)).toEqual(['house_one_pillar', 'house_two_pillars', 'house_partition', 'house_window_glass', 'house_tank_leak', 'house_gas_explodes'])
    expect(recorded.every((entry) => entry.failed === 0 && entry.passed === 1 && entry.checks.every(Boolean))).toBe(true)
  })

  for (const entry of recorded) {
    it(`${entry.id}: same checks, all held, and the same meaningful events`, async () => {
      const { module, room, step, world } = fakeRoom({ locale: 'en' })
      const scenario = module.scenarios!('en').find((s) => s.id === entry.id)!
      expect(scenario).toBeTruthy()
      const seen = new Set<string>()
      world.on('*', (event) => seen.add(event.type))
      const checks: boolean[] = []
      await scenario.run({ room, step, expect: (ok) => checks.push(ok) })
      expect(checks).toEqual(entry.checks)
      for (const type of meaningOf(entry.id).filter((type) => !NOT_PHYSICAL[entry.id]?.includes(type))) expect(seen.has(type), `${entry.id}: the page saw "${type}"`).toBe(true)
    })
  }
})
