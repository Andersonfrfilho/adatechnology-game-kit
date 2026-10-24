import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import { recordCatalogue, recordWeapon } from './support/weapon-scenario'
import type { WeaponRecord } from './support/weapon-scenario'

// Regression of the rule "as ported": every weapon of the catalogue runs one seeded scenario (draw, safety, each fire mode, empty, the reloads it
// supports, a forced jam and its clearing) and the event sequence with the rounds, ammo and heat of each step is compared with the recorded one.
// A change of the rule that is meant: `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-weapons test`, then read the diff of the fixture.
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/rule-goldens/weapon-scenarios.json')

/** One weapon and one step per line: a rule change shows in the diff as the steps it touched. */
const serialize = (weapons: readonly WeaponRecord[]): string =>
  `{"weapons":[\n${weapons.map((entry) => `{"id":${JSON.stringify(entry.id)},"steps":[\n${entry.steps.map((step) => JSON.stringify(step)).join(',\n')}\n]}`).join(',\n')}\n]}\n`

const current = recordCatalogue()

if (process.env.UPDATE_GOLDEN === '1' || !existsSync(FIXTURE)) {
  mkdirSync(dirname(FIXTURE), { recursive: true })
  writeFileSync(FIXTURE, serialize(current))
}

const recorded = (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { weapons: WeaponRecord[] }).weapons

describe('rule goldens: one seeded scenario per weapon', () => {
  it('covers every weapon of the catalogue and nothing else', () => {
    expect(recorded.map((entry) => entry.id)).toEqual([...createArsenal().weapons.keys()])
    expect(recorded.length).toBeGreaterThanOrEqual(121)
  })

  it('records every kind of step the rule has: modes, empty, each reload kind, a forced jam and its clearing', () => {
    const steps = new Set(recorded.flatMap((entry) => entry.steps.map((step) => step.step.split(':')[0])))
    for (const step of ['draw', 'safety', 'fire', 'use', 'empty', 'reload', 'fault', 'clear']) expect(steps.has(step), step).toBe(true)
    const events = recorded.flatMap((entry) => entry.steps.map((step) => step.events)).join(' ')
    for (const kind of ['tactical', 'empty', 'one_by_one']) expect(events, kind).toContain(`reload:start:${kind}`)
    expect(events).toMatch(/clear:\w+:end/)
    expect(events).toContain('shot:burst')
    expect(events).toContain('shot:volley')
  })

  for (const entry of recorded) {
    it(`${entry.id} runs its scenario as recorded`, () => {
      const arsenal = createArsenal({ rules: { faults: false } })
      const jammy = createArsenal({ rules: { faults: true, faultChance: () => 1 } })
      const def = arsenal.weapons.get(entry.id)
      if (!def) throw new Error(`no weapon ${entry.id}`)
      expect(recordWeapon(def, arsenal, jammy)).toEqual(entry)
    })
  }

  it('is the same on a second run (no state shared between weapons)', () => {
    expect(recordCatalogue()).toEqual(current)
  })
})
