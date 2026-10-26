import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import type { Vec3, WeaponEvent } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]

/** Every weapon whose rule loads round by round: an empty one takes its rounds one at a time at the rule's seconds per round, never all at once. */
const arsenal = createArsenal({ rules: { faults: false } })
const oneAtATime = [...arsenal.weapons.values()].filter((def) => def.action.kind === 'firearm' && (def.action.perRound || def.action.timings?.perRound))

const emptied = (id: string) => {
  const weapon = arsenal.create(id, { reserve: 200 })
  weapon.update(5)
  for (let n = 0; weapon.ammo > 0 && n < 200; n++) {
    weapon.update(2)
    weapon.trigger(ORIGIN, AIM, 0, false)
    weapon.release()
  }
  weapon.update(10)
  weapon.drain()
  return weapon
}

describe('an empty reload of a weapon that loads round by round', () => {
  it('the catalogue has such weapons', () => expect(oneAtATime.length).toBeGreaterThan(10))
  for (const def of oneAtATime) {
    it(`${def.id}: one feed per round, each ${def.action.kind === 'firearm' ? def.action.timings?.perRound ?? def.action.reload : 0} s apart`, () => {
      const action = def.action
      if (action.kind !== 'firearm') return
      const step = action.timings?.perRound ?? action.reload
      const weapon = emptied(def.id)
      expect(weapon.ammo).toBe(0)
      const capacity = weapon.capacity
      expect(weapon.reload()).toBe(true)
      const seen: number[] = []
      const feeds: number[] = []
      const events: WeaponEvent[] = []
      for (let t = 0; t < 40 && weapon.reloading; t += 1 / 60) {
        weapon.update(1 / 60)
        for (const event of weapon.drain()) {
          events.push(event)
          if (event.type === 'feed') {
            feeds.push(event.at)
            seen.push(weapon.ammo)
          }
        }
      }
      expect(weapon.reloading).toBe(false)
      expect(weapon.ammo).toBe(capacity)
      expect(feeds).toHaveLength(capacity)
      for (let i = 1; i < feeds.length; i++) expect(feeds[i]! - feeds[i - 1]!).toBeCloseTo(step, 2)
      // the reload lasts what the rounds take, plus the action worked after them when the weapon has one (the pump, the lever)
      const end = events.find((event) => event.type === 'reload' && event.phase === 'end')
      expect(end).toBeDefined()
      expect((end as { at: number }).at - feeds[0]!).toBeGreaterThanOrEqual((capacity - 1) * step - 0.02)
      const stages = events.filter((event) => event.type === 'reload_stage')
      if (stages.length > 1 && action.family && ['pump', 'lever', 'tube_semi', 'top_load_semi'].includes(action.family)) {
        // the closing stage comes when the last round is in
        const closing = stages.at(-1) as { at: number }
        expect(closing.at).toBeGreaterThanOrEqual(feeds.at(-1)! - 0.02)
        expect((end as { at: number }).at).toBeGreaterThan(feeds.at(-1)! + 0.1)
      }
    })
  }
})
