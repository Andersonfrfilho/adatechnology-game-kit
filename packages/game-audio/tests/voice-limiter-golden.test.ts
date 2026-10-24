import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { VOICE_GROUPS, createVoiceManager } from '../src'
import type { VoiceGroup } from '../src'
import { FRAME_SECONDS, FRAMES, scriptGroans, teamAccepted } from './support/team-voice-limit'
import type { GroanAttempt, LimitRule } from './support/team-voice-limit'

// The voice limiter against the two team rules: the game's cooldown and distance (jogo L66986, L70472) and the art scene's concurrency (Cena L1342,
// `AU.groans > 4` refuses, so five play at once). The fixture holds the accepted attempts of the transcribed team code; regenerate on purpose
// with UPDATE_GOLDEN=1.
const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/voice-limiter.json')
const SEEDS = [1, 7, 42] as const
const RULES: readonly LimitRule[] = ['game', 'art_scene', 'both']
const GROUPS: Readonly<Record<LimitRule, VoiceGroup>> = {
  game: { cooldown: 0.25, maxDistance: 40 },
  art_scene: { maxConcurrent: 5 },
  // the shipped group is the two rules together
  both: VOICE_GROUPS.undead_voice as VoiceGroup,
}

type LimiterFixture = Record<string, { readonly attempts: number; readonly accepted: readonly number[] }>

function managerAccepted(attempts: readonly GroanAttempt[], group: VoiceGroup): number[] {
  const manager = createVoiceManager({ groups: { undead_voice: group } })
  const accepted: number[] = []
  let next = 0
  for (let frame = 0; frame < FRAMES; frame++) {
    for (; next < attempts.length && (attempts[next] as GroanAttempt).frame === frame; next++) {
      const { distance, length } = attempts[next] as GroanAttempt
      if (manager.request({ group: 'undead_voice', priority: 3, gain: 1, distance, length }).accepted) accepted.push(next)
    }
    manager.advance(FRAME_SECONDS)
  }
  return accepted
}

function recordFixture(): LimiterFixture {
  const fixture: LimiterFixture = {}
  for (const seed of SEEDS) {
    const attempts = scriptGroans(seed)
    for (const rule of RULES) fixture[`${rule}@${seed}`] = { attempts: attempts.length, accepted: teamAccepted(attempts, rule) }
  }
  return fixture
}

const serialize = (fixture: LimiterFixture): string => `{\n${Object.entries(fixture).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n')}\n}\n`

describe('voice limiter golden', () => {
  if (process.env.UPDATE_GOLDEN === '1') {
    it('regenerates the fixture from the team rules', () => {
      writeFileSync(FIXTURE, serialize(recordFixture()))
      expect(existsSync(FIXTURE)).toBe(true)
    })
    return
  }

  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as LimiterFixture

  it('the transcribed team rules still give the fixture', () => {
    expect(serialize(recordFixture())).toBe(readFileSync(FIXTURE, 'utf8'))
  })

  for (const seed of SEEDS) {
    for (const rule of RULES) {
      it(`${rule}, seed ${seed}: the limiter accepts the same groans as the team code`, () => {
        const expected = fixture[`${rule}@${seed}`]
        const attempts = scriptGroans(seed)
        expect(attempts.length).toBe(expected?.attempts)
        expect(managerAccepted(attempts, GROUPS[rule])).toEqual(expected?.accepted)
      })
    }
  }

  it('each rule refuses something, so the golden exercises it', () => {
    for (const seed of SEEDS) {
      for (const rule of RULES) {
        const entry = fixture[`${rule}@${seed}`]
        expect(entry?.accepted.length).toBeGreaterThan(0)
        expect(entry?.accepted.length).toBeLessThan(entry?.attempts ?? 0)
      }
    }
  })
})
