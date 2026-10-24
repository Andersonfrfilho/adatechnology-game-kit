import { describe, expect, it } from 'vitest'

import { TEAM_GAME_CALIBER_KEYS, createCharacters } from '../src'
import type { BodyHit, DamageCharacter } from '../src'
import golden from './fixtures/team-golden/game-damage-regions.json'
import { createGameZombie, round4 } from './helpers/game'

// Recorded by tools/characters-catalog (vm, the game's own `zDamage`, effects and `zKill` as stubs). The SDK side is the crowd detail
// (`detail: 'regions'`) under the `team-game` penetration model; the jaw draw comes from the zombie's game stream after `zSpawn`.
type Start = { scenario: string; type: string; seed: number; age: number; outfit: number; health: number; crawl: number; helmet: number }
type HitData = {
  scenario: string
  step: number
  region: string
  damage: number
  caliber: string
  distance: number
  cut: number
  died: boolean
  headshot: boolean
  health: number
  headHp: number
  armHp: number[]
  legHp: number[]
  missing: number
  limp: number
  crawl: number
  helmet: number
  stunSeconds: number
}
type Entry = { type: 'start'; data: Start } | { type: 'hit'; data: HitData }

const toHit = (step: HitData): BodyHit => {
  const caliberId = step.caliber === 'melee' ? undefined : TEAM_GAME_CALIBER_KEYS[step.caliber]
  const type = caliberId ? 'ballistic' : step.cut > 0 ? 'slash' : 'blunt'
  return { type, point: [0, 0, 0], part: step.region, points: step.damage, distance: step.distance, cut: step.cut, ...(caliberId ? { caliberId } : {}) }
}

const observe = (character: DamageCharacter) => {
  const regions = character.regionHitPoints()
  const body = character.state().body!
  return {
    died: !character.alive,
    headshot: character.lastHit?.headshot ?? false,
    health: round4(body.vitality),
    headHp: round4(regions.head),
    armHp: [round4(regions.armL), round4(regions.armR)],
    legHp: [round4(regions.legL), round4(regions.legR)],
    missing: body.missing,
    limp: body.limp ? 1 : 0,
    crawl: body.crawl ? 1 : 0,
    helmet: character.intactProtection().includes('helmet_combat') ? 1 : 0,
    stunSeconds: round4(character.stunSeconds),
  }
}

const scenarios = (): { start: Start; hits: HitData[] }[] => {
  const out: { start: Start; hits: HitData[] }[] = []
  for (const entry of golden.events as Entry[]) {
    if (entry.type === 'start') out.push({ start: entry.data, hits: [] })
    else out[out.length - 1]?.hits.push(entry.data)
  }
  return out
}

describe('G-damage-regions: the game zDamage, replayed by the crowd detail (team-game)', () => {
  const kit = createCharacters({ penetration: 'team-game' })
  for (const { start, hits } of scenarios()) {
    it(`${start.scenario} matches the game hit by hit`, () => {
      const character = createGameZombie(kit, start)
      expect(observe(character).helmet).toBe(start.helmet)
      for (const step of hits) {
        character.hit(toHit(step))
        const seen = observe(character)
        const { died, headshot, health, headHp, armHp, legHp, missing, limp, crawl, helmet, stunSeconds } = step
        expect({ step: step.step, ...seen }).toEqual({ step: step.step, died, headshot, health, headHp, armHp, legHp, missing, limp, crawl, helmet, stunSeconds })
      }
    })
  }

  it('records 18 scripted sequences and 20 jaw rolls (5 of them take the jaw, bit 512)', () => {
    const all = scenarios()
    expect(all).toHaveLength(38)
    const jaws = all.filter(({ start }) => start.scenario.startsWith('jaw_roll_')).filter(({ hits }) => (hits[0]?.missing ?? 0) & 512)
    expect(jaws).toHaveLength(5)
  })
})
