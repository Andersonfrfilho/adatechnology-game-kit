import { describe, expect, it } from 'vitest'

import { TEAM_GAME_CALIBER_KEYS, createCharacters } from '../src'
import golden from './fixtures/team-golden/game-penetration.json'
import { createGameZombie, round4 } from './helpers/game'

// Recorded by tools/characters-catalog (vm, the game's own `shootRay` and `zDamage` against lines of 5 bodies, seed 1, bodies die in place).
// The SDK side is `penetrateLine` with the `team-game` model; each body is created with the health it had before the shot.
type Body = { line: string; caliber: string; body: number; type: string; region: string; distance: number; reached: boolean; damage: number; health: number; healthBefore: number; died: boolean }
type Line = { line: string; caliber: string; bodiesHit: number; stoppedAt: number }
type Entry = { type: 'body'; data: Body } | { type: 'line'; data: Line }

const lines = (): { line: Line; bodies: Body[] }[] => {
  const out: { line: Line; bodies: Body[] }[] = []
  let pending: Body[] = []
  for (const entry of golden.events as Entry[]) {
    if (entry.type === 'body') pending.push(entry.data)
    else {
      out.push({ line: entry.data, bodies: pending })
      pending = []
    }
  }
  return out
}

describe('G-penetration: the game shootRay through 5 bodies, replayed by penetrateLine (team-game)', () => {
  const kit = createCharacters({ penetration: 'team-game' })
  for (const { line, bodies } of lines()) {
    it(`${line.line}: damage per body, deaths and where the shot stops are the game's`, () => {
      const targets = bodies.map((body) => ({
        character: createGameZombie(kit, { type: body.type, seed: 1, age: 0, outfit: 0, health: body.healthBefore, crawl: 0 }),
        part: body.region,
        distance: body.distance,
      }))
      const caliberId = TEAM_GAME_CALIBER_KEYS[line.caliber]
      const result = kit.penetrateLine({ energyAt: () => 0, mass: 0, caliber: 0, ...(caliberId ? { caliberId } : {}) }, targets)
      const seen = targets.map((target, index) => {
        const hit = result.hits.find((entry) => entry.index === index)
        return { reached: hit !== undefined, damage: round4(hit?.points ?? 0), health: round4(target.character.state().body!.vitality), died: !target.character.alive }
      })
      expect(seen).toEqual(bodies.map(({ reached, damage, health, died }) => ({ reached, damage, health, died })))
      expect({ bodiesHit: result.hits.length, stoppedAt: result.stoppedAt }).toEqual({ bodiesHit: line.bodiesHit, stoppedAt: line.stoppedAt })
    })
  }
})
