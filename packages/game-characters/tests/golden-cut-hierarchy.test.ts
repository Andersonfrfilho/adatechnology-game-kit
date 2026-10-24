import { describe, expect, it } from 'vitest'

import { createCharacters, createRng } from '../src'
import type { BodyHit, DamageCharacter, SegmentId, SegmentStatus } from '../src'
import segments from '../src/data/segments.json'
import golden from './fixtures/team-golden/elenco-cut-hierarchy.json'
import { round4 } from './helpers/game'

// Recorded in Chrome on the Elenco (tools/characters-catalog/captures/cut-hierarchy.js): the page's own `hit`, `sever` and `breakBone` on
// the first character of the lineup, `Math.random` reseeded per scenario (seed × 100000 + n). The SDK side is the segment detail with the
// `elenco` rules; its one draw per blow comes from the same stream, at the place the page draws it.
type State = { states: string; hp: number[]; dead: number; crawl: number; limp: number[]; pendulums: (string | number)[][] }
type Entry = { type: 'start'; data: State & { scenario: string } } | { type: 'hit'; data: State & { scenario: string; step: number } }

/** The Elenco's segment ids to the kit's (arms: 0 is the left; legs: 0 is the right, `LSIDE`). */
const ELENCO_IDS: Readonly<Record<string, SegmentId>> = {
  head: 'head',
  torso: 'torso',
  pelvis: 'pelvis',
  uArm0: 'upperArmL',
  fArm0: 'forearmL',
  hand0: 'handL',
  uArm1: 'upperArmR',
  fArm1: 'forearmR',
  hand1: 'handR',
  thigh0: 'thighR',
  shin0: 'shinR',
  thigh1: 'thighL',
  shin1: 'shinL',
}
const STATE_NAMES: Readonly<Record<SegmentStatus, string>> = { ok: 'ok', wounded: 'ferido', broken: 'quebrado', severed: 'cut', destroyed: 'cut' }
const WEAPONS = segments.elenco.cutWeapons
const GUNS: ReadonlySet<string> = new Set(['p9', 'e12', 'f762'])

/** `Math.random` draws the page makes building the first character (`build(NPCS[0])`) before the first blow. */
const BUILD_DRAWS = 1284
/** Draws of `burst(point, normal, 8 + round(dmg / 6))` after each blow's own draw: 8, then 7 per particle. */
const burstDraws = (damage: number): number => 8 + 7 * (8 + Math.round(damage / 6))

/** The page's stream for one scenario, handing the SDK only the draws the page spends on the blow (one per hit). */
const elencoStream = (scenario: number, damage: number): (() => number) => {
  const random = createRng(100000 + scenario)
  for (let draw = 0; draw < BUILD_DRAWS; draw++) random()
  return () => {
    const value = random()
    for (let draw = 0; draw < burstDraws(damage); draw++) random()
    return value
  }
}

const observe = (character: DamageCharacter): State => {
  const byId = new Map(character.segments.map((segment) => [segment.id, segment]))
  const pendulums = Object.entries(ELENCO_IDS).flatMap(([, id]) => {
    const segment = byId.get(id)
    const joint = segment?.kind === 'upperArm' ? 'shoulder' : segment?.kind === 'forearm' ? 'elbow' : undefined
    return segment && joint && segment.status === 'broken' && segment.attached ? [[joint, segment.side === 'L' ? 0 : 1]] : []
  })
  const body = character.state().body!
  return {
    states: Object.entries(ELENCO_IDS)
      .map(([elenco, id]) => `${elenco}:${STATE_NAMES[byId.get(id)!.status]}`)
      .join(' '),
    hp: Object.values(ELENCO_IDS).map((id) => round4(byId.get(id)!.hp)),
    dead: body.alive ? 0 : 1,
    crawl: body.crawl ? 1 : 0,
    limp: [character.limping.includes('R') ? 1 : 0, character.limping.includes('L') ? 1 : 0],
    pendulums,
  }
}

/** The pendulum's start angle and speed are the rich renderer's (T4.1i); the rule says which joint dangles. */
const expectedOf = ({ states, hp, dead, crawl, limp, pendulums }: State): State => ({ states, hp, dead, crawl, limp, pendulums: pendulums.map(([kind, arm]) => [kind as string, arm as number]) })

describe('G-cut-hierarchy: the Elenco cut rule, replayed by the segment detail (elenco rules)', () => {
  const kit = createCharacters({ damage: { preset: 'elenco' } })
  const runs: { id: string; counter: number; start: State; steps: State[] }[] = []
  for (const entry of golden.events as Entry[]) {
    if (entry.type === 'start') runs.push({ id: entry.data.scenario, counter: runs.length + 1, start: entry.data, steps: [] })
    else runs[runs.length - 1]?.steps.push(entry.data)
  }

  for (const run of runs) {
    it(`${run.id}: states, hit points, cascades, limp, crawl and death match the page`, () => {
      const [weaponId = '', elencoId = ''] = run.id.split('_')
      const weapon = WEAPONS.find((candidate) => candidate.id === weaponId)!
      const part = ELENCO_IDS[elencoId]!
      const character = kit.create({ seed: 1, kind: 'person', random: elencoStream(run.counter, weapon.dmg) })
      expect(observe(character)).toEqual(expectedOf(run.start))
      const blow: BodyHit = { type: GUNS.has(weaponId) ? 'ballistic' : 'slash', point: character.rig.joints.hip, part, points: weapon.dmg, cut: weapon.cut, woundAtPoint: false }
      run.steps.forEach((expected, step) => {
        character.hit(blow)
        expect({ step: step + 1, ...observe(character) }).toEqual({ step: step + 1, ...expectedOf(expected) })
      })
    })
  }

  it('covers 6 weapons on 13 segments', () => expect(runs).toHaveLength(6 * 13))
})
