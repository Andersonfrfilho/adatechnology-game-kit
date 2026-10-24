import { describe, expect, it } from 'vitest'

import { createArsenal } from '../src'
import type { ExplosiveBody, ExplosiveEvent, TriggerResult, Use, Vec3, WeaponEvent, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60

const arsenal = createArsenal({ rules: { faults: false } })

/** Holds the trigger for `seconds` in frames of 1/60 s, calling `trigger` and `update` the way a host does, and collects every use it gave. */
const hold = (weapon: WeaponState, seconds: number): Use[] => {
  const uses: Use[] = []
  const frames = Math.round(seconds / FRAME)
  for (let frame = 0; frame < frames; frame++) {
    uses.push(...weapon.trigger(ORIGIN, AIM, FRAME, frame > 0).uses)
    weapon.update(FRAME)
  }
  return uses
}

const throwOf = (result: TriggerResult | null): Extract<Use, { kind: 'throw' }> => {
  const use = result?.uses[0]
  if (use?.kind !== 'throw') throw new Error('no throw')
  return use
}

const cookEvents = (weapon: WeaponState): WeaponEvent[] => weapon.drain().filter((event) => event.type === 'cook')

const detonateAt = (body: ExplosiveBody): ExplosiveEvent | undefined => {
  for (let elapsed = 0; elapsed < 20; elapsed += FRAME) {
    const found = body.step(FRAME).find((event) => event.type === 'detonate')
    if (found) return found
  }
  return undefined
}

describe('cooking a grenade: the trigger pulls the pin, the release throws with the fuse that is left', () => {
  it('holding 1.5 s and releasing throws it with 2.5 s of the 4 s fuse left', () => {
    const weapon = arsenal.create('frag_grenade')
    expect(hold(weapon, 1.5)).toEqual([])
    expect(weapon.cooking).toBe(true)
    const thrown = throwOf(weapon.release(ORIGIN, AIM))
    expect(thrown.fuse).toBeCloseTo(2.5, 6)
    expect(thrown.cooked).toBeCloseTo(1.5, 6)
    expect(thrown.trigger).toBe('timer')
    expect(thrown.inHand).toBeUndefined()
    expect(weapon.ammo).toBe(2)
    const body = arsenal.explosiveBody(thrown) as ExplosiveBody
    const event = detonateAt(body)
    expect(event?.type === 'detonate' && event.detonation.at).toBeCloseTo(2.5, 1)
  })

  it('emits the cook events with the fuse of each moment: start with the whole fuse, throw with what is left', () => {
    const weapon = arsenal.create('frag_grenade')
    hold(weapon, 1)
    weapon.release(ORIGIN, AIM)
    const events = cookEvents(weapon)
    expect(events).toMatchObject([
      { type: 'cook', phase: 'start', fuse: 4 },
      { type: 'cook', phase: 'throw' },
    ])
    expect(events[1]?.type === 'cook' && events[1].fuse).toBeCloseTo(3, 6)
  })

  it('a quick pull and release is a plain throw: the whole fuse is left', () => {
    const weapon = arsenal.create('frag_grenade')
    weapon.trigger(ORIGIN, AIM, 0, false)
    expect(throwOf(weapon.release(ORIGIN, AIM)).fuse).toBe(4)
  })

  it('holding past the fuse sets it off in the hand, once, and the trigger does nothing more until it is released', () => {
    const weapon = arsenal.create('frag_grenade')
    const uses = hold(weapon, 5)
    expect(uses).toHaveLength(1)
    const burst = uses[0]
    expect(burst).toMatchObject({ kind: 'throw', inHand: true, fuse: 0, trigger: 'timer', explosive: 'm67', velocity: [0, 0, 0], origin: ORIGIN })
    expect(weapon.cooking).toBe(false)
    expect(weapon.ammo).toBe(2)
    expect(weapon.release(ORIGIN, AIM)).toBeNull()
    const event = detonateAt(arsenal.explosiveBody(burst as Use) as ExplosiveBody)
    expect(event?.type === 'detonate' && event.detonation).toMatchObject({ cause: 'timer', point: ORIGIN, energy: 200000 })
    const events = cookEvents(weapon)
    expect(events).toMatchObject([
      { phase: 'start', fuse: 4 },
      { phase: 'burst', fuse: 0 },
    ])
    expect(events[1]?.at).toBeCloseTo(4, 6)
  })

  it('releasing after the fuse ran out (no trigger call in between) also bursts in the hand', () => {
    const weapon = arsenal.create('frag_grenade')
    weapon.trigger(ORIGIN, AIM, FRAME, false)
    for (let frame = 0; frame < 300; frame++) weapon.update(FRAME)
    expect(throwOf(weapon.release(ORIGIN, AIM))).toMatchObject({ inHand: true, fuse: 0 })
    expect(weapon.ammo).toBe(2)
  })

  it('a new pull after the burst cooks the next grenade', () => {
    const weapon = arsenal.create('frag_grenade')
    hold(weapon, 5)
    weapon.release(ORIGIN, AIM)
    hold(weapon, 0.5)
    expect(weapon.cooking).toBe(true)
    expect(throwOf(weapon.release(ORIGIN, AIM)).fuse).toBeCloseTo(3.5, 6)
    expect(weapon.ammo).toBe(1)
  })

  it('is the same on every run with the same seed, flashbang included', () => {
    const run = (id: string): string => {
      const weapon = arsenal.create(id, { seed: 21 })
      const burst = hold(weapon, 0.7)
      const thrown = weapon.release(ORIGIN, AIM)
      return JSON.stringify({ burst, thrown, events: weapon.drain() })
    }
    for (const id of ['frag_grenade', 'flashbang', 'dynamite']) expect(run(id), id).toBe(run(id))
  })
})

describe('a flashbang is cooked against its sampled fuse', () => {
  it('bursts in the hand exactly at the fuse sampled for the throw (inside 1.0 to 2.3 s), and a throw keeps the rest of it', () => {
    const weapon = arsenal.create('flashbang', { seed: 4 })
    hold(weapon, 0.5)
    const fuse = (() => {
      const event = weapon.drain().find((entry) => entry.type === 'cook' && entry.phase === 'start')
      return event?.type === 'cook' ? event.fuse : 0
    })()
    expect(fuse).toBeGreaterThanOrEqual(1)
    expect(fuse).toBeLessThan(2.3)
    expect(throwOf(weapon.release(ORIGIN, AIM)).fuse).toBeCloseTo(fuse - 0.5, 6)
    const second = arsenal.create('flashbang', { seed: 4 })
    const uses = hold(second, 3)
    expect(uses).toMatchObject([{ inHand: true, stunSeconds: 4 }])
    const burst = second.drain().find((entry) => entry.type === 'cook' && entry.phase === 'burst')
    expect(burst?.at).toBeCloseTo(fuse, 6)
  })
})

describe('what is not a timer throwable is not cooked', () => {
  it('a molotov (impact) is thrown on the pull', () => {
    const weapon = arsenal.create('molotov')
    expect(weapon.trigger(ORIGIN, AIM, 0, false).uses[0]).toMatchObject({ kind: 'throw', trigger: 'impact', fuse: 0 })
    expect(weapon.cooking).toBe(false)
    expect(weapon.release()).toBeNull()
  })

  it('C4 and the Claymore (remote and wire) are set down on the pull', () => {
    for (const id of ['c4', 'claymore']) {
      const weapon = arsenal.create(id)
      expect(weapon.trigger(ORIGIN, AIM, 0, false).uses[0], id).toMatchObject({ kind: 'place' })
      expect(weapon.cooking, id).toBe(false)
    }
  })

  it('a dynamite with a long fuse is set down lit on the pull', () => {
    const weapon = arsenal.create('dynamite')
    weapon.setFuseLength(0.3)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).uses[0]).toMatchObject({ kind: 'place', triggers: ['timer'] })
    expect(weapon.cooking).toBe(false)
  })

  it('refill puts the pin back: nothing is cooking', () => {
    const weapon = arsenal.create('frag_grenade')
    hold(weapon, 1)
    weapon.refill()
    expect(weapon.cooking).toBe(false)
  })
})
