import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createCharacters, segmentNode } from '../src'
import type { DamageCharacter, SegmentId } from '../src'
import segments from '../src/data/segments.json'
import golden from './fixtures/team-golden/arsenal-damage-segments.json'
import { ARSENAL_BODY } from './helpers/arsenal-body'
import { round4 } from './helpers/game'

// Recorded in Chrome on the Galeria 3D do Arsenal (tools/characters-catalog/captures/damage-segments.js): the page's own `damage`,
// `grenadeAt`, `sever`, `explodeSeg`, `splitTorso`, `legLost` and bleeders on a fresh zombie per scenario. The SDK side is the segment
// detail with the `arsenal` rules and the page's zombie as the body (its segment pivots, which the grenade measures from).
type State = { life: number; alive: boolean; state: string; limp: number; why: string; attached: string; hp: number[]; bleeders: number[][] }
type Entry =
  | { type: 'start'; data: State & { scenario: string } }
  | { type: 'hit'; data: State & { scenario: string; hit: number } }
  | { type: 'grenade'; data: State & { scenario: string; distance: number } }
type Scenario = { readonly id: string; readonly start?: State; readonly steps: State[]; readonly distance?: number }

/** `Z.segs` in the order `buildZombie` creates them (side 1 is the page's left). */
const PAGE_ORDER: readonly SegmentId[] = ['pelvis', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'torso', 'neck', 'head', 'jaw', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR']
const WEAPONS = segments.arsenalWeapons as Record<string, { dmg: number; pel: number }>
const GRENADE_RADIUS_METRES = 1.6

/** The page's `Z.why`, read from the events of the hit that killed. */
const whyOf = (events: readonly DestructionEvent[]): string | undefined => {
  const body = events.filter((event): event is Extract<DestructionEvent, { type: 'body' }> => event.type === 'body')
  const at = body.findIndex((event) => event.change === 'killed')
  const killed = body[at]
  if (!killed) return undefined
  const before = body.slice(0, at)
  if (killed.cause === 'explosion') return 'Explosão'
  if (killed.cause === 'head') return before.some((event) => event.change === 'severed' && event.part === 'neck') ? 'Sem cabeça' : 'Tiro na cabeça'
  return before.some((event) => event.change === 'split') ? 'Partido ao meio' : 'Dano acumulado'
}

const observe = (character: DamageCharacter, why: string): State => {
  const body = character.state().body!
  const byId = new Map(character.segments.map((segment) => [segment.id, segment]))
  const limpSide = character.limping[0]
  return {
    life: round4(body.vitality),
    alive: body.alive,
    state: !body.alive ? 'Morto' : body.crawl ? 'Rastejador' : body.limp ? 'Mancando' : 'Em pé',
    limp: limpSide === 'L' ? 1 : limpSide === 'R' ? -1 : 0,
    why,
    attached: PAGE_ORDER.map((id) => (byId.get(id)?.attached ? 1 : 0)).join(''),
    hp: PAGE_ORDER.map((id) => round4(byId.get(id)?.hp ?? 0)),
    bleeders: character.bleeders().map((bleeder) => [round4(bleeder.rate), bleeder.duration, bleeder.spurt ? 1 : 0]),
  }
}

const stateOf = ({ life, alive, state, limp, why, attached, hp, bleeders }: State): State => ({ life, alive, state, limp, why, attached, hp, bleeders })

const scenarios = (): Scenario[] => {
  const out: Scenario[] = []
  for (const entry of golden.events as Entry[]) {
    if (entry.type === 'start') out.push({ id: entry.data.scenario, start: stateOf(entry.data), steps: [] })
    else if (entry.type === 'hit') out[out.length - 1]?.steps.push(stateOf(entry.data))
    else out.push({ id: entry.data.scenario, steps: [stateOf(entry.data)], distance: entry.data.distance })
  }
  return out
}

const targetOf = (id: string): { weapon: string; segment: SegmentId; withPoint: boolean } => {
  const [weapon = '', kind = '', ...rest] = id.split('_')
  const side = rest.find((part) => part === 'L' || part === 'R') ?? ''
  return { weapon, segment: `${kind}${side}` as SegmentId, withPoint: rest.includes('point') }
}

describe('G-damage-segments: the Arsenal zombie, replayed by the segment detail (arsenal rules)', () => {
  const kit = createCharacters({ body: ARSENAL_BODY, damage: { preset: 'arsenal' } })
  for (const scenario of scenarios()) {
    it(`${scenario.id} matches the page`, () => {
      const character = kit.create({ seed: 1, kind: 'person' })
      let why = ''
      if (scenario.start) expect(observe(character, why)).toEqual(scenario.start)
      if (scenario.distance !== undefined) {
        const aim = scenario.id.split('_')[1] === 'foot' ? 'footR' : (scenario.id.split('_')[1] as SegmentId)
        const pivot = character.rig.joints[segmentNode(aim).joint]
        const events = character.hit({ type: 'explosive', point: [pivot[0] + scenario.distance, pivot[1], pivot[2]], radius: GRENADE_RADIUS_METRES, points: WEAPONS.granada!.dmg })
        expect(observe(character, whyOf(events) ?? why)).toEqual(scenario.steps[0])
        return
      }
      const target = targetOf(scenario.id)
      const weapon = WEAPONS[target.weapon]!
      const point = character.rig.joints[segmentNode(target.segment).joint]
      scenario.steps.forEach((expected, step) => {
        for (let pellet = 0; pellet < weapon.pel; pellet++) {
          why = whyOf(character.hit({ type: 'ballistic', point, part: target.segment, points: weapon.dmg, woundAtPoint: target.withPoint })) ?? why
        }
        expect({ hit: step + 1, ...observe(character, why) }).toEqual({ hit: step + 1, ...expected })
      })
    })
  }

  it('covers the 4 weapons on the 11 segments (both sides) and the grenade at 0.5 to 2 m', () => {
    const all = scenarios()
    expect(all.filter((scenario) => scenario.distance !== undefined)).toHaveLength(12)
    expect(all.filter((scenario) => scenario.distance === undefined)).toHaveLength(4 * 17 + 17)
  })
})
